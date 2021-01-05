/*
 * This example turns the ESP32 into a Bluetooth LE gamepad that presses buttons and moves axis
 * 
 * Possible buttons are:
 * BUTTON_1 through to BUTTON_32 
 * 
 * Possible DPAD/HAT switch position values are: 
 * DPAD_CENTERED, DPAD_UP, DPAD_UP_RIGHT, DPAD_RIGHT, DPAD_DOWN_RIGHT, 
 * DPAD_DOWN, DPAD_DOWN_LEFT, DPAD_LEFT, DPAD_UP_LEFT
 * 
 * bleGamepad.setAxes takes the following int16_t parameters for the Left/Right Thumb X/Y, char for the Left/Right Triggers, and hat switch position as above: 
 * (Left Thumb X, Left Thumb Y, Right Thumb X, Right Thumb Y, Left Trigger, Right Trigger, Hat switch position);
 */

#include <WiFi.h>
#include <M5StickC.h>
#include "BleGamepad.h" 
#include <ArduinoJson.h>
#include <WiFiUdp.h>

WiFiUDP udp;

#define UDP_RECEVE_PORT   8000

const char* wifi_ssid = "【WiFiアクセスポイントのSID】";
const char* wifi_password = "【WiFiアクセスポイントのパスワード】";
#define MQTT_BUFFER_SIZE  1024 // MQTT送受信のバッファサイズ

// MQTT Subscribe用
const int message_capacity = JSON_OBJECT_SIZE(2) + JSON_OBJECT_SIZE(3);
StaticJsonDocument<message_capacity> json_message;
char message_buffer[MQTT_BUFFER_SIZE];

BleGamepad bleGamepad;

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

WII_EXTENSION parseExtension(int type, const uint8_t *data, uint8_t data_len){
  WII_EXTENSION extension;
  extension.type = type;
  if( type == WIIREMOTE_EXT_TYPE_NUNCHUCK ){
    extension.nunchuck.stk_x = data[0];
    extension.nunchuck.stk_y = data[1];
    extension.nunchuck.acc_x = (data[2] << 2) | ((data[5] >> 2) & 0x03);
    extension.nunchuck.acc_y = (data[3] << 2) | ((data[5] >> 4) & 0x03);
    extension.nunchuck.acc_z = (data[4] << 2) | ((data[5] >> 6) & 0x03);
    extension.nunchuck.btns = (~data[5] & 0x03);
    return extension;    
  }else if( type == WIIREMOTE_EXT_TYPE_BALANCEBOARD ){
    extension.balanceboard.topright = (data[0] << 8) | data[1];
    extension.balanceboard.bottomright = (data[2] << 8) | data[3];
    extension.balanceboard.topleft = (data[4] << 8) | data[5];
    extension.balanceboard.bottomleft = (data[6] << 8) | data[7];
    if (data_len >= 11) {
        extension.balanceboard.temperature = data[8];
        extension.balanceboard.battery = data[10];
    }
    return extension;
  } else {
//      throw "unknown";
  }

  return extension;
}

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

