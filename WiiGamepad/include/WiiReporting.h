#ifndef _WII_REPORTING_H_
#define _WII_REPORTING_H_

#define WIIREMOTE_CMD_EVT 0

#define WIIREMOTE_REPORTID_RUMBLE 0x10
#define WIIREMOTE_REPORTID_LED 0x11
#define WIIREMOTE_REPORTID_REPORTINGMODE 0x12
#define WIIREMOTE_REPORTID_IR_ENABLE 0x13
#define WIIREMOTE_REPORTID_SPEAKER_ENABLE 0x14
#define WIIREMOTE_REPORTID_STATUS_REQUEST 0x15
#define WIIREMOTE_REPORTID_WRITE 0x16
#define WIIREMOTE_REPORTID_READ 0x17
#define WIIREMOTE_REPORTID_SPEAKER_DATA 0x18
#define WIIREMOTE_REPORTID_SPEAKER_MUTE 0x19
#define WIIREMOTE_REPORTID_IR2_ENABLE 0x1a
#define WIIREMOTE_REPORTID_STATUS 0x20
#define WIIREMOTE_REPORTID_READ_DATA 0x21
#define WIIREMOTE_REPORTID_ACK 0x22
#define WIIREMOTE_REPORTID_BTNS 0x30
#define WIIREMOTE_REPORTID_BTNS_ACC 0x31
#define WIIREMOTE_REPORTID_BTNS_EXT8 0x32
#define WIIREMOTE_REPORTID_BTNS_ACC_IR12 0x33
#define WIIREMOTE_REPORTID_BTNS_EXT19 0x34
#define WIIREMOTE_REPORTID_BTNS_ACC_EXT16 0x35
#define WIIREMOTE_REPORTID_BTNS_IR10_EXT9 0x36
#define WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6 0x37
#define WIIREMOTE_REPORTID_EXT21 0x3d

#define WIIREMOTE_EXT_TYPE_NUNCHUCK 0x01
#define WIIREMOTE_EXT_TYPE_BALANCEBOARD 0x02

typedef struct _wii_extension{
  int type;
  union{
    struct{
      uint8_t stk_x;
      uint8_t stk_y;
      uint16_t acc_x;
      uint16_t acc_y;
      uint16_t acc_z;
      uint8_t btns;
    } nunchuck;
    struct{
      uint16_t topright;
      uint16_t bottomright;
      uint16_t topleft;
      uint16_t bottomleft;
      uint8_t temperature;
      uint8_t battery;
    } balanceboard;
  };
} WII_EXTENSION;


typedef struct _wii_report{
  uint8_t report_id;
  union{
    struct{
      uint16_t btns;
      uint8_t leds;
      uint8_t flags;
      uint8_t battery;
    } status;
    struct{
      uint16_t btns;
      uint8_t size;
      uint8_t error;
      uint16_t address;
      uint8_t data[16];
    } read_data;
    struct{
      uint16_t btns;
      uint8_t report;
      uint8_t error;
    } ack;
    struct{
      uint16_t btns;
    } btns;
    struct{
      uint16_t btns;
      uint16_t acc_x;
      uint16_t acc_y;
      uint16_t acc_z;
    } btns_acc;
    struct{
      uint16_t btns;
      uint8_t extension[8];
    } btns_ext8;
    struct{
      uint16_t btns;
      uint16_t acc_x;
      uint16_t acc_y;
      uint16_t acc_z;
      uint8_t ir[12];
    } btns_acc_ir12;
    struct{
      uint16_t btns;
      uint8_t extension[19];
    } btns_ext19;
    struct{
      uint16_t btns;
      uint16_t acc_x;
      uint16_t acc_y;
      uint16_t acc_z;
      uint8_t extension[16];
    } btns_acc_ext16;
    struct{
      uint16_t btns;
      uint8_t ir[10];
      uint8_t extension[9];
    } btns_ir10_ext9;
    struct{
      uint16_t btns;
      uint16_t acc_x;
      uint16_t acc_y;
      uint16_t acc_z;
      uint8_t ir[10];
      uint8_t extension[6];
    } btns_acc_ir10_ext6;
    struct{
      uint8_t extension[21];
    } ext21;
  };
} WII_REPORT;

#endif