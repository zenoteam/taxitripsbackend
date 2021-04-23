const socketUser = require("./socketUser");
const request = require('request')

const helpers = {}


helpers.zenoTripDBLocal = 'mongodb://localhost:27017/zeno_trip';
helpers.zenoTripDBLive = "mongodb://lagridemdb:lagridemdb@172.30.19.186:27017/lagridemdb";
// helpers.zenoTripDBLive = 'mongodb+srv://increase_21:QRudhu0Fsw0b166S@cluster0-mszft.mongodb.net/zeno_trip?retryWrites=true&w=majority';


// for generating token
const randomToken = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-'
helpers.generateToken = (len) => {
   let token = ''
   let xLen = randomToken.length - 1;
   for (let i = 0; i < len; i++) {
      token += randomToken.charAt(Math.random() * xLen)
   }
   return token
}

// for getting input fields string
helpers.getInputValueString = (inputObj, field) => {
   return inputObj instanceof Object && inputObj.hasOwnProperty(field) && typeof inputObj[field] === 'string'
      ? inputObj[field].trim() : ''
}
// for getting input fields number
helpers.getInputValueNumber = (inputObj, field) => {
   return inputObj instanceof Object && inputObj.hasOwnProperty(field) && typeof inputObj[field] === 'number'
      ? inputObj[field] : 'none'
}

// for getting input fields object
helpers.getInputValueObject = (inputObj, field) => {
   return inputObj instanceof Object && inputObj.hasOwnProperty(field) && typeof inputObj[field] === 'object' ? inputObj[field] : ''
}

// for getting input fields array
helpers.getInputValueArray = (inputObj, field) => {
   return inputObj instanceof Object && inputObj.hasOwnProperty(field) && inputObj[field] instanceof Array ? inputObj[field] : ''
}

//for outputing response 
helpers.outputResponse = (ws, payload, ws_id) => {
   try {
      if (ws_id) {
         ws.to(ws_id).emit('msg', payload)
      } else {
         ws.emit('msg', payload)
      }
   } catch (e) {
      // console.log(e)
      //catch any error
   }
}

//for getting waiting time charge
helpers.getWaitingTimeCharges = (waitingTime, maxAllowTimeInSec = 180, chargePerMinute = 50) => {
   let getTimeSpent = waitingTime ? (waitingTime > maxAllowTimeInSec) ? waitingTime - maxAllowTimeInSec : 0 : 0
   let chargePerSec = chargePerMinute / 60
   return Math.ceil(chargePerSec * getTimeSpent)
}

//for getting waiting time charge
helpers.getDistanceCoveredCharges = (totalDstInKM, chargePerKM = 100) => {
   if (isNaN(totalDstInKM)) return //if there's no valid value return
   totalDstInKM = parseFloat(totalDstInKM)
   let chargePerMeter = chargePerKM / 1000 //get the charge per meter
   return Math.ceil((totalDstInKM * 1000) * chargePerMeter)
}

//for getting waiting time charge
helpers.getTimeCoveredCharges = (totalTimeInSec, chargePerMinute = 100) => {
   if (isNaN(totalTimeInSec)) return //if there's no valid value return
   let chargePerSec = chargePerMinute / 60 //get the charge per second
   return Math.ceil(totalTimeInSec * chargePerSec) //calculate the prce
}

//for converting deg to randian
function deg2rad(deg) {
   return deg * (Math.PI / 180)
}

//get the distance
helpers.getGeometryDistanceKM = (geo1, geo2) => {
   var R = 6371; // Radius of the earth in km
   var dLat = deg2rad(geo2.latitude - geo1.latitude);  // deg2rad below
   var dLon = deg2rad(geo2.longitude - geo1.longitude);
   var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(geo1.latitude)) * Math.cos(deg2rad(geo2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
      ;
   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   var d = R * c; // Distance in km
   return !isNaN(d) ? d.toFixed(2) : d;
}

//for verifying user token
helpers.makeHTTPRequest = (obj = { uri: '', method: '', headers: {} }) => {
   return new Promise((resolve, reject) => {
      request(obj, (err, res, body) => {
         resolve(err ? { error: err } : body)
      })
   })
}




module.exports = helpers;