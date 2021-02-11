const helpers = require('../assets/helpers')
const requestAction = require('../assets/requestAction')
const tripRidersMethod = require('./trip_method/rider_method')
const validator = require('validator')
const socketUser = require('../assets/socketUser')
const driverMethod = require('./trip_method/driver_method')

const trip = {}


//this method is to find a driver
trip.requestDriver = (ws, payload) => {
   let startLongitude = helpers.getInputValueNumber(payload, 'start_lon')
   let startLatitude = helpers.getInputValueNumber(payload, 'start_lat')
   let endLongitude = helpers.getInputValueNumber(payload, 'end_lon')
   let endLatitude = helpers.getInputValueNumber(payload, 'end_lat')
   let name = helpers.getInputValueString(payload, 'name')
   let phone = helpers.getInputValueString(payload, 'phone')
   let startAdrr = helpers.getInputValueString(payload, 'start_address')
   let endAddr = helpers.getInputValueString(payload, 'end_address')
   let avatar = helpers.getInputValueString(payload, 'avatar')
   let rideClass = helpers.getInputValueString(payload, 'class')

   //check and validate the input
   if (isNaN(startLongitude) || isNaN(startLatitude)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid start longitude and latitude is required" })
   }
   //check and validate the input
   if (isNaN(endLongitude) || isNaN(endLatitude)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid end longitude and latitude is required" })
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
   if (!phone || phone.length < 10) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Phone is required" })
   }
   //check if the name is empty
   if (!avatar) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Avatar is required" })
   }

   if (["A", "B", "C", "D"].indexOf(rideClass) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid class" })
   }

   payload.name = payload.name.split(" ")[0]

   // do the trip request switch
   switch (rideClass) {
      case "A":
         tripRidersMethod.RequestClassA(ws, payload);
         break;
      case "B":
         tripRidersMethod.RequestClassB(ws, payload);
         break;
      case "C":
         tripRidersMethod.RequestClassC(ws, payload);
         break;
      default:
         helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid request" })
   }

}

//for a driver to accept a request
trip.acceptRequest = (ws, payload) => {
   let longitude = helpers.getInputValueNumber(payload, 'lon') //the driver's geo latitude
   let latitude = helpers.getInputValueNumber(payload, 'lat') //the driver's geo longitude
   let name = helpers.getInputValueString(payload, 'name') //driver's email
   let phone = helpers.getInputValueString(payload, 'phone') //driver's phone
   let email = helpers.getInputValueString(payload, 'email') //the driver's email
   let avatar = helpers.getInputValueString(payload, 'avatar') //the driver's image url
   let rideClass = helpers.getInputValueString(payload, 'class') //the class of ride the driver is accepting
   let riderId = helpers.getInputValueString(payload, 'rider_id') //the id of the person who made the request

   //validate the payload
   if (isNaN(longitude) || isNaN(latitude)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid latitude and longitude is required" })
   }
   if (!name || name.length < 1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Name is required" })
   }
   if (!phone || phone.length < 10) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Phone is required" })
   }
   if (!email || !validator.default.isEmail(email)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid email is required" })
   }
   if (["A", "B", "C", "D"].indexOf(rideClass) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid class" })
   }
   if (!riderId) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Rider id is required" })
   }

   //check if the request is still availabe to accept
   if (socketUser.pendingTrip[riderId] && socketUser.pendingTrip[riderId].class === rideClass) {
      //get the data from pending request
      let rData = socketUser.pendingTrip[riderId]
      //switch the request by class
      switch (rideClass) {
         case "A":
            driverMethod.AcceptClassA(ws, payload, rData)
            break;
         case "B":
            driverMethod.AcceptClassB(ws, payload, rData)
            break;
         case "C":
            driverMethod.AcceptClassC(ws, payload, rData)
            break;
         default:
            helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Request" })
      }
   } else {
      helpers.outputResponse(ws, { action: requestAction.inputError, error: "Request not availabe. May have been canceled" })

   }
}

