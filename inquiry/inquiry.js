var debug = require('debug')('./inquiry');

var events = require('events');
var util = require('util');

//var BluetoothHciSocket = require('bluetooth-hci-socket');
var BluetoothHciSocket = require('@abandonware/bluetooth-hci-socket');

var HCI_COMMAND_PKT = 0x01;
var HCI_EVENT_PKT = 0x04;

var EVT_INQUIRY_COMPLETE = 0x01;
var EVT_INQUIRY_RESULT = 0x02;
var EVT_CMD_COMPLETE = 0x0e;
var EVT_CMD_STATUS = 0x0f;

var OGF_LINK_CTL = 0x01;
var OCF_INQUIRY = 0x0001;

var OGF_HOST_CTL = 0x03;
var OCF_SET_EVENT_MASK = 0x0001;
var OCF_RESET = 0x0003;

var OGF_INFO_PARAM = 0x04;
var OCF_READ_LOCAL_VERSION = 0x0001;
var OCF_READ_BD_ADDR = 0x0009;

var OGF_STATUS_PARAM = 0x05;
var OCF_READ_RSSI = 0x0005;

var INQUIRY_CMD = OCF_INQUIRY | OGF_LINK_CTL << 10;

var SET_EVENT_MASK_CMD = OCF_SET_EVENT_MASK | OGF_HOST_CTL << 10;
var RESET_CMD = OCF_RESET | OGF_HOST_CTL << 10;

var READ_LOCAL_VERSION_CMD = OCF_READ_LOCAL_VERSION | (OGF_INFO_PARAM << 10);
var READ_BD_ADDR_CMD = OCF_READ_BD_ADDR | (OGF_INFO_PARAM << 10);

var READ_RSSI_CMD = OCF_READ_RSSI | OGF_STATUS_PARAM << 10;

var STATUS_MAPPER = require('./hci-status');

var Inquiry = function() {
  this._socket = new BluetoothHciSocket();
  this._deviceId = null;

  this._handleBuffers = {};
};

util.inherits(Inquiry, events.EventEmitter);

Inquiry.STATUS_MAPPER = STATUS_MAPPER;

Inquiry.prototype.addr2bin = function(address){
  return Buffer.from(address.split(':').reverse().join(''), 'hex');
};

Inquiry.prototype.addr2str = function(address){
  return address.toString('hex').match(/.{1,2}/g).reverse().join(':');
};

Inquiry.prototype.stop = function(){
  debug('inquiry stop called');

  this._socket.stop();
}

Inquiry.prototype.init = function() {
  debug('inquiry init called');

  this._socket.on('data', this.onSocketData.bind(this));
  this._socket.on('error', this.onSocketError.bind(this));

  var deviceId = process.env.INQUIRY_HCI_DEVICE_ID ? parseInt(process.env.INQUIRY_HCI_DEVICE_ID, 10) : undefined;

  this._deviceId = this._socket.bindRaw(deviceId);
  this._socket.start();

  this.setSocketFilter();
  this.reset();
};

Inquiry.prototype.setSocketFilter = function() {
  var filter = new Buffer(14);
  var typeMask = (1 << HCI_EVENT_PKT);
  var eventMask1 = (1 << EVT_INQUIRY_COMPLETE) | (1 << EVT_INQUIRY_RESULT) | (1 << EVT_CMD_COMPLETE) | (1 << EVT_CMD_STATUS);
  var eventMask2 = 0;
  var opcode = 0;

  filter.writeUInt32LE(typeMask, 0);
  filter.writeUInt32LE(eventMask1, 4);
  filter.writeUInt32LE(eventMask2, 8);
  filter.writeUInt16LE(opcode, 12);

  debug('setting filter to: ' + filter.toString('hex'));
  this._socket.setFilter(filter);
};

Inquiry.prototype.setEventMask = function() {
  var cmd = new Buffer(12);
  var eventMask = new Buffer('fffffbff07f8bf3d', 'hex');

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(SET_EVENT_MASK_CMD, 1);

  // length
  cmd.writeUInt8(eventMask.length, 3);

  eventMask.copy(cmd, 4);

  debug('set event mask - writing: ' + cmd.toString('hex'));
  this._socket.write(cmd);
};

Inquiry.prototype.reset = function() {
  debug('inquiry reset called');

    var cmd = new Buffer(4);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(OCF_RESET | OGF_HOST_CTL << 10, 1);

  // length
  cmd.writeUInt8(0x00, 3);

  debug('reset - writing: ' + cmd.toString('hex'));
  this._socket.write(cmd);
};

Inquiry.prototype.readLocalVersion = function() {
  var cmd = new Buffer(4);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(READ_LOCAL_VERSION_CMD, 1);

  // length
  cmd.writeUInt8(0x0, 3);

  debug('read local version - writing: ' + cmd.toString('hex'));
  this._socket.write(cmd);
};

Inquiry.prototype.readBdAddr = function() {
  var cmd = new Buffer(4);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(READ_BD_ADDR_CMD, 1);

  // length
  cmd.writeUInt8(0x0, 3);

  debug('read bd addr - writing: ' + cmd.toString('hex'));
  this._socket.write(cmd);
};

