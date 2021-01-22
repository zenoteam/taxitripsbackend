//This file handles routing the request to each file and method responsible for th request.
//Since this is design in M.V.C pattern, the route calls the controller and invoke the method
//this method expects two variables, ws and payload. 
//ws is the connected device data, payload is the the incoming data
const helpers = require('./assets/helpers')
const requestAction = require('./assets/requestAction')



module.exports = (ws, payload) => {
   //check if there's no payload
   if (!payload || typeof payload.action !== 'string') {
      return helpers.outputResponse(ws, { error: "Requested resource does not exist", action: requestAction.inputError })
   }
   //payload.action carries the url down to the method to be executed.
   //so we split the slash (/) to get the file and the method name 
   let sAction = payload.action.split("/") //split the payload
   //check if the payload not exact length
   if (sAction.length !== 2) {
      return helpers.outputResponse(ws, { error: "Requested resource not found", action: requestAction.inputError })
   }
   //trying to require the file 
   var controller;
   try {
      // require the file requested
      controller = require('./controllers/' + sAction[0])
   } catch (e) {
      // if the file does not exist
      return helpers.outputResponse(ws, { error: "Requested resource not found", action: requestAction.inputError })
   }

   //if the file exist and the method exist, execute the method
   if (typeof controller[sAction[1]] === 'function') {
      controller[sAction[1]](ws, payload) //pass in the variable needed by the function
   } else {
      //if the method does not exist
      return helpers.outputResponse(ws, { error: "Requested resource not found", action: requestAction.inputError })
   }
}