//for a driver that arrives a pickup location
trip.arrivePickUp = (ws, payload) => {
   let tripID = helpers.getInputValueString(payload, 'trip_id')
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let rideClass = helpers.getInputValueString(payload, 'class')

   //check if they are not available
   if (!tripID || tripID.length !== 24) {
      return helpers.outputResponse(ws, { error: requestAction.inputError, error: " A valid trip id is required" })
   }
   //check if they are not available
   if (!rider_id) {
      return helpers.outputResponse(ws, { error: requestAction.inputError, error: "Rider ID is required" })
   }
   //check if they are not available
   if (["A", "B", "C", "D"].indexOf(rideClass) === -1) {
      return helpers.outputResponse(ws, { error: requestAction.inputError, error: "Ride class is required" })
   }

   driverMethod.ArrivePickUp(ws, payload)

}

//for a driver to start trip
trip.startTrip = (ws, payload) => {
   let tripID = helpers.getInputValueString(payload, 'trip_id')
   let rideClass = helpers.getInputValueString(payload, 'class')
   let riders = helpers.getInputValueArray(payload, 'riders')

   //check if they are not available
   if (!tripID || tripID.length < 23) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: " A valid trip id is required" })
   }
   //check if they are not available
   if (["A", "B", "C", "D"].indexOf(rideClass) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Ride class is required" })
   }
   //check rider
   if (!riders || !(riders instanceof Array)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Riders not valid" })
   }

   //check if riders has required data
   for (let i of riders) {
      if (!/^\d+$/.test(i.waiting_time)) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Waiting time not valid" })
      }
      if (!i.rider_id) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Rider id not valid" })
      }
   }
   driverMethod.StartRide(ws, payload)

}

//forr ending a trip
trip.endTrip = (ws, payload) => {
   let tripID = helpers.getInputValueString(payload, 'trip_id')
   let rideClass = helpers.getInputValueString(payload, 'class')
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let endTime = helpers.getInputValueNumber(payload, 'end_time')
   let totalDistance = helpers.getInputValueNumber(payload, 'total_distance')
   let lon = helpers.getInputValueNumber(payload, 'longitude')
   let lat = helpers.getInputValueNumber(payload, 'latitude')

   //check if they are not available
   if (!tripID || tripID.length !== 24) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: " A valid trip id is required" })
   }
   //check if they are not available
   if (["A", "B", "C", "D"].indexOf(rideClass) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Ride class is required" })
   }
   //check rider
   if (!rider_id) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Riders id is required" })
   }
   if (!endTime || isNaN(endTime)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "End time is required" })

   }
   if (isNaN(totalDistance)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Total distance is required" })
   }
   //if the driver's final position not submitted
   if (isNaN(lat) || isNaN(lon)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Driver's final geo code required" })
   }
   driverMethod.EndRide(ws, payload)
}

//for canceling a trip
trip.cancelRequest = (ws, payload) => {
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let cancelLevel = helpers.getInputValueString(payload, 'cancel_level')
   let userType = ws._user_data.user_type //get the user type

   if (['1', '2', '3'].indexOf(cancelLevel) === -1) {
      return helpers.outputResponse(ws, { error: "Unknown Action", action: requestAction.inputError })
   }
   //cancel level one is just to cancel a request a driver has not accepted
   if (cancelLevel === '1') {
      delete socketUser.online[rider_id] //
      //if the driver cancels first request level 1, search for another driver
      if (userType === 'driver') {
         let getPendingData = socketUser.pendingTrip[payload.rider_id]
         delete getPendingData.driver //delete the driver data
         trip.requestDriver(ws, getPendingData)
      } else {
         delete socketUser.pendingTrip[rider_id]
      }
      // helpers
   } else if (cancelLevel === '2') {
      delete socketUser.online[rider_id] //
      //log the data on the database
   } else {
      delete socketUser.online[rider_id] //
      //log the data on the database
      ///calculate the price the user has to pay for this level
   }
}



module.exports = trip;