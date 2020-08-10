'use strict';

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

const WIIREMOTE_EXT_TYPE_NUNCHUCK = 0x01;
const WIIREMOTE_EXT_TYPE_BALANCEBOARD = 0x02;

const WIIREMOTE_REPORTID_RUMBLE = 0x10;
const WIIREMOTE_REPORTID_LED = 0x11;
const WIIREMOTE_REPORTID_REPORTINGMODE = 0x12;
const WIIREMOTE_REPORTID_IR_ENABLE = 0x13;
const WIIREMOTE_REPORTID_SPEAKER_ENABLE = 0x14;
const WIIREMOTE_REPORTID_STATUS_REQUEST = 0x15;
const WIIREMOTE_REPORTID_WRITE = 0x16;
const WIIREMOTE_REPORTID_READ = 0x17;
const WIIREMOTE_REPORTID_SPEAKER_DATA = 0x18;
const WIIREMOTE_REPORTID_SPEAKER_MUTE = 0x19;
const WIIREMOTE_REPORTID_IR2_ENABLE = 0x1a;
const WIIREMOTE_REPORTID_STATUS = 0x20;
const WIIREMOTE_REPORTID_READ_DATA = 0x21;
const WIIREMOTE_REPORTID_ACK = 0x22;
const WIIREMOTE_REPORTID_BTNS = 0x30;
const WIIREMOTE_REPORTID_BTNS_ACC = 0x31;
const WIIREMOTE_REPORTID_BTNS_EXT8 = 0x32;
const WIIREMOTE_REPORTID_BTNS_ACC_IR12 = 0x33;
const WIIREMOTE_REPORTID_BTNS_EXT19 = 0x34;
const WIIREMOTE_REPORTID_BTNS_ACC_EXT16 = 0x35;
const WIIREMOTE_REPORTID_BTNS_IR10_EXT9 = 0x36;
const WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6 = 0x37;
const WIIREMOTE_REPORTID_EXT21 = 0x3d;

const WIIREMOTE_FLAG_BIT_BATTERY_EMPTY = 0x01;
const WIIREMOTE_FLAG_BIT_EXTENSION_CONNECTED = 0x02;
const WIIREMOTE_FLAG_BIT_SPEAKER_ENABLED = 0x04;
const WIIREMOTE_FLAG_BIT_IR_ENABLED = 0x08;

const WIIREMOTE_RUMBLE_MASK = 0x01;
const WIIREMOTE_LED_MASK = 0xf0;
const WIIREMOTE_LED_BIT0 = 0x80;
const WIIREMOTE_LED_BIT1 = 0x40;
const WIIREMOTE_LED_BIT2 = 0x20;
const WIIREMOTE_LED_BIT3 = 0x10;

const WIIREMOTE_ADDRESS_BALANCE_CALIBRATION = 0xa40020;

class WiiClient {
  constructor(mqtt_client, topic_cmd) {
    this.mqtt_client = mqtt_client;
    this.topic_cmd = topic_cmd;
  }

  setLed(value){

  }
  
