#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include "BLE2902.h"
#include "BLEHIDDevice.h"
#include "HIDTypes.h"
#include "HIDKeyboardTypes.h"
#include <driver/adc.h>
#include "sdkconfig.h"

#include "BleConnectionStatus.h"
#include "BleGamepad.h"

#if defined(CONFIG_ARDUHAL_ESP_LOG)
  #include "esp32-hal-log.h"
  #define LOG_TAG ""
#else
  #include "esp_log.h"
  static const char* LOG_TAG = "BLEDevice";
#endif

static const uint8_t _hidReportDescriptor[] = {
  USAGE_PAGE(1),       0x05, // USAGE_PAGE (Generic Desktop)
  USAGE(1),            0x05, // USAGE (Gamepad)
  COLLECTION(1),       0x01, // COLLECTION (Application)
  USAGE(1),            0x01, //   USAGE (Pointer)
  COLLECTION(1),       0x00, //   COLLECTION (Physical)

  // ------------------------------------------------- Buttons (1 to 32)
  USAGE_PAGE(1),       0x09, //     USAGE_PAGE (Button)
  USAGE_MINIMUM(1),    0x01, //     USAGE_MINIMUM (Button 1)
  USAGE_MAXIMUM(1),    0x20, //     USAGE_MAXIMUM (Button 32)
  LOGICAL_MINIMUM(1),  0x00, //     LOGICAL_MINIMUM (0)
  LOGICAL_MAXIMUM(1),  0x01, //     LOGICAL_MAXIMUM (1)
  REPORT_SIZE(1),      0x01, //     REPORT_SIZE (1)
  REPORT_COUNT(1),     0x20, //     REPORT_COUNT (32)
  HIDINPUT(1),         0x02, //     INPUT (Data, Variable, Absolute) ;32 button bits
  // ------------------------------------------------- X/Y position, Z/rZ position
  USAGE_PAGE(1), 	   0x01, //		USAGE_PAGE (Generic Desktop)
  COLLECTION(1), 	   0x00, //		COLLECTION (Physical)
  USAGE(1), 		   0x30, //     USAGE (X)
  USAGE(1), 		   0x31, //     USAGE (Y)
  USAGE(1), 		   0x32, //     USAGE (Z)
  USAGE(1), 		   0x35, //     USAGE (rZ)
  0x16, 			   0x01, 0x80,//LOGICAL_MINIMUM (-32767)
  0x26, 			   0xFF, 0x7F,//LOGICAL_MAXIMUM (32767)
  REPORT_SIZE(1), 	   0x10, //		REPORT_SIZE (16)
  REPORT_COUNT(1), 	   0x04, //		REPORT_COUNT (4)
  HIDINPUT(1), 		   0x02, //     INPUT (Data,Var,Abs) ;8 bytes (X,Y,Z,rZ)
  // ------------------------------------------------- Triggers
  USAGE(1),            0x33, //     USAGE (rX) Left Trigger
  USAGE(1),            0x34, //     USAGE (rY) Right Trigger
  LOGICAL_MINIMUM(1),  0x81, //     LOGICAL_MINIMUM (-127)
  LOGICAL_MAXIMUM(1),  0x7f, //     LOGICAL_MAXIMUM (127)
  REPORT_SIZE(1),      0x08, //     REPORT_SIZE (8)
  REPORT_COUNT(1),     0x02, //     REPORT_COUNT (2)
  HIDINPUT(1),         0x02, //     INPUT (Data, Variable, Absolute) ;2 bytes (rX,rY)
  END_COLLECTION(0),		 //     END_COLLECTION
  
  USAGE_PAGE(1),       0x01, //     USAGE_PAGE (Generic Desktop)
  USAGE(1),            0x39, //     USAGE (Hat switch)
  USAGE(1),            0x39, //     USAGE (Hat switch)
  LOGICAL_MINIMUM(1),  0x01, //     LOGICAL_MINIMUM (1)
  LOGICAL_MAXIMUM(1),  0x08, //     LOGICAL_MAXIMUM (8)
  REPORT_SIZE(1),      0x04, //     REPORT_SIZE (4)
  REPORT_COUNT(1),     0x02, //     REPORT_COUNT (2)
  HIDINPUT(1),         0x02, //     INPUT (Data, Variable, Absolute) ;1 byte Hat1, Hat2

  END_COLLECTION(0),         //     END_COLLECTION
  END_COLLECTION(0)          //     END_COLLECTION
};

