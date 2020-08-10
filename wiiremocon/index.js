'use strict';

const WiiRemocon = require('./wiiremocon');
const mqtt = require('mqtt');
require('dotenv').config();

const MQTT_HOST = process.env.MQTT_HOST || 'mqtt://raspberry.myhome.or.jp:1883';
const MQTT_TOPIC_CMD = process.env.MQTT_TOPIC_CMD || 'testwii_cmd';
const MQTT_TOPIC_EVT = process.env.MQTT_TOPIC_EVT || 'testwii_evt';

const WIIREMOTE_CMD_EVT = 0x00;
const WIIREMOTE_CMD_ERR = 0xff;
const WIIREMOTE_CMD_CONNECT = 0x01;
const WIIREMOTE_CMD_DISCONNECT = 0x02;
const WIIREMOTE_CMD_WRITE = 0x03;
const WIIREMOTE_CMD_ENABLE_SOUND = 0x04;
const WIIREMOTE_CMD_ENABLE_EXTENSION = 0x05;
const WIIREMOTE_CMD_REQ_REMOTE_ADDRESS = 0x06;
const WIIREMOTE_CMD_READ_REG = 0x07;
const WIIREMOTE_CMD_WRITE_REG = 0x08;
const WIIREMOTE_CMD_REQ_STATUS = 0x09;
const WIIREMOTE_CMD_READ_REG_LONG = 0x0a;

var g_address = null;

const wii = new WiiRemocon();
const client = mqtt.connect(MQTT_HOST);

client.on('connect', () => {
  console.log('mqtt.connected.');
  client.subscribe(MQTT_TOPIC_CMD, (err, granted) =>{
    if( err ){
      console.error(err);
      return;
    }
    console.log('mqtt.subscribed.');
  });
});

client.on('message', async (topic, message) =>{
  console.log('on.message', 'topic:', topic, 'message:', message.toString());
  try{
    var msg = JSON.parse(message);
    var cmd = msg.cmd;
    if( cmd == WIIREMOTE_CMD_CONNECT ){
      if( g_address ){
        await wii.disconnect();
        g_address = null;
      }
      var address = Uint8Array.from(msg.address);
      console.log(address);
      await wii.connect(address, msg.retry);
      g_address = address;
    }else
    if( cmd == WIIREMOTE_CMD_DISCONNECT ){
      if( g_address ){
        await wii.disconnect();
        g_address = null;
      }
    }else
    if( cmd == WIIREMOTE_CMD_WRITE ){
      await wii.writevalue(Buffer.from(msg.value));
    }else
    if( cmd == WIIREMOTE_CMD_ENABLE_SOUND ){
      await wii.enableSound(msg.enable);
    }else
    if( cmd == WIIREMOTE_CMD_ENABLE_EXTENSION ){
      await wii.enableExtension(msg.enable);
    }else
    if( cmd == WIIREMOTE_CMD_REQ_REMOTE_ADDRESS ){
      var message = {
        rsp: WIIREMOTE_CMD_REQ_REMOTE_ADDRESS,
      };
      if( g_address )
        message.address = [...g_address];
      client.publish(MQTT_TOPIC_EVT, JSON.stringify(message));
    }else
    if( cmd == WIIREMOTE_CMD_READ_REG ){
      var data = await wii.readRegister(msg.offset, msg.len);
      var message = {
        rsp: WIIREMOTE_CMD_READ_REG,
        offset: offset,
        data: [...data]
      }
      client.publish(MQTT_TOPIC_EVT, JSON.stringify(message));
    }else
    if( cmd == WIIREMOTE_CMD_WRITE_REG ){
      await wii.writeRegister(msg.offset, Uint8Array.from(msg.data));
    }else
    if( cmd == WIIREMOTE_CMD_REQ_STATUS ){
      var result = await wii.requestStatus();
      var message = {
        rsp: WIIREMOTE_CMD_REQ_STATUS,
        status: [...result]
      }
      client.publish(MQTT_TOPIC_EVT, JSON.stringify(message));
    }else
    if( cmd == WIIREMOTE_CMD_READ_REG_LONG ){
      var result = await wii.readRegisterLong(msg.offset, msg.len);
      var message = {
        rsp: WIIREMOTE_CMD_READ_REG_LONG,
        offset: result.offset,
        value: [...result.value]
      }
      client.publish(MQTT_TOPIC_EVT, JSON.stringify(message));
    }else{
      throw "Unknown cmd";
    }
  }catch(error){
    console.error(error);
    var message = {
      rsp: WIIREMOTE_CMD_ERR,
      error: error
    }
    client.publish(MQTT_TOPIC_EVT, JSON.stringify(message));
  }
});

async function wiiremote_mqtt(){
  wii.on("data", data =>{
    console.log(data);
    var message = {
      rsp: WIIREMOTE_CMD_EVT,
      evt: [...data]
    }
    client.publish(MQTT_TOPIC_EVT, JSON.stringify(message));
  });

  wii.on("error", data =>{
    console.error("Error", data);
    wii.disconnect();
    var message = {
      rsp: WIIREMOTE_CMD_ERR,
      error: data
    }
    client.publish(MQTT_TOPIC_EVT, JSON.stringify(message));
  });
}

wiiremote_mqtt()
.catch(error =>{
  console.error(error);
  client.end();
});


