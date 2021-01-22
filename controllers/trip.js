const helpers = require('../assets/helpers')
const requestAction = require('../assets/requestAction')
const driverModel = require('../models/driver')
const socketUser = require('../assets/socketUser')
const trip = {}

// A private function that handles class a driver search
const RiderTypeA = async (ws, payload) => {
   //find the rider withing the location
   let getDriver = await driverModel.aggregate([
      {
         $geoNear: {
            "near": { "type": "Point", "coordinates": [parseFloat(lon), parseFloat(lat)] },
            "distanceField": "location.distance",
            "minDistance": 0,
            "spherical": true,
            "maxDistance": 15000,
            "distanceMultiplier": 0.001
         }
      },
      { $match: { on_trip: false, online: true } },
      { $project: { location: 1 } },
      { $limit: 1 },
   ])

   //check if there error or no driver
   if (!getDriver) {
      return helpers.outputResponse(ws, { action: requestAction.driverNotFound })
   }

   //if there's a driver, hold the trip as pending together with the driver's details
   let userUniqueID = ws.user_auth_id

   socketUser.pendingTrip[userUniqueID] = { payload, driver: ['driver-unqiue-id'] }

   //send the request to the driver
   let sendData = {
      action: requestAction.newTripRequest,
      ...payload
   }
   helpers.outputResponse(ws, sendData, 'driver-unique-id')
}


//this method is to find a rider.
//the required params from payload should be longitude, latitude, class, name, address, avatar
trip.requestRider = (ws, payload) => {
   let lon = helpers.getInputValueNumber(payload, 'longitude')
   let lat = helpers.getInputValueNumber(payload, 'latitude')
   let name = helpers.getInputValueNumber(payload, 'name')
   let startAdrr = helpers.getInputValueNumber(payload, 'start_address')
   let endAddr = helpers.getInputValueNumber(payload, 'end_address')
   let avatar = helpers.getInputValueNumber(payload, 'avatar')
   let rideClass = helpers.getInputValueNumber(payload, 'class')

   //check and validate the input
   if (isNaN(lon) || isNaN(lat)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid longitude and latitude is required" })
   }
   //check if the name is empty
   if (!name || name.length < 2) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Name is required" })
   }
   //check if the name is empty
   if (!startAdrr || startAdrr.length < 2) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Start address is required" })
   }
   //check if the name is empty
   if (!endAddr || endAddr.length < 2) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "End address is required" })
   }
   //check if the name is empty
   if (!avatar) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Avatar is required" })
   }

   if (['A', 'B', 'C', 'D'].indexOf(rideClass) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid class" })
   }

   // do the trip request switch
   switch (rideClass) {
      case 'A':
         RiderTypeA(ws, payload);
         break;
      default:
         helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid request" })
   }

}