BleGamepad::BleGamepad(std::string deviceName, std::string deviceManufacturer, uint8_t batteryLevel) :
  _buttons(0),
  hid(0)
{
  this->deviceName = deviceName;
  this->deviceManufacturer = deviceManufacturer;
  this->batteryLevel = batteryLevel;
  this->connectionStatus = new BleConnectionStatus();

  _buttons = 0;
  _x = _y = _z = _rX = _rY = _rZ = 0;
  _hat = 0;
}

void BleGamepad::begin(void)
{
  xTaskCreate(this->taskServer, "server", 25000, (void *)this, 5, NULL);
}

void BleGamepad::end(void)
{
}

void BleGamepad::sendStatus(void)
{
  if (this->isConnected())
  {
    m[0] = _buttons;
    m[1] = (_buttons >> 8);
    m[2] = (_buttons >> 16);
    m[3] = (_buttons >> 24);
    m[4] = _x;
    m[5] = (_x >> 8);
    m[6] = _y;
    m[7] = (_y >> 8);
    m[8] = _z;
    m[9] = (_z >> 8);
    m[10] = _rZ;
    m[11] = (_rZ >> 8);
    m[12] = (signed char)(_rX - 128);
    m[13] = (signed char)(_rY - 128);
    m[14] = _hat;
    if (m[12] == -128) { m[12] = -127; }
    if (m[13] == -128) { m[13] = -127; }

    this->inputGamepad->setValue(m, sizeof(m));
    this->inputGamepad->notify();
  }
}

void BleGamepad::setButtons(uint32_t b){
  _buttons = b;
}

void BleGamepad::setAxes(int16_t x, int16_t y, int16_t z, int16_t rZ, char rX, char rY, signed char hat)
{
	if(x == -32768) { x = -32767; }
	if(y == -32768) { y = -32767; }
	if(z == -32768) { z = -32767; }
	if(rZ == -32768) { rZ = -32767; }

  _x = x;
  _y = y;
  _z = z;
  _rZ = rZ;
  _rX = rX;
  _rY = rY;
}

void BleGamepad::buttons(uint32_t b)
{
  if (b != _buttons)
  {
    _buttons = b;
    setAxes(0, 0, 0, 0, 0, 0, 0);
  }
}

void BleGamepad::press(uint32_t b)
{
  buttons(_buttons | b);
}

void BleGamepad::release(uint32_t b)
{
  buttons(_buttons & ~b);
}

bool BleGamepad::isPressed(uint32_t b)
{
  if ((b & _buttons) > 0)
    return true;
  return false;
}

bool BleGamepad::isConnected(void) {
  return this->connectionStatus->connected;
}

void BleGamepad::setBatteryLevel(uint8_t level) {
  this->batteryLevel = level;
  if (hid != 0)
    this->hid->setBatteryLevel(this->batteryLevel);
}

void BleGamepad::taskServer(void* pvParameter) {
  BleGamepad* BleGamepadInstance = (BleGamepad *) pvParameter; //static_cast<BleGamepad *>(pvParameter);
  BLEDevice::init(BleGamepadInstance->deviceName);
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(BleGamepadInstance->connectionStatus);

  BleGamepadInstance->hid = new BLEHIDDevice(pServer);
  BleGamepadInstance->inputGamepad = BleGamepadInstance->hid->inputReport(0); // <-- input REPORTID from report map
  BleGamepadInstance->connectionStatus->inputGamepad = BleGamepadInstance->inputGamepad;

  BleGamepadInstance->hid->manufacturer()->setValue(BleGamepadInstance->deviceManufacturer);

  BleGamepadInstance->hid->pnp(0x01,0x02e5,0xabcc,0x0110);
  BleGamepadInstance->hid->hidInfo(0x00,0x01);

  BLESecurity *pSecurity = new BLESecurity();

  pSecurity->setAuthenticationMode(ESP_LE_AUTH_BOND);

  BleGamepadInstance->hid->reportMap((uint8_t*)_hidReportDescriptor, sizeof(_hidReportDescriptor));
  BleGamepadInstance->hid->startServices();

  BleGamepadInstance->onStarted(pServer);

  BLEAdvertising *pAdvertising = pServer->getAdvertising();
  pAdvertising->setAppearance(HID_GAMEPAD);
  pAdvertising->addServiceUUID(BleGamepadInstance->hid->hidService()->getUUID());
  pAdvertising->start();
  BleGamepadInstance->hid->setBatteryLevel(BleGamepadInstance->batteryLevel);

  ESP_LOGD(LOG_TAG, "Advertising started!");
  vTaskDelay(portMAX_DELAY); //delay(portMAX_DELAY);
}
