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

#include <M5StickC.h>
#include <WiFi.h>
#include <BleGamepad.h>
#include "WiiReporting.h"
#include <ArduinoJson.h>
#include <WiFiUdp.h>

const char* wifi_ssid = "【WiFiアクセスポイントのSID】";
const char* wifi_password = "【WiFiアクセスポイントのパスワード】";

#define UDP_RECEVE_PORT   8000 // UDP受信ポート番号
#define MQTT_BUFFER_SIZE  256 // MQTT送受信のバッファサイズ

const int message_capacity = JSON_OBJECT_SIZE(2) + JSON_ARRAY_SIZE(3);
StaticJsonDocument<message_capacity> json_message;
char message_buffer[MQTT_BUFFER_SIZE];

BleGamepad bleGamepad;
WiFiUDP udp;

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
  Serial.begin(115200);
  Serial.println("Starting BLE work!");

  wifi_connect(wifi_ssid, wifi_password);
  bleGamepad.begin();
  udp.begin(UDP_RECEVE_PORT);
}

uint32_t prev_buttons = 0;

void loop() 
{
  if( udp.parsePacket() ){
    int len = udp.read(message_buffer, sizeof(message_buffer));
    if( len > 0 && bleGamepad.isConnected() ){
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
          uint32_t diff = prev_buttons ^ report.btns.btns;
          bleGamepad.release(diff ^ (diff & report.btns.btns));
          bleGamepad.press(diff & report.btns.btns);
          prev_buttons = report.btns.btns;
        }else{
          Serial.println("Not support report id");
        }
      }
    }
  }
}
