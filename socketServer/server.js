const io = require('socket.io')
const socketUsers = require('./assets/socketUser')
const router = require('./router')
const socket = {}

//create socket.io server
socket.createServer = (httpServer) => {
   socket.io = io(httpServer) //this creates a socket server that would be listening for connection on the port below
   //Usually every connection to the server must establish a handshake.
   //during this handshake, I usually used socket.io middleware authetication to authenticate the user/device establishing
   // the connection. The client is expected to submit some auth data
   socket.io.use(async (ws, next) => {
      //this is expected to return all auth data submitted during handshake or return empty object
      let query = (ws && ws.handshake) ? ws.handshake.query : {}

      //Here we can carry out any auth. For e.g let's say we validate a token submitted
      let userToken = query.token ? query.token : null
      let userType = query.user_type ? query.user_type : null

      //if there's no token or the token is invalid, terminate the connection
      if (!userToken || userToken.length !== 30) {
         return next(new Error('Unauthorized'));
      }
      //if the usertype is not valid
      if (['driver', 'user'].indexOf(userType) === -1) {
         return next(new Error('Unauthorized'));
      }
      //add the user data to the obj
      ws._user_data = {
         token: userToken,
         user_type: userType
      }

      //if after the auth validation and the connection is valid
      next() // allow the connection and route to the next listener
   });

   // this block is called once on each refresh connection upon passing the auth validation
   socket.io.on("connection", (ws) => {
      // ws is a variable that contains all the connection details for the new connection. it's an object.
      // We can add other things to the variable which might be of use later in code

      //add the user to the online object using his unique id with the socket id for easiest communication
      socketUsers.online[ws._user_data.token] = ws.id;

      //create incoming message event listener for the connected device
      ws.on("msg", data => {
         //msg is event name where the connected device would have to fire when sending request to the server
         // data is a variable that returns the payload of the incoming request
         router(ws, data)
      })


      //create a listener to detect when the connected device disconnect from the socket
      ws.on("disconnect", () => {
         //here we remove the device from online users and update the database according if necessary
         // but before doing that, we have to wait for some seconds or minutes. A number of things could disconnect a device
         // it could incoming call, bad network, app closure etc. So to avoid querying database now and then, we wait for reconnection.
         let userData = ws._user_data // this will return the user data added to the ws obj.
         // if the user is a driver
         if (userData.user_type === 'driver') {
            delete socketUsers.online[userData.token]
            //other things below
         } else {
            // we can go aheaded to delete the user and update database if neeed be
            delete socketUsers.online[userData.token]
         }
      })
   })
}


//for time delay
socket.takeASleep = (time) => {
   console.log('sleeping for ' + time + ' seconds')
   return new Promise((resolve, reject) => setTimeout(resolve, time))
}

module.exports = socket;
