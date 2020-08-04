#ifndef ___BT_L2CAP_HID_H___
#define ___BT_L2CAP_HID_H___

#include <map>
#include <node.h>
#include <nan.h>

class BtL2capHid : public node::ObjectWrap {

public:
  static NAN_MODULE_INIT(Init);

  static NAN_METHOD(New);
  static NAN_METHOD(Connect);
  static NAN_METHOD(Write);
  static NAN_METHOD(Read);

  int _socket_11;
  int _socket_13;

private:
  BtL2capHid();
  ~BtL2capHid();

  void writeSync(int index, char* data, int length);
  void emitErrnoError();

private:
  Nan::Persistent<v8::Object> This;

  static Nan::Persistent<v8::FunctionTemplate> constructor_template;
};

#endif
