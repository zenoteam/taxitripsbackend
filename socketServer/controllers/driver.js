const driver = {}
const validator = require('validator');
const helpers = require('../assets/helpers');
const requestAction = require('../assets/requestAction');
const driverModel = require('../../models/driver');
const socketUser = require('../assets/socketUser');


driver.setOnlineStatus = async (ws, payload) => {
   let lon = helpers.getInputValueNumber(payload, 'longitude')
   let lat = helpers.getInputValueNumber(payload, 'latitude')
   let status = helpers.getInputValueString(payload, 'status')
   let driverId = ws._user_data.token

   //check if not valid data
   if (isNaN(lon) || isNaN(lat)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid lat or lon is required" })
   }
   if (['on', 'off'].indexOf(status) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid status" })
   }
   //update the status
   let updateStatus = await driverModel.findOneAndUpdate({ user_id: driverId },
      {
         online: status === 'on' ? true : false,
         'location.coordinates': [lon, lat]
      }, { upsert: true }).catch(e => ({ error: e }))
   //check if not updated 
   if (!updateStatus) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   helpers.outputResponse(ws, { action: requestAction.driverStatusSet })
}

driver.setOnlineStatusTem = async (ws, payload) => {
   let lon = helpers.getInputValueNumber(payload, 'longitude')
   let lat = helpers.getInputValueNumber(payload, 'latitude')
   let status = helpers.getInputValueString(payload, 'status')
   let email = helpers.getInputValueString(payload, 'email')
   let driverId = ws._user_data.token

   //check if not valid data
   if (isNaN(lon) || isNaN(lat)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid lat or lon is required" })
   }
   if (['on', 'off'].indexOf(status) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid status" })
   }
   if (!validator.default.isEmail(email)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid email" })
   }
   let updateStatus;
   if (status === 'off') {
      //update the status
      updateStatus = await driverModel.findOneAndUpdate({ user_id: driverId },
         { online: false, }, { new: true }).catch(e => ({ error: e }))
   } else {
      updateStatus = await driverModel.findOneAndUpdate({ user_email: email },
         {
            user_id: driverId,
            user_email: email,
            user_approve: true,
            car_plate_number: driverId,
            location: { type: "Point", coordinates: [lon, lat] },
            online: true,
            on_trip: "no",
         }, { upsert: true, new: true }).catch(e => ({ error: e }))

   }
   //check if not updated
   if (!updateStatus || updateStatus.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   if (!socketUser.online[driverId]) {
      socketUser.online[driverId] = ws.id
   }
   helpers.outputResponse(ws, { action: requestAction.driverStatusSet, status })
}

driver.getOnlineStatus = async (ws, payload) => {
   let driverId = ws._user_data.token
   //check if the driver is still online
   let getStatus = await driverModel.findOne({ user_id: driverId }, { online: 1 }).catch(e => ({ error: e }))
   // console.log(driverId)
   // console.log(getStatus)
   if (!getStatus || getStatus.error) {
      helpers.outputResponse(ws, { action: requestAction.driverStatusSet, status: 'off' })
   } else {
      // console.log(getStatus)
      helpers.outputResponse(ws, { action: requestAction.driverStatusSet, status: getStatus.online ? 'on' : 'off' })
   }

}
module.exports = driver;