  connect(address, retry = 2){
    var data = {
      cmd: WIIREMOTE_CMD_CONNECT,
      address: this.addr2bin(address),
      retry: retry
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  disconnect(){
    var data = {
      cmd: WIIREMOTE_CMD_DISCONNECT,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  writaValue(value){
    var data = {
      cmd: WIIREMOTE_CMD_WRITE,
      value: value
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  enableSound(enable){
    var data = {
      cmd: WIIREMOTE_CMD_ENABLE_SOUND,
      enable: enable,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  enableExtension(enable){
    var data = {
      cmd: WIIREMOTE_CMD_ENABLE_EXTENSION,
      enable: enable,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  requestRemoteAddress(){
    var data = {
      cmd: WIIREMOTE_CMD_REQ_REMOTE_ADDRESS,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  readRegister(offset, len){
    var data = {
      cmd: WIIREMOTE_CMD_READ_REG,
      offset: offset,
      len: len,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  writeRegister(offset, data){
    var data = {
      cmd: WIIREMOTE_CMD_WRITE_REG,
      offset: offset,
      data: data,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  requestStatus(){
    var data = {
      cmd: WIIREMOTE_CMD_REQ_STATUS,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  readRegisterLong(offset, len){
    var data = {
      cmd: WIIREMOTE_CMD_READ_REG_LONG,
      offset: offset,
      len: len,
    };
    var message = new Paho.MQTT.Message(JSON.stringify(data));
    message.destinationName = this.topic_cmd;
    this.mqtt_client.send(message);
  }

  calcurateBalanceBoard(data, base){
    var result = {
      topright: this.calc_balance(data.topright, base.topright ),
      bottomright: this.calc_balance(data.bottomright, base.bottomright ),
      topleft: this.calc_balance(data.topleft, base.topleft ),
      bottomleft: this.calc_balance(data.bottomleft, base.bottomleft ),
    };
    result.total_weight = (result.topright + result.bottomright + result.topleft + result.bottomleft);

    return result;
  }

  calc_balance(value, base){
    if( value <= base[0] ){
      return 0.0;
    }else if( value > base[0] && value <= base[1] ){
      return ((value - base[0]) / (base[1] - base[0])) * 17.0;
    }else if( value > base[0] && value <= base[1] ){
      return (((value - base[1]) / (base[2] - base[1])) * (34.0 - 17.0)) + 17.0;
    }else{
      return 34.0;
    }
  }

  parseBalanceBoardCalibration(data){
    var result = {
      topright: [(data[0x04] << 8) | data[0x05], (data[0x0c] << 8) | data[0x0d], (data[0x14] << 8) | data[0x15]],
      bottomright: [(data[0x06] << 8) | data[0x07], (data[0x0e] << 8) | data[0x0f], (data[0x16] << 8) | data[0x17]],
      topleft: [(data[0x08] << 8) | data[0x09], (data[0x10] << 8) | data[0x11], (data[0x18] << 8) | data[0x19]],
      bottomleft: [(data[0x0a] << 8) | data[0x0b], (data[0x12] << 8) | data[0x13], (data[0x1a] << 8) | data[0x1b]],
    };

    return result;
  }

  parseExtension(type, data) {
    if (type == WIIREMOTE_EXT_TYPE_NUNCHUCK) {
      var value = {
        stk_x: data[0],
        stk_y: data[1],
        acc_x: (data[2] << 2) | ((data[5] >> 2) & 0x03),
        acc_y: (data[3] << 2) | ((data[5] >> 4) & 0x03),
        acc_z: (data[4] << 2) | ((data[5] >> 6) & 0x03),
        btns: (~data[5] & 0x03),
      }
      return value;
    } else
    if (type == WIIREMOTE_EXT_TYPE_BALANCEBOARD) {
      var value = {
        topright: (data[0] << 8) | data[1],
        bottomright: (data[2] << 8) | data[3],
        topleft: (data[4] << 8) | data[5],
        bottomleft: (data[6] << 8) | data[7],
      };
      if (data.length >= 11) {
        value.temperature = data[8];
        value.battery = data[10];
      }
      return value;
    }
  }

  parseReporting(data) {
    if (data[0] == WIIREMOTE_REPORTID_STATUS) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        leds: data[3] & 0xf0,
        flags: data[3] & 0x0f,
        battery: data[6]
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_READ_DATA) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        size: (data[3] >> 4) & 0x0f + 1,
        error: data[3] & 0x0f,
        address: (data[4] << 8) | data[5],
        data: data.slice(6)
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_ACK) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        report: data[3],
        error: data[4]
      };
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS) {
      var report = {
        report_id: data[0],
        btns: ((data[1] << 8) | data[2]),
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        acc_x: (data[3] << 2) | ((data[1] >> 5) & 0x03),
        acc_y: (data[4] << 1) | ((data[2] >> 5) & 0x01),
        acc_z: (data[5] << 1) | ((data[2] >> 6) & 0x01),
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_EXT8) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        extension: data.slice(3)
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC_IR12) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        acc_x: (data[3] << 2) | ((data[1] >> 5) & 0x03),
        acc_y: (data[4] << 1) | ((data[2] >> 5) & 0x01),
        acc_z: (data[5] << 1) | ((data[2] >> 6) & 0x01),
        ir: data.slice(6),
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_EXT19) {
      var report = {
        report_id: data[0],
        btns: ((data[1] << 8) | data[2]),
        extension: data.slice(3),
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC_EXT16) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        acc_x: (data[3] << 2) | ((data[1] >> 5) & 0x03),
        acc_y: (data[4] << 1) | ((data[2] >> 5) & 0x01),
        acc_z: (data[5] << 1) | ((data[2] >> 6) & 0x01),
        extension: data.slice(6),
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_IR10_EXT9) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        ir: data.slice(3, 3 + 10),
        extension: data.slice(3 + 10),
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6) {
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        acc_x: (data[3] << 2) | ((data[1] >> 5) & 0x03),
        acc_y: (data[4] << 1) | ((data[2] >> 5) & 0x01),
        acc_z: (data[5] << 1) | ((data[2] >> 6) & 0x01),
        ir: data.slice(6, 6 + 10),
        extension: data.slice(6 + 10),
      };
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_EXT21) {
      var report = {
        report_id: data[0],
        extension: data
      };
      return report;
    } else
    if (data[0] == 0x3e || data[0] == 0x0f) {
      throw "not supported";
    } else {
      throw "unknown";
    }
  }

  addr2bin(address){
    return bytes_swap(hexs2bytes(address, ':'));
  }
  
  addr2str(address){
    return bytes2hexs(bytes_swap(address), ':');
  }  
}

function hexs2bytes(hexs, sep) {
  hexs = hexs.trim(hexs);
  if( sep == '' ){
      hexs = hexs.replace(/ /g, "");
      var array = [];
      for( var i = 0 ; i < hexs.length / 2 ; i++)
          array[i] = parseInt(hexs.substr(i * 2, 2), 16);
      return array;
  }else{
      return hexs.split(sep).map(function(h) { return parseInt(h, 16) });
  }
}

function bytes2hexs(bytes, sep) {
  var hexs = '';
  for( var i = 0 ; i < bytes.length ; i++ ){
      if( i != 0 )
          hexs += sep;
      var s = bytes[i].toString(16);
      hexs += ((bytes[i]) < 0x10) ? '0'+s : s;
  }
  return hexs;
}

function bytes_swap(bytes){
  for( var i = 0 ; i < bytes.length / 2 ; i++ ){
    var t = bytes[i];
    bytes[i] = bytes[bytes.length - 1 - i];
    bytes[bytes.length - 1 - i] = t;
  }

  return bytes;
}