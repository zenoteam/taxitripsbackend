const driver = {}
const validator = require('validator');
const helpers = require('../assets/helpers');
const requestAction = require('../assets/requestAction');
const driverModel = require('../../models/driver')


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
      updateStatus = await driverModel.findOneAndUpdate({ user_id: driverId }, { online: false, }, { upsert: true }).catch(e => ({ error: e }))
   } else {
      updateStatus = await driverModel.findOneAndUpdate({ user_id: driverId },
         {
            user_id: driverId,
            user_email: email,
            user_approve: true,
            car_plate_number: driverId,
            location: { type: "Point", coordinates: [lon, lat] },
            online: true,
            on_trip: false,
         }, { upsert: true, new: true }).catch(e => ({ error: e }))

   }
   //check if not updated 
   if (!updateStatus || updateStatus.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   helpers.outputResponse(ws, { action: requestAction.driverStatusSet, status })
}

module.exports = driver;