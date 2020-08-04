const WiiRemocon = require('./wiiremocon');

var wii = new WiiRemocon();

async function wiiremote_monitoring(remote_address){
  wii = new WiiRemocon();
  wii.on("data", data =>{
    console.log(data);
  });

  await wii.connect(wii.addr2bin(remote_address));
  wii.setLed(wii.WIIREMOTE_LED_BIT0 | wii.WIIREMOTE_LED_BIT1 | wii.WIIREMOTE_LED_BIT2 | wii.WIIREMOTE_LED_BIT3, 0); 
}

wiiremote_monitoring(process.argv[2])
.catch(error =>{
  console.error(error);
});