WII_REPORT parseReporting(const uint8_t *data){
  WII_REPORT report;
  report.report_id = data[0];
    if (data[0] == WIIREMOTE_REPORTID_STATUS) {
      report.status.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      report.status.leds = data[3] & 0xf0;
      report.status.flags = data[3] & 0x0f;
      report.status.battery = data[6];
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_READ_DATA) {
      report.read_data.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      report.read_data.size = ((data[3] >> 4) & 0x0f) + 1;
      report.read_data.error = data[3] & 0x0f;
      report.read_data.address = (data[4] << 8) | data[5];
      memmove(report.read_data.data, &data[6], sizeof(report.read_data.data));
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_ACK) {
      report.ack.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      report.ack.report = data[3];
      report.ack.error = data[4];
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS) {
      report.btns.btns = ((data[1] << 8) | data[2]);
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC) {
      report.btns_acc.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      report.btns_acc.acc_x = (data[3] << 2) | ((data[1] >> 5) & 0x03);
      report.btns_acc.acc_y = (data[4] << 1) | ((data[2] >> 5) & 0x01);
      report.btns_acc.acc_z = (data[5] << 1) | ((data[2] >> 6) & 0x01);
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_EXT8) {
      report.btns_ext8.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      memmove(report.btns_ext8.extension, &data[3], sizeof(report.btns_ext8.extension));
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC_IR12) {
      report.btns_acc_ir12.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      report.btns_acc_ir12.acc_x = (data[3] << 2) | ((data[1] >> 5) & 0x03);
      report.btns_acc_ir12.acc_y = (data[4] << 1) | ((data[2] >> 5) & 0x01);
      report.btns_acc_ir12.acc_z = (data[5] << 1) | ((data[2] >> 6) & 0x01);
      memmove(report.btns_acc_ir12.ir, &data[6], sizeof(report.btns_acc_ir12.ir));
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_EXT19) {
      report.btns_ext19.btns = ((data[1] << 8) | data[2]);
      memmove( report.btns_ext19.extension, &data[3], sizeof(report.btns_ext19.extension));
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC_EXT16) {
      report.btns_acc_ext16.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      report.btns_acc_ext16.acc_x = (data[3] << 2) | ((data[1] >> 5) & 0x03);
      report.btns_acc_ext16.acc_y = (data[4] << 1) | ((data[2] >> 5) & 0x01);
      report.btns_acc_ext16.acc_z = (data[5] << 1) | ((data[2] >> 6) & 0x01);
      memmove( report.btns_acc_ext16.extension, &data[6], sizeof(report.btns_acc_ext16.extension));
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_IR10_EXT9) {
      report.btns_ir10_ext9.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      memmove(report.btns_ir10_ext9.ir, &data[3], sizeof(report.btns_ir10_ext9.ir));
      memmove(report.btns_ir10_ext9.extension, &data[3 + 10], sizeof(report.btns_ir10_ext9.extension));
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_BTNS_ACC_IR10_EXT6) {
      report.btns_acc_ir10_ext6.btns = (((data[1] << 8) | data[2])) & 0x1f9f;
      report.btns_acc_ir10_ext6.acc_x = (data[3] << 2) | ((data[1] >> 5) & 0x03);
      report.btns_acc_ir10_ext6.acc_y = (data[4] << 1) | ((data[2] >> 5) & 0x01);
      report.btns_acc_ir10_ext6.acc_z = (data[5] << 1) | ((data[2] >> 6) & 0x01);
      memmove( report.btns_acc_ir10_ext6.ir, &data[6], sizeof(report.btns_acc_ir10_ext6.ir));
      memmove( report.btns_acc_ir10_ext6.extension, &data[6 + 10], sizeof(report.btns_acc_ir10_ext6.extension));
      return report;
    } else
    if (data[0] == WIIREMOTE_REPORTID_EXT21) {
      memmove(report.ext21.extension, &data[1], sizeof(report.ext21.extension));
      return report;
    } else
    if (data[0] == 0x3e || data[0] == 0x0f) {
//      throw "not supported";
    } else {
//      throw "unknown";
    }
  return report;
}

void wifi_connect(const char *ssid, const char *password){
  Serial.println("");
  Serial.print("WiFi Connenting");
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("");
  Serial.print("Connected : ");
  Serial.println(WiFi.localIP());
}

void setup() 
{
  Serial.begin(9600);
  Serial.println("Starting BLE work!");

  wifi_connect(wifi_ssid, wifi_password);
  bleGamepad.begin();
  udp.begin(UDP_RECEVE_PORT);
}

void loop() 
{
  if( udp.parsePacket() ){
    int len = udp.read(message_buffer, sizeof(message_buffer));
    if( len > 0 ){
      Serial.printf("received(%d) ", len);
      message_buffer[len] = '\0';
      Serial.printf("%s\n", message_buffer);
      DeserializationError err = deserializeJson(json_message, message_buffer, len);
      if( err ){
        Serial.println("Deserialize error");
        Serial.println(err.c_str());
        return;
      }

      int rsp = json_message["rsp"];
      if( rsp == WIIREMOTE_CMD_EVT ){
        uint8_t data[22];
        for( int i = 0 ; i < sizeof(data) ; i++ )
          data[i] = json_message["evt"][i]; 
        WII_REPORT report = parseReporting(data);
        if( report.report_id == WIIREMOTE_REPORTID_BTNS ){
          Serial.println(report.btns.btns);
          bleGamepad.setButtons(report.btns.btns);
        }else
        if( report.report_id == WIIREMOTE_REPORTID_BTNS_EXT8 ){
          WII_EXTENSION extension = parseExtension(WIIREMOTE_REPORTID_BTNS_EXT8, report.btns_ext8.extension, sizeof(report.btns_ext8.extension));
          bleGamepad.setAxes(extension.nunchuck.stk_x, extension.nunchuck.stk_y);
        }

        if(bleGamepad.isConnected()){
          bleGamepad.sendStatus();
        }
      }
    }
  }
}
