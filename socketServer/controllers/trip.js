const validator = require('validator')
const helpers = require('../assets/helpers')
const requestAction = require('../assets/requestAction')
const tripRidersMethod = require('./trip_method/rider_method')
const socketUser = require('../assets/socketUser')
const driverMethod = require('./trip_method/driver_method')
const tripModel = require('../../models/trip_request')

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
   let est_fare = helpers.getInputValueString(payload, 'est_fare')
   let est_time = helpers.getInputValueNumber(payload, 'est_time')
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
   //check if there's no estimated time
   if (isNaN(est_time)) {
      return helpers.outputResponse(ws, { error: "Estimated time required. e.g est_time:3020", action: requestAction.inputError })
   }
   //check if there's no estimated fare
   if (!est_fare) {
      return helpers.outputResponse(ws, { error: "Estimated fare required. e.g est_fare:300-500", action: requestAction.inputError })
   }

   //check the class of ride
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
      case "D":
         tripRidersMethod.RequestClassD(ws, payload);
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
         case "D":
            driverMethod.AcceptClassD(ws, payload, rData)
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

//for driver that navigate to pick up
trip.driverGoToPickUp = (ws, payload) => {
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let riders = helpers.getInputValueArray(payload, 'riders')

   //if the rider is not submitted
   if (!rider_id) {
      return helpers.outputResponse(ws, { error: requestAction.inputError, error: "Rider ID is required" })
   }

   if (!(riders instanceof Array) || riders.length !== 0) {
      return helpers.outputResponse(ws, { error: requestAction.inputError, error: "Riders data is required" })
   }
   //send to the riders
   for (let i of riders) {
      if (i.status !== 'cancel') {
         //if online
         if (socketUser.online[i.rider_id]) {
            helpers.outputResponse(ws, {
               action: requestAction.driverGoingToPickUpLocation,
               trip_id: i.trip_id, //trip id
               rider_id: payload.rider_id // id of the person driver going to pick
            }, socketUser.online[i.rider_id])
         }
      }
   }
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
trip.cancelRequest = async (ws, payload) => {
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
         //send the response to the driver

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

//for rating a driver
trip.rateUser = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let rating = helpers.getInputValueString(payload, 'rating')
   let user_id = helpers.getInputValueString(payload, 'user_id')
   //check length
   if (!trip_id || trip_id.length !== 24) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "trip id is required" })
   }
   //check length
   if (!rating || isNaN(rating) || ['0', '1', '2', '3', '4', '5'].indexOf(rating) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Rating point is required" })
   }
   //check the user ID
   if (!user_id) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "User id is required" })
   }

   //save the rating
   let saveRating = await tripModel.TripRatings.create({
      user_id, trip_id, rating, rater_id: ws._user_data.token,
   }).catch(e => ({ error: e }))

   //check if error
   if (!saveRating || saveRating.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }

   helpers.outputResponse(ws, { action: requestAction.ratingSubmittedSuccessfully })

}

//for getting estimated fare
trip.getEstimatedFare = (ws, payload) => {
   let est_time = helpers.getInputValueNumber(payload, 'est_time')
   let est_dst = helpers.getInputValueNumber(payload, 'est_dst')

   if (!est_dst || isNaN(est_dst)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid estimated distance is required" })
   }
   if (!est_time || isNaN(est_time)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid estimated time is required" })
   }
   let getTimeFare = helpers.getTimeCoveredCharges(est_time, 15)
   let getDstFare = helpers.getTimeCoveredCharges(est_dst, 15)
   let total = Math.ceil(getTimeFare + getDstFare);
   let estFare = `${total}-${total + Math.ceil(total / 2)}`
   return helpers.outputResponse(ws, { action: requestAction.tripEstimatedFare, fare: estFare })
}


module.exports = trip;