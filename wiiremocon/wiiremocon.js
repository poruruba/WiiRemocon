'use strict';

var EventEmitter = require('events').EventEmitter;

var binding = require('./build/Release/binding.node');

const WIIREMOTE_RUMBLE_MASK = 0x01;
const WIIREMOTE_LED_MASK = 0xf0;

class WiiRemocon extends EventEmitter{
  constructor(){
    super();

    this.WIIREMOTE_LED_BIT0 = 0x80;
    this.WIIREMOTE_LED_BIT1 = 0x40;
    this.WIIREMOTE_LED_BIT2 = 0x20;
    this.WIIREMOTE_LED_BIT3 = 0x10;

    this.cur_rumble_led = 0x00;
    this.l2cap = new binding.BtL2capHid();
  }

  addr2bin(address){
    return Buffer.from(address.split(':').reverse().join(''), 'hex');
  }
  
  addr2str(address){
    return address.toString('hex').match(/.{1,2}/g).reverse().join(':');
  }

  connect(addr, retry = 2){
    console.log('connect');
    return new Promise((resolve, reject) =>{
      this.l2cap.connect(addr, retry, (err, result) =>{
        if( err )
          return reject(err);
        
        this.startRead();
        resolve(result);
      });
    })
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

  startRead(){
    console.log('startRead');
    return new Promise(async (resolve, reject) =>{
      do{
        try{
          var result = await this.readAsync();
          this.emit("data", result);
        }catch(error){
          console.error(error);
          return resolve(error);
        }
      }while(true);
    });
  }

  setReport( id, value ){
    console.log('setReport called');
    var param = Buffer.alloc(3);

    param.writeUInt8(0xa2, 0);
    param.writeUInt8(id, 1);
    param.writeUInt8(value, 2);

    console.log('setReport:' + param.toString('hex'));
    return this.l2cap.write(0, param);
  }

  setLed(led_mask, led_val){
    this.cur_rumble_led = ( this.cur_rumble_led & ~( led_mask & WIIREMOTE_LED_MASK ) ) | ( led_val & WIIREMOTE_LED_MASK );
	
    return this.setReport(0x11, this.cur_rumble_led);  
  }

  setRumble( rumble ){
  	this.cur_rumble_led = ( this.cur_rumble_led & ~WIIREMOTE_RUMBLE_MASK ) | ( rumble & WIIREMOTE_RUMBLE_MASK );

    return this.setReport(0x11, cur_rumble_led);
  }

  setDataReportingMode(mode){
    var param = Buffer.alloc(4);
    param.writeUInt8(0xa2, 0);
    param.writeUInt8(0x12, 1);
    param.writeUInt8(0x00, 2);
    param.writeUInt8(mode, 3);

    console.log('setDataReportingMode:' + param.toString('hex'));
    return this.l2cap.write(0, param);
  }
}

module.exports = WiiRemocon;