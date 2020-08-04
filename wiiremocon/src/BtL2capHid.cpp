#include <errno.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#include <node_buffer.h>
#include <nan.h>

#include <bluetooth/bluetooth.h>
#include <bluetooth/l2cap.h>
#include "BtL2capHid.h"

#define L2CAP_BUFFER_SIZE 255

#define L2CAP_PSM_HID_CNTL              0x0011  /* HID Control */
#define L2CAP_PSM_HID_INTR              0x0013  /* HID Interrupt */

using namespace v8;

class ReadAsyncWorker : public Nan::AsyncWorker
{
public:
    ReadAsyncWorker(BtL2capHid* p, Nan::Callback* callback) : Nan::AsyncWorker(callback), p(p)
    {}

    // 非同期処理の中身
    void Execute()
    {
//      printf("read call\n");
    	result = read(p->_socket_13, buffer, sizeof(buffer));
//      printf("read result=%d\n", result);
    }

    // 非同期処理が完了したとき呼び出される
    void HandleOKCallback()
    {
    	if( result >= 0 ){
	        v8::Local<v8::Value> callbackArgs[] = {
	            Nan::Null(),
              Nan::CopyBuffer((char*)buffer, result).ToLocalChecked()
	        };
	        // コールバック呼び出し
	        callback->Call(3, callbackArgs);
    	}else{
	        v8::Local<v8::Value> callbackArgs[] = {
	            Nan::New("Read Error").ToLocalChecked(),
	            Nan::Null(),
	        };
	        // コールバック呼び出し
	        callback->Call(2, callbackArgs);
    	}
    }

private:
  BtL2capHid* p;
  int result;
	unsigned char buffer[L2CAP_BUFFER_SIZE];
};

class ConnectAsyncWorker : public Nan::AsyncWorker
{
public:
    ConnectAsyncWorker(BtL2capHid* p, unsigned char *p_addr, int retry, Nan::Callback* callback) : Nan::AsyncWorker(callback), p(p), p_addr(p_addr), retry(retry)
    {}

    // 非同期処理の中身
    void Execute()
    {
      for( int i = 0 ; i < retry ; i++ ){
        int s_11 = socket(AF_BLUETOOTH, SOCK_SEQPACKET, BTPROTO_L2CAP);
        struct sockaddr_l2 addr = { 0 };
        addr.l2_family = AF_BLUETOOTH;
        addr.l2_psm = htobs(L2CAP_PSM_HID_CNTL);
        memmove( addr.l2_bdaddr.b, p_addr, 6);

        result = connect(s_11, (struct sockaddr *)&addr, sizeof(addr));
//        printf("s_11 connect result=%d\n", result);
        if( result != 0 )
          continue;
        
        int s_13 = socket(AF_BLUETOOTH, SOCK_SEQPACKET, BTPROTO_L2CAP);
        addr.l2_psm = htobs(L2CAP_PSM_HID_INTR);

        result = connect(s_13, (struct sockaddr *)&addr, sizeof(addr));
//        printf("s_13 connect result=%d\n", result);
        if( result != 0 ){
          close(s_11);
          continue;
        }
        if( result == 0 ){
          p->_socket_11 = s_11;
          p->_socket_13 = s_13;
          break;
        }
      }
    }

    // 非同期処理が完了したとき呼び出される
    void HandleOKCallback()
    {
    	if( result >= 0 ){
	        v8::Local<v8::Value> callbackArgs[] = {
	            Nan::Null(),
	            Nan::New(result),
	        };
	        // コールバック呼び出し
	        callback->Call(2, callbackArgs);
    	}else{
	        v8::Local<v8::Value> callbackArgs[] = {
	            Nan::New("Connect Error").ToLocalChecked(),
	            Nan::Null(),
	        };
	        // コールバック呼び出し
	        callback->Call(2, callbackArgs);
    	}
    }

private:
  BtL2capHid* p;
  int result;
  int retry;
  unsigned char *p_addr;
};

Nan::Persistent<FunctionTemplate> BtL2capHid::constructor_template;

NAN_MODULE_INIT(BtL2capHid::Init) {
  Nan::HandleScope scope;

  Local<FunctionTemplate> tmpl = Nan::New<FunctionTemplate>(New);
  constructor_template.Reset(tmpl);

  tmpl->InstanceTemplate()->SetInternalFieldCount(1);
  tmpl->SetClassName(Nan::New("BtL2capHid").ToLocalChecked());

  Nan::SetPrototypeMethod(tmpl, "connect", Connect);
  Nan::SetPrototypeMethod(tmpl, "read", Read);
  Nan::SetPrototypeMethod(tmpl, "write", Write);

  target->Set(Nan::New("BtL2capHid").ToLocalChecked(), tmpl->GetFunction());
}

BtL2capHid::BtL2capHid() :
  node::ObjectWrap() {
}

BtL2capHid::~BtL2capHid() {
  close(this->_socket_13);
  close(this->_socket_11);
}

void BtL2capHid::writeSync(int index, char* data, int length) {
  int s = this->_socket_13;
  if( index == 1 )
    s = this->_socket_11;
  if (write(s, data, length) < 0) {
    this->emitErrnoError();
  }
}

NAN_METHOD(BtL2capHid::New) {
  Nan::HandleScope scope;

  BtL2capHid* p = new BtL2capHid();
  p->Wrap(info.This());
  p->This.Reset(info.This());
  info.GetReturnValue().Set(info.This());
}

NAN_METHOD(BtL2capHid::Connect) {
  Nan::HandleScope scope;
  BtL2capHid* p = node::ObjectWrap::Unwrap<BtL2capHid>(info.This());

  unsigned char default_addr[6] = { 0x00 };
  unsigned char* addr = default_addr;
  int retry = 2;

  Local<Value> arg0 = info[0];
  if (arg0->IsObject())
    if( node::Buffer::Length(arg0) >= 6 )
      addr = (unsigned char*)node::Buffer::Data(arg0);
  Local<Value> arg1 = info[1];
  if (arg1->IsInt32() || arg1->IsUint32()) {
    retry = arg1->IntegerValue();
  }
  auto callback = new Nan::Callback(info[2].As<v8::Function>());

  Nan::AsyncQueueWorker(new ConnectAsyncWorker(p, addr, retry, callback));
}

NAN_METHOD(BtL2capHid::Write) {
  Nan::HandleScope scope;
  BtL2capHid* p = node::ObjectWrap::Unwrap<BtL2capHid>(info.This());

  int index = 0;
  Local<Value> arg0 = info[0];
  if (arg0->IsInt32() || arg0->IsUint32()) {
    index = arg0->IntegerValue();
  }
  Local<Value> arg1 = info[1];
  if (arg1->IsObject()) {
    p->writeSync(index, node::Buffer::Data(arg1), node::Buffer::Length(arg1));
  }

  info.GetReturnValue().SetUndefined();
}

NAN_METHOD(BtL2capHid::Read) {
  Nan::HandleScope scope;
  BtL2capHid* p = node::ObjectWrap::Unwrap<BtL2capHid>(info.This());

  auto callback = new Nan::Callback(info[0].As<v8::Function>());
  Nan::AsyncQueueWorker(new ReadAsyncWorker(p, callback));
}

NODE_MODULE(binding, BtL2capHid::Init);
