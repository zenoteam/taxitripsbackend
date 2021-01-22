const helpers = {}


helpers.zenoTripDB = 'mongodb://localhost:27017/zeno_trip';


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
   return inputObj instanceof Object && inputObj.hasOwnProperty(field) && typeof inputObj[field] instanceof Array ? inputObj[field] : ''
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
      //catch any error
   }
}


module.exports = helpers;