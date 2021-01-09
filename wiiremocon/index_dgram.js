'use strict';

var dgram = require('dgram').createSocket("udp4");

const WiiRemocon = require('./wiiremocon');
require('dotenv').config();

const WII_ADDRESS = process.argv[2] || '【WiiのBLEのMacアドレス】';
const GAMEPAD_HOST = process.argv[3] || '【ESP32のIPアドレス】';
const GAMEPAD_PORT = process.argv[4] || 8000;

const WIIREMOTE_CMD_EVT = 0x00;
const WIIREMOTE_CMD_ERR = 0xff;

const wii = new WiiRemocon();

async function wiiremote_dgram(){
  wii.on("data", data =>{
    console.log(data);
    var message = {
      rsp: WIIREMOTE_CMD_EVT,
      evt: [...data]
    }
    
    var msg = JSON.stringify(message);
    dgram.send(msg, GAMEPAD_PORT, GAMEPAD_HOST);
  });

  wii.on("error", data =>{
    console.error("Error", data);
    wii.disconnect();
    var message = {
      rsp: WIIREMOTE_CMD_ERR,
      error: data
    }

    var msg = JSON.stringify(message);
    dgram.send(msg, GAMEPAD_PORT, GAMEPAD_HOST);
  });
  
  console.log('wii discovering');
  await wii.connect(wii.addr2bin(WII_ADDRESS));
  await wii.setLed(wii.WIIREMOTE_LED_BIT0 | wii.WIIREMOTE_LED_BIT1 | wii.WIIREMOTE_LED_BIT2 | wii.WIIREMOTE_LED_BIT3, 0); 
  var ret = await wii.requestStatus();
  console.log("requestStatus", ret);
  await wii.enableExtension(false);
  await wii.setDataReportingMode(wii.WIIREMOTE_REPORTID_BTNS);
}

wiiremote_dgram()
.catch(error =>{
  console.error(error);
});


