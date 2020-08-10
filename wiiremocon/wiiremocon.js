'use strict';

var EventEmitter = require('events').EventEmitter;

var binding = require('./build/Release/binding.node');

const WIIREMOTE_RUMBLE_MASK = 0x01;
const WIIREMOTE_LED_MASK = 0xf0;
const WIIREMOTE_LED_BIT0 = 0x80;
const WIIREMOTE_LED_BIT1 = 0x40;
const WIIREMOTE_LED_BIT2 = 0x20;
const WIIREMOTE_LED_BIT3 = 0x10;

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

const WIIREMOTE_ADDRESS_BALANCE_CALIBRATION = 0xa40020;

const WRITE_WAIT = 10;
const CB_TIMEOUT = 1000;


function inherits(target, source) {
  for (var k in source.prototype) {
    target.prototype[k] = source.prototype[k];
  }
}

class WiiRemocon extends EventEmitter{
  constructor(){
    super();

    this.WIIREMOTE_FLAG_BIT_BATTERY_EMPTY = WIIREMOTE_FLAG_BIT_BATTERY_EMPTY;
    this.WIIREMOTE_FLAG_BIT_EXTENSION_CONNECTED = WIIREMOTE_FLAG_BIT_EXTENSION_CONNECTED;
    this.WIIREMOTE_FLAG_BIT_SPEAKER_ENABLED = WIIREMOTE_FLAG_BIT_SPEAKER_ENABLED;
    this.WIIREMOTE_FLAG_BIT_IR_ENABLED = WIIREMOTE_FLAG_BIT_IR_ENABLED;

    this.WIIREMOTE_LED_MASK = WIIREMOTE_LED_MASK;
    this.WIIREMOTE_LED_BIT0 = WIIREMOTE_LED_BIT0;
    this.WIIREMOTE_LED_BIT1 = WIIREMOTE_LED_BIT1;
    this.WIIREMOTE_LED_BIT2 = WIIREMOTE_LED_BIT2;
    this.WIIREMOTE_LED_BIT3 = WIIREMOTE_LED_BIT3;

    this.WIIREMOTE_EXT_TYPE_NUNCHUCK = WIIREMOTE_EXT_TYPE_NUNCHUCK;
    this.WIIREMOTE_EXT_TYPE_BALANCEBOARD = WIIREMOTE_EXT_TYPE_BALANCEBOARD;

    this.WIIREMOTE_REPORTID_BTNS = WIIREMOTE_REPORTID_BTNS;
    this.WIIREMOTE_REPORTID_BTNS_ACC = WIIREMOTE_REPORTID_BTNS_ACC;
    this.WIIREMOTE_REPORTID_BTNS_EXT8 = WIIREMOTE_REPORTID_BTNS_EXT8;
    this.WIIREMOTE_REPORTID_BTNS_ACC_IR12 = WIIREMOTE_REPORTID_BTNS_ACC_IR12;
    this.WIIREMOTE_REPORTID_BTNS_EXT19 = WIIREMOTE_REPORTID_BTNS_EXT19;
    this.WIIREMOTE_REPORTID_BTNS_ACC_EXT16 = WIIREMOTE_REPORTID_BTNS_ACC_EXT16;
    this.WIIREMOTE_REPORTID_BTNS_IR10_EXT9 = WIIREMOTE_REPORTID_BTNS_IR10_EXT9;
    this.WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6 = WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6;
    this.WIIREMOTE_REPORTID_EXT21 = WIIREMOTE_REPORTID_EXT21;

    this.isconnected = false;
    this.g_wait_report_type = -1;
    this.cur_rumble_led = 0x00;

    var BtL2capHid = binding.BtL2capHid;
    inherits(BtL2capHid, EventEmitter);

    this.l2cap = new BtL2capHid();
    this.l2cap.on('error', (error) => {
      console.error('l2cap.error', error);
    });
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

  async readBalanceBoardCalibration(){
    var value = await this.readRegisterLong(WIIREMOTE_ADDRESS_BALANCE_CALIBRATION, 0x20);
    return this.parseBalanceBoardCalibration(value);
  }

  parseExtension(type, data){
    if( type == WIIREMOTE_EXT_TYPE_NUNCHUCK ){
      var value = {
        stk_x: data[0],
        stk_y: data[1],
        acc_x: (data[2] << 2) | ((data[5] >> 2) & 0x03),
        acc_y: (data[3] << 2) | ((data[5] >> 4) & 0x03),
        acc_z: (data[4] << 2) | ((data[5] >> 6) & 0x03),
        btns: (~data[5] & 0x03),
      }
      return value;
    }else
    if( type == WIIREMOTE_EXT_TYPE_BALANCEBOARD ){
      var value = {
        topright: (data[0] << 8) | data[1],
        bottomright: (data[2] << 8) | data[3],
        topleft: (data[4] << 8) | data[5],
        bottomleft: (data[6] << 8) | data[7],
      };
      if( data.length >= 11){
        value.temperature = data[8];
        value.battery = data[10];
      }
      return value;
    }else{
      throw 'Unknown type';
    }
  }

  parseReporting(data){
    if( data[0] == WIIREMOTE_REPORTID_STATUS ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        leds: data[3] & 0xf0,
        flags: data[3] & 0x0f,
        battery: data[6]
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_READ_DATA ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        size: (data[3] >> 4) & 0x0f + 1,
        error: data[3] & 0x0f,
        address: (data[4] << 8) | data[5],
        data: data.slice(6)
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_ACK ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        report: data[3],
        error: data[4]
      };
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS ){
      var report = {
        report_id: data[0],
        btns: ((data[1] << 8) | data[2]),
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS_ACC ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        acc_x: (data[3] << 2) | ((data[1] >> 5) & 0x03),
        acc_y: (data[4] << 1) | ((data[2] >> 5) & 0x01),
        acc_z: (data[5] << 1) | ((data[2] >> 6) & 0x01),
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS_EXT8 ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        extension: data.slice(3)
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS_ACC_IR12 ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        acc_x: (data[3] << 2) | ((data[1] >> 5) & 0x03),
        acc_y: (data[4] << 1) | ((data[2] >> 5) & 0x01),
        acc_z: (data[5] << 1) | ((data[2] >> 6) & 0x01),
        ir: data.slice(6),
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS_EXT19 ){
      var report = {
        report_id: data[0],
        btns: ((data[1] << 8) | data[2]),
        extension: data.slice(3),
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS_ACC_EXT16 ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        acc_x: (data[3] << 2) | ((data[1] >> 5) & 0x03),
        acc_y: (data[4] << 1) | ((data[2] >> 5) & 0x01),
        acc_z: (data[5] << 1) | ((data[2] >> 6) & 0x01),
        extension: data.slice(6),
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS_IR10_EXT9 ){
      var report = {
        report_id: data[0],
        btns: (((data[1] << 8) | data[2])) & 0x1f9f,
        ir: data.slice(3, 3 + 10),
        extension: data.slice(3 + 10),
      };
      return report;
    }else
    if( data[0] == WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6 ){
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
    }else
    if( data[0] == WIIREMOTE_REPORTID_EXT21 ){
      var report = {
        report_id: data[0],
        extension: data
      };
      return report;
    }else
    if( data[0] == 0x3e || data[0] == 0x0f ){
      throw "not supported";
    }else{
      throw "unknown";
    }
  }

  addr2bin(address){
    return Buffer.from(address.split(':').reverse().join(''), 'hex');
  }
  
  addr2str(address){
    return address.toString('hex').match(/.{1,2}/g).reverse().join(':');
  }

  connect(addr, retry = 2){
    console.log('connect called');
    return new Promise((resolve, reject) =>{
      this.l2cap.connect(addr, retry, (err, result) =>{
        if( err )
          return reject(err);
        
        this.isconnected = true;
        this.startContinuousRead();
        resolve(result);
      });
    })
  }

  disconnect(){
    console.log('disconnect called');
    this.l2cap.disconnect();
    this.isconnected = false;
  }

  async readAsync(){
    return new Promise((resolve, reject) =>{
      this.l2cap.read((err, data) => {
        if (err)
          return reject(err);
        resolve(data);
      });
    });
  }

  startContinuousRead(){
    console.log('startContinuousRead called');
    return new Promise(async (resolve, reject) =>{
      do{
        try{
          if( !this.isconnected ){
            this.emit("error", "disconnected");
            return resolve("disconnected");
          }

          var result = await this.readAsync();
          if( this.g_wait_report_type >= 0 && result[0] == 0xa1 && this.g_wait_report_type == result[1]){
            if( result[1] == WIIREMOTE_REPORTID_ACK && result[5] != 0x00 ){
              var callback = this.g_wait_cb_failed;
              this.stop_cb();
              if( callback )
                callback(result[5]);
            }else{
              var callback = this.g_wait_cb_success;
              this.stop_cb();
              if( callback )
                callback(result.slice(1));
            }
          }else{
            this.emit("data", result.slice(1));
          }
        }catch(error){
          console.error(error);
          this.emit("error", error);
          await wait_async(1000);
        }
      }while(true);
    });
  }

  start_cb(type, success, failed, msec){
    if( this.g_wait_timer ){
      clearTimeout(this.g_wait_timer);
      this.g_wait_timer = null;

    }

    this.g_wait_cb_success = success;
    this.g_wait_cb_failed = failed;
    this.g_wait_report_type = type;

    this.g_wait_timer = setTimeout(() =>{
      var callback = this.g_wait_cb_failed;
      this.g_wait_timer = null;
      this.g_wait_cb_success = null;
      this.g_wait_cb_failed = null;
      this.g_wait_report_type = -1;
      if( callback )
        callback("wait_cb timeout");
    }, msec);
  }

  stop_cb(){
    if( this.g_wait_timer ){
      clearTimeout(this.g_wait_timer);
      this.g_wait_timer = null;
    }
    this.g_wait_cb_success = null;
    this.g_wait_cb_failed = null;
    this.g_wait_report_type = -1;
  }

  async writevalue(value){
    var param = Buffer.alloc(1 + value.length);

    param.writeUInt8(0xa2, 0);
    value.copy(param, 1);

    console.log('writevalue:' + param.toString('hex'));
    await this.l2cap.write(0, param);
    return wait_async(WRITE_WAIT);
  }

  async setReport( id, value ){
    var param = Buffer.alloc(3);

    param.writeUInt8(0xa2, 0);
    param.writeUInt8(id, 1);
    param.writeUInt8(value, 2);

    console.log('setReport:' + param.toString('hex'));
    await this.l2cap.write(0, param);
    return wait_async(WRITE_WAIT);
  }

  setLed(led_mask, led_val){
    this.cur_rumble_led = ( this.cur_rumble_led & ~( led_mask & WIIREMOTE_LED_MASK ) ) | ( led_val & WIIREMOTE_LED_MASK );
	
    return this.setReport(WIIREMOTE_REPORTID_LED, this.cur_rumble_led);  
  }

  setRumble( rumble ){
  	this.cur_rumble_led = ( this.cur_rumble_led & ~WIIREMOTE_RUMBLE_MASK ) | ( rumble & WIIREMOTE_RUMBLE_MASK );

    return this.setReport(WIIREMOTE_REPORTID_LED, cur_rumble_led);
  }

  setDataReportingMode(mode){
    var param = Buffer.alloc(4);
    param.writeUInt8(0xa2, 0);
    param.writeUInt8(WIIREMOTE_REPORTID_REPORTINGMODE, 1);
    param.writeUInt8(0x00, 2);
    param.writeUInt8(mode, 3);

    console.log('setDataReportingMode:' + param.toString('hex'));
    return this.l2cap.write(0, param);
  }

  async readRegisterLong(offset, len){
    var offset_index = offset;
    var data = await this.readRegister(offset_index, 0x10 );
    var value = this.parseReporting(data).data;
    while(len > 0x10 ){
      len -= 0x10;
      offset_index += 0x10;
      var v = await this.readRegister(offset_index, 0x10 );
      var d = this.parseReporting(v).data;
      value = Buffer.concat([value, d]);
    }

    return { offset: offset, value: value };
  }

  readRegister(offset, len){
    return new Promise((resolve, reject) =>{
      var param = Buffer.alloc(8);
      param.writeUInt8(0xa2, 0);
      param.writeUInt8(WIIREMOTE_REPORTID_READ, 1);
      param.writeUInt8(0x04, 2);
      param.writeUInt8(( offset >> 16 ) & 0xff, 3);
      param.writeUInt8(( offset >> 8 ) & 0xff, 4);
      param.writeUInt8(( offset >> 0 ) & 0xff, 5);
      param.writeUInt16BE(len, 6);

      this.start_cb(WIIREMOTE_REPORTID_READ_DATA, resolve, reject, CB_TIMEOUT);
      
      console.log('readRegister:' + param.toString('hex'));
      this.l2cap.write(0, param);
    });
  }
  
  writeRegister(offset, bin){
    return new Promise((resolve, reject) =>{
      var param = Buffer.alloc(7 + 16);
      param.writeUInt8(0xa2, 0);
      param.writeUInt8(WIIREMOTE_REPORTID_WRITE, 1);
      param.writeUInt8(0x04, 2);
      param.writeUInt8(( offset >> 16 ) & 0xff, 3);
      param.writeUInt8(( offset >> 8 ) & 0xff, 4);
      param.writeUInt8(( offset >> 0 ) & 0xff, 5);
      param.writeUInt8(bin.length, 6);
      bin.copy(param, 7);
  
      this.start_cb(WIIREMOTE_REPORTID_ACK, resolve, reject, CB_TIMEOUT);

      console.log('writeRegister:' + param.toString('hex'));
      this.l2cap.write(1, param);
    });
  }

  async enableSound(enable){
    if( enable ){
      var control = Buffer.from([0x00, 0x00, 0xD0, 0x07, 0x60, 0x00, 0x00 ]); /* 3000Hz 4-bit PCM */
      var control = Buffer.from([0x00, 0x40, 0x70, 0x17, 0x60, 0x00, 0x00 ]); /* 2000Hz 8-bit PCM */

      await this.setReport(WIIREMOTE_REPORTID_SPEAKER_ENABLE, 0x04);
      await this.setReport(WIIREMOTE_REPORTID_SPEAKER_MUTE, 0x04);
      await this.writeRegister(0xa20009, Buffer.from([0x01]));
      await this.writeRegister(0xa20001, Buffer.from([0x08]));
      await this.writeRegister(0xa20001, control);
      await this.writeRegister(0xa20008, Buffer.from([0x01]));
      await this.setReport(WIIREMOTE_REPORTID_SPEAKER_MUTE, 0x00);
    }else{
      await this.setReport(WIIREMOTE_REPORTID_SPEAKER_MUTE, 0x04);
      await this.writeRegister(0xa20009, Buffer.from([0x00]));
      await this.writeRegister(0xa20001, Buffer.from([0x00]));
      await this.setReport(WIIREMOTE_REPORTID_SPEAKER_ENABLE, 0x00);
    }
  }

  writeSound(value){
    var param = Buffer.alloc(23);
    param.writeUInt8(0xa2, 0);
    param.writeUInt8(WIIREMOTE_REPORTID_SPEAKER_DATA, 1);
    param.writeUInt8(value.length << 3, 2);
    value.copy(param, 3);

    console.log('writeSound:' + param.toString('hex'));
    return this.l2cap.write(0, param);
  }

  requestStatus(){
    return new Promise((resolve, reject) =>{
      var param = Buffer.alloc(3);
      param.writeUInt8(0xa2, 0);
      param.writeUInt8(WIIREMOTE_REPORTID_STATUS_REQUEST, 1);
      param.writeUInt8(0x00, 2);

      this.start_cb(WIIREMOTE_REPORTID_STATUS, resolve, reject, CB_TIMEOUT);

      console.log('requestStatus:' + param.toString('hex'));
      this.l2cap.write(0, param);
    });
  }

  async enableExtension(enable){
    if( enable ){
      await this.writeRegister(0xa400f0, Buffer.from([0x55]));
      await this.writeRegister(0xa400fb, Buffer.from([0x00]));
    }else{
      await this.writeRegister(0xa400f0, Buffer.from([0x00]));
    }
  }
}

async function wait_async(msec){
  return new Promise(resolve => setTimeout(resolve, msec) );
};

module.exports = WiiRemocon;