const Inquery = require('./inquiry');

const inquiry = new Inquery();

async function inquiry_device(){
  return new Promise((resolve, reject) =>{
    var local_address = null;
    var remote_address = null;

    inquiry.on("initialized", (address) =>{
      console.log("local: " + address);
      local_address = address;
  
      inquiry.inquiry(10, 1);
    });

    inquiry.on("inquiryResult", (address) =>{
      console.log("remote: " + address);
  
      remote_address = address;
    });

    inquiry.on("inquiryComplete", (status) =>{
      console.log("status: " + status);
      inquiry.stop();
      resolve({ local: local_address, remote: remote_address });
    });

    inquiry.init();
  })
}

inquiry_device()
.then( result =>{
  console.log(result);
})
.catch(error =>{
  console.error(error);
});