Inquiry.prototype.inquiry = function(duration, num) {
  debug('hci.inquiry called');

  var cmd = new Buffer(4 + 5);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(INQUIRY_CMD, 1);

  // length
  cmd.writeUInt8(5, 3);

  // data
  cmd.writeUInt8(0x33, 4);
  cmd.writeUInt8(0x8B, 5);
  cmd.writeUInt8(0x9E, 6);
  cmd.writeUInt8(duration, 7);
  cmd.writeUInt8(num, 8);

  debug('inquiry - writing: ' + cmd.toString('hex'));
  this._socket.write(cmd);
};

Inquiry.prototype.readRssi = function(handle) {
  var cmd = new Buffer(4 + 2);

  // header
  cmd.writeUInt8(HCI_COMMAND_PKT, 0);
  cmd.writeUInt16LE(READ_RSSI_CMD, 1);

  // length
  cmd.writeUInt8(2, 3);

  // data
  cmd.writeUInt16LE(handle, 4); // handle

  debug('read rssi - writing: ' + cmd.toString('hex'));
  this._socket.write(cmd);
};

Inquiry.prototype.onSocketData = function(data) {
  debug('onSocketData: ' + data.toString('hex'));

  var eventType = data.readUInt8(0);
  var cmd;
  var status;

  debug('\tevent type = ' + eventType);

  if (HCI_EVENT_PKT === eventType) {
    var subEventType = data.readUInt8(1);

    debug('\tsub event type = ' + subEventType);

    if (subEventType === EVT_INQUIRY_COMPLETE) {
      debug('onSocketData: EVT_INQUIRY_COMPLETE');
      var status = data.readUInt8(3);

      debug('\t\tstatus = ' + status);
      this.emit('inquiryComplete', status);
    }else
    if (subEventType === EVT_INQUIRY_RESULT) {
      debug('onSocketData: EVT_INQUIRY_RESULT');
      var num_responses = data.readUInt8(3);
      debug('num_responses=' + num_responses);

      for( var i = 0 ; i < num_responses ; i++ ){
        var result = data.slice(4 + 6 * i, 4 + i * 6 + 6);
        var address = result.toString('hex').match(/.{1,2}/g).reverse().join(':');

        debug('RemoteAddress=' + address);
        this.emit('inquiryResult', address);
      }
    }else
    if (subEventType === EVT_CMD_COMPLETE) {
      debug("Receive: EVT_CMD_COMPLETE");
      cmd = data.readUInt16LE(4);
      status = data.readUInt8(6);
      var result = data.slice(7);

      debug('\t\tcmd = ' + cmd);
      debug('\t\tstatus = ' + status);
      debug('\t\tresult = ' + result.toString('hex'));

      this.processCmdCompleteEvent(cmd, status, result);
    } else if (subEventType === EVT_CMD_STATUS) {
      debug("Receive: EVT_CMD_STATUS");
      status = data.readUInt8(3);
      cmd = data.readUInt16LE(5);

      debug('\t\tstatus = ' + status);
      debug('\t\tcmd = ' + cmd);

      this.processCmdStatusEvent(cmd, status);
    }
  }
};

Inquiry.prototype.onSocketError = function(error) {
  debug('onSocketError: ' + error.message);

  if (error.message === 'Operation not permitted') {
    debug('emit stateChange unauthorized');
    this.emit('stateChange', 'unauthorized');
  } else if (error.message === 'Network is down') {
    // no-op
  }
};

Inquiry.prototype.processCmdCompleteEvent = function(cmd, status, result) {
  if (cmd === RESET_CMD) {
    debug('proc RESET_CMD');
    this.setEventMask();
    this.readLocalVersion();
    this.readBdAddr();
  } else if (cmd === READ_LOCAL_VERSION_CMD) {
    debug('proc READ_LOCAL_VERSION_CMD');
    var hciVer = result.readUInt8(0);
    var hciRev = result.readUInt16LE(1);
    var lmpVer = result.readInt8(3);
    var manufacturer = result.readUInt16LE(4);
    var lmpSubVer = result.readUInt16LE(6);

    if (hciVer < 0x06) {
      debug('emit stateChange unsupported');
      this.emit('stateChange', 'unsupported');
    }

    debug('emit readLocalVersion');
    this.emit('readLocalVersion', hciVer, hciRev, lmpVer, manufacturer, lmpSubVer);
  } else if (cmd === READ_BD_ADDR_CMD) {
    debug('proc READ_BD_ADDR_CMD');
    this.addressType = 'public';
    this.address = result.toString('hex').match(/.{1,2}/g).reverse().join(':');

    debug('LocalAddress = ' + this.address);

    debug('emit initialized');
    this.emit('initialized', this.address);
  } else if (cmd === READ_RSSI_CMD) {
    debug('proc READ_RSSI_CMD');
    var handle = result.readUInt16LE(0);
    var rssi = result.readInt8(2);

    debug('\t\t\thandle = ' + handle);
    debug('\t\t\trssi = ' + rssi);

    debug('emit rssiRead');
    this.emit('rssiRead', handle, rssi);
  }
};

Inquiry.prototype.processCmdStatusEvent = function(cmd, status) {
  debug("processCmdStatusEvent called");
};

module.exports = Inquiry;
