const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// const axios= require("axios")
const amqplib= require('amqplib')
const {v4:uuid4}= require('uuid')


const { APP_SECRET ,MESSAGE_BROKER_URL, EXCHANGE_NAME, QUEUE_NAME, SHOPPING_BINDING_KEY, SHOPPING_SERVICE} = require("../config");
let amqplibConnection = null;


//Utility functions
module.exports.GenerateSalt = async () => {
  return await bcrypt.genSalt();
};

module.exports.GeneratePassword = async (password, salt) => {
  return await bcrypt.hash(password, salt);
};

module.exports.ValidatePassword = async (
  enteredPassword,
  savedPassword,
  salt
) => {
  return (await this.GeneratePassword(enteredPassword, salt)) === savedPassword;
};

module.exports.GenerateSignature = async (payload) => {
  try {
    return await jwt.sign(payload, APP_SECRET, { expiresIn: "30d" });
  } catch (error) {
    console.log(error);
    return error;
  }
};

module.exports.ValidateSignature = async (req) => {
  try {
    const signature = req.get("Authorization");
    console.log(signature);
    const payload = await jwt.verify(signature.split(" ")[1], APP_SECRET);
    req.user = payload;
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
};

module.exports.FormateData = (data) => {
  if (data) {
    return { data };
  } else {
    throw new Error("Data Not found!");
  }
};

// module.exports.PublishCustomerEvent = async (payload) => {
//   console.log('no 1')
//   axios.post("http://localhost:8000/customer/app-events", {
//     payload,
//   });
// };


/*--------------------------Message broker--------------------------*/

const getChannel = async () => {
  if (amqplibConnection === null) {
    amqplibConnection = await amqplib.connect(MESSAGE_BROKER_URL);
  }
  return await amqplibConnection.createChannel();
};


//Create a channel
module.exports.CreateChannel = async ()=>{
  try {
    const connection =await amqplib.connect(MESSAGE_BROKER_URL)
    const channel = await connection.createChannel()
    await channel.assertExchange(EXCHANGE_NAME, 'direct',false);
    return channel;
  } catch (error) {
    throw error
  }
}

//Pubish messages
module.exports.PublishMessage = (channel, service, msg) => {
  channel.publish(EXCHANGE_NAME, service, Buffer.from(msg));
  console.log("Sent: ", msg);
};

//Subscribe messages
module.exports.SubscribeMessage = async (channel,service)=>{
 await channel.assertExchange(EXCHANGE_NAME,"direct",{durable:true});
 const q = await channel.assertQueue("",{exclusive:true});
 console.log(`Waiting for messages in queue: ${q.queue}`);

 channel.bindQueue(q.queue, EXCHANGE_NAME,SHOPPING_SERVICE);

 channel.consume(
  q.queue,
  (msg)=>{
    if(msg.content){
      console.log("the message is:", msg.content.toString());
      service.SubscribeEvents(msg.content.toString());
    }
    console.log('[X] received');
  },
  {
    noAck:true 
  }
 )
}







const requestData = async (RPC_QUEUE_NAME, requestPayload, uuid) => {
  try {
    const channel = await getChannel();

    const q = await channel.assertQueue("", { exclusive: true });

    channel.sendToQueue(
      RPC_QUEUE_NAME,
      Buffer.from(JSON.stringify(requestPayload)),
      {
        replyTo: q.queue,
        correlationId: uuid,
      }
    );

    return new Promise((resolve, reject) => {
      // timeout n
      const timeout = setTimeout(() => {
        channel.close();
        resolve("API could not fullfil the request!");
      }, 8000);
      channel.consume(
        q.queue,
        (msg) => {
          if (msg.properties.correlationId == uuid) {
            resolve(JSON.parse(msg.content.toString()));
            clearTimeout(timeout);
          } else {
            reject("data Not found!");
          }
        },
        {
          noAck: true,
        }
      );
    });
  } catch (error) {
    console.log(error);
    return "error";
  }
};

module.exports.RPCRequest = async (RPC_QUEUE_NAME, requestPayload) => {
  const uuid = uuid4(); // correlationId
  return await requestData(RPC_QUEUE_NAME, requestPayload, uuid);
};

