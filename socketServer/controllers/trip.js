const validator = require('validator')
const helpers = require('../assets/helpers')
const requestAction = require('../assets/requestAction')
const riderMethod = require('./trip_method/rider_method')
const socketUser = require('../assets/socketUser')
const driverMethod = require('./trip_method/driver_method')
const notificationModel = require('../../models/notification')
const tripModel = require('../../models/trip_request')
const dbConnector = require('../../models/dbconnector')

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
   let classComplete = helpers.getInputValueString(payload, 'class_complete')
   let riders = helpers.getInputValueArray(payload, 'riders')

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

   if (classComplete) {
      //check the class submitting
      if (["B", "C", "D"].indexOf(classComplete) === -1) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid class complete" })
      }
      //check if the class complete is not same with the class
      if (payload.class !== payload.class_complete) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Class complete and Class do not match" })
      }
      //check if the riders are not submitted
      if (!(riders instanceof Array) || riders.length === 0) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Riders data is required for ride complete" })
      }
      //check if the data not match
      if (classComplete === "B" && riders.length !== 2) {
         return helpers.outputResponse(ws, {
            action: requestAction.inputError,
            error: "Riders data for class B complete must be one and it's required"
         })
      }
      //check if the data not match
      if (classComplete === "C" && riders.length !== 3) {
         return helpers.outputResponse(ws, {
            action: requestAction.inputError,
            error: "Riders data for class C complete must be two and it's required"
         })
      }
      //check if the data not match
      if (classComplete === "D" && riders.length !== 4) {
         return helpers.outputResponse(ws, {
            action: requestAction.inputError,
            error: "Riders data for class D complete must be three and it's required"
         })
      }
      //check if not all the data are submitted
      for (let d of riders) {
         if (!d.name || !d.phone || d.phone.length !== 11 || !d.rider_id) {
            return helpers.outputResponse(ws, {
               action: requestAction.inputError,
               error: "Riders data must have valid name, phone and rider id"
            })
         }
      }
      payload.class = "A"
      //add recommendation no
      payload.accept_recommendation = "no"
      payload.ride_class_complete = true
   }

   //if there's no distance submitted, calculate the distance
   if (!payload.est_dst) {
      //add the distance to the payload
      payload.est_dst = helpers.getGeometryDistanceKM({
         latitude: payload.start_lat,
         longitude: payload.start_lon
      }, {
         latitude: payload.end_lat,
         longitude: payload.end_lon
      })
   }

   payload.name = payload.name.split(" ")[0]
   // do the trip request switch
   switch (rideClass) {
      case "A":
         riderMethod.RequestClassA(ws, payload, []);
         break;
      case "B":
         riderMethod.RequestClassB(ws, payload, []);
         break;
      case "C":
         riderMethod.RequestClassC(ws, payload, []);
         break;
      case "D":
         riderMethod.RequestClassD(ws, payload, []);
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

   //get the last driver the request was sent to
   let lastDriver = socketUser.pendingTrip[riderId] ? socketUser.pendingTrip[riderId].driver[socketUser.pendingTrip[riderId].driver.length - 1] : null

   //check if the request is still availabe to accept
   if (socketUser.pendingTrip[riderId]) {
      //if the driver accepting is the last driver the request was sent to
      if (lastDriver === ws._user_data.token) {
         //clear the timer request
         clearTimeout(socketUser.requestDriverTimer[riderId])
         delete socketUser.requestDriverTimer[riderId] //remove from the object
         //get the data from pending request
         let rData = socketUser.pendingTrip[riderId]
         delete socketUser.pendingTrip[riderId] //delete pending data if any
         //add the pickup distance
         payload.pickup_distance = helpers.getGeometryDistanceKM(
            { longitude: payload.lon, latitude: payload.lat },
            { longitude: rData.start_lon, latitude: rData.start_lat },
         )
         //switch the request by class
         switch (rideClass) {
            case "A":
               driverMethod.AcceptClassA(ws, payload, rData)
               break;
            case "B":
               driverMethod.AcceptClassB(ws, payload, rData)
               break;
            case "C":
               driverMethod.AcceptClassC(ws, payload, rData);
               break;
            case "D":
               driverMethod.AcceptClassD(ws, payload, rData)
               break;
            default:
               helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Request" })
         }
      } else {
         helpers.outputResponse(ws, { action: requestAction.inputError, error: "Request not available" })
      }
   } else {
      helpers.outputResponse(ws, { action: requestAction.inputError, error: "Request was canceled" })
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
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Rider ID is required" })
   }

   if (!(riders instanceof Array) || riders.length === 0) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Riders data is required" })
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

//for driver that has picked a rider
trip.driverPickedUpRider = async (ws, payload) => {
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let riders = helpers.getInputValueArray(payload, 'riders')
   let waitingTime = helpers.getInputValueNumber(payload, 'waiting_time')

   //if the rider is not submitted
   if (!rider_id) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Rider ID is required" })
   }

   //check of there's no waiting time
   if (isNaN(waitingTime)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Waiting time is required" })
   }

   if (!(riders instanceof Array) || riders.length === 0) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Riders data is required" })
   }

   let trip_id = riders[0].trip_id
   //update the data to arrive pickup
   let updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: trip_id, 'riders.rider_id': rider_id },
      {
         $set: {
            'riders.$.statge': 2, 'riders.$.status': 'pick',
            'riders.$.action': requestAction.driverPickedRider,
            'riders.$.waiting_time': waitingTime,
         }
      }, { new: true, lean: true }).catch(e => ({ error: e }))

   //check if it's not updated
   if (!updateData || updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
      //do somthing here
   }

   //send to the riders
   for (let i of riders) {
      if (i.status !== 'cancel') {
         //if online
         if (socketUser.online[i.rider_id]) {
            helpers.outputResponse(ws, {
               action: requestAction.driverPickedRider,
               trip_id: i.trip_id, //trip id
               rider_id: payload.rider_id // id of the person driver going to pick
            }, socketUser.online[i.rider_id])
         }
      }
   }
}

//for driver movement to pickup
trip.driverOnAMove = (ws, payload) => {
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let longitude = helpers.getInputValueNumber(payload, 'longitude')
   let latitude = helpers.getInputValueNumber(payload, 'latitude')
   let riders = helpers.getInputValueArray(payload, 'riders')

   //if the rider is not submitted
   if (!rider_id) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Rider ID is required" })
   }
   //if there's no valid longitude or latitude
   if (!longitude || isNaN(longitude) || !latitude || isNaN(latitude)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Valid longitude and latitude required" })
   }
   if (!(riders instanceof Array) || riders.length === 0) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Riders data is required" })
   }
   //send to the riders
   for (let i of riders) {
      if (i.status !== 'cancel') {
         //if online
         if (socketUser.online[i.rider_id]) {
            helpers.outputResponse(ws, {
               action: requestAction.driverOnHisWay,
               trip_id: i.trip_id, //trip id
               rider_id: payload.rider_id, // id of the person driver going to pick
               longitude, latitude
            }, socketUser.online[i.rider_id])
         }
      }
   }

}

//for a driver to start trip
trip.startTrip = (ws, payload) => {
   let tripID = helpers.getInputValueString(payload, 'trip_id')
   let rideClass = helpers.getInputValueString(payload, 'class')
   let waitingTime = helpers.getInputValueString(payload, 'waiting_time')
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

   //check the waiting time
   if (isNaN(waitingTime)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Waiting time is required" })
   }

   //check if riders has required data
   for (let i of riders) {
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
   console.log(payload)
   if (isNaN(totalDistance)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Total distance is required" })
   }
   //if the driver's final position not submitted
   if (isNaN(lat) || isNaN(lon)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Driver's final geo code required" })
   }
   driverMethod.EndRide(ws, payload)
}

//for destination update for class A
trip.updateDestination = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let endAddr = helpers.getInputValueString(payload, 'end_address')
   let endLon = helpers.getInputValueNumber(payload, 'end_lon')
   let endLat = helpers.getInputValueNumber(payload, 'end_lat')
   let rideClass = helpers.getInputValueString(payload, 'class')
   let fare = helpers.getInputValueString(payload, 'est_fare')
   let estTime = helpers.getInputValueNumber(payload, 'est_time')
   let estDst = helpers.getInputValueNumber(payload, 'est_dst')

   //check the values
   if (!endLon || isNaN(endLon)) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "A valid end longitude is required"
      })
   }
   //check the values
   if (!endLat || isNaN(endLat)) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "A valid end latitude is required"
      })
   }
   //check address
   if (!endAddr || endAddr.length < 2) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "A valid address is required"
      })
   }
   if (!rideClass) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Ride class is required"
      })
   }
   if (rideClass !== "A") {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: `Feature not allowed for ${rideClass}. This is only allowed for class A`
      })
   }
   //check the trip id
   if (!trip_id || trip_id.length !== 24) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "A valid trip id is required"
      })
   }

   if (!fare || fare.length < 2) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Estimated Fare not submitted"
      })
   }

   if (!estTime || isNaN(estTime)) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Estimated est_time is required"
      })
   }

   if (!estDst || isNaN(estDst)) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Estimated est_dst is required"
      })
   }


   //check the trip ID
   let getTrip = await tripModel.TripRequests.findOne({ _id: trip_id }).catch(e => ({ error: e }))
   //check if there's an error
   if (getTrip && getTrip.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   //check if not trip found
   if (!getTrip) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not found" })
   }
   let riderData = ws._user_data
   let getRider = getTrip.riders[0]
   //check if the details not correct
   if (getRider.rider_id !== riderData.token) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "User not found in the trip" })
   }

   let oldDest = {
      start_lon: getRider.start_lon,
      start_lat: getRider.start_lat,
      end_lon: getRider.end_lon,
      end_lat: getRider.end_lat,
      start_address: getRider.start_address,
      end_address: getRider.end_address,
      est_time: getRider.est_time,
      est_dst: getRider.est_dst
   }

   //update the distination
   let updateDest = await tripModel.TripRequests.findOneAndUpdate({ _id: trip_id }, {
      $set: {
         'riders.0.end_lon': endLon,
         'riders.0.end_lat': endLat,
         'riders.0.end_address': endAddr,
         'riders.0.est_time': estTime,
         'riders.0.est_fare': fare,
      },
      $push: {
         previous_destination: oldDest
      },
   }, { new: true }).catch(e => ({ error: e }))

   //if error
   if (updateDest && updateDest.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   //if not updated
   if (!updateDest) {
      helpers.outputResponse(ws, { action: requestAction.inputError, error: "Destination could not be updated" })
   }

   //if updated successfully, send response to driver 
   if (socketUser.online[getTrip.driver_id]) {
      helpers.outputResponse(ws, {
         ...payload,
         action: requestAction.tripDestinationUpdated,
         rider_id: riderData.token,
      }, socketUser.online[getTrip.driver_id])
   }
   //and reply the user
   helpers.outputResponse(ws, {
      rider_id: riderData.token,
      action: requestAction.tripDestinationUpdatedSuccessfully,
   })
}

//for delaying a ride
trip.delayRide = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   // console.log(payload)
   //send the request to the user
   if (socketUser.online[rider_id]) {
      helpers.outputResponse(ws, {
         action: requestAction.delayRideRequest,
         trip_id,
         rider_id,
         driver_id: ws._user_data.token,
      }, socketUser.online[rider_id])
   }
}

//for delaying a ride
trip.rejectDelayRide = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let driver_id = helpers.getInputValueString(payload, 'driver_id')
   // console.log(payload)
   if (!driver_id || driver_id.length < 2) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Driver's ID is required"
      })
   }

   //if the driver's phone is reachable
   if (socketUser.online[driver_id]) {
      //send the request to the driver
      helpers.outputResponse(ws, {
         action: requestAction.riderRejectDelayRide,
         trip_id,
         rider_id: ws._user_data.token,
      }, socketUser.online[driver_id])
      //reply the rider
      helpers.outputResponse(ws, {
         action: requestAction.riderRejectDelayRide,
         trip_id,
      })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Driver's phone is unreachable"
      })
   }
}

//for a rider to accept a ride delay
trip.acceptDelayRide = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let driver_id = helpers.getInputValueString(payload, 'driver_id')

   if (!trip_id || trip_id.length !== 24) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip id is required" })
   }
   if (!driver_id || driver_id.length < 5) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Driver id is required" })
   }

   //send the response to the driver and the user
   if (socketUser.online[driver_id]) {
      //update the trip to delay
      let t = new Date().toISOString()
      //update the data to arrive pickup
      let updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: trip_id },
         {
            ride_status: "delay",
            $set: {
               'riders.0.delay_trip_at': t,
               'riders.0.action': requestAction.delayRideRequestAccepted
            }
         },
         { new: true, lean: true }).catch(e => ({ error: e }))

      //check if it's not updated
      if (!updateData || updateData.error) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Could not delay ride" })
         //do somthing here
      }
      //send to the driver
      helpers.outputResponse(ws, {
         action: requestAction.delayRideRequestAccepted,
         trip_id,
      }, socketUser.online[driver_id])
      //send to the rider
      helpers.outputResponse(ws, {
         action: requestAction.delayRideRequestAccepted,
         trip_id, delay_trip_at: t
      })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Driver's phone is unreachable"
      })
   }
}

//for driver to continue delay ride
trip.continueDelayRide = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   if (socketUser.online[rider_id]) {
      helpers.outputResponse(ws, {
         action: requestAction.continueDelayRideRequest,
         trip_id,
         rider_id,
         driver_id: ws._user_data.token,
      }, socketUser.online[rider_id])
   }
}

//for delaying a ride
trip.rejectContinueDelayRide = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let driver_id = helpers.getInputValueString(payload, 'driver_id')
   // console.log(payload)
   if (!driver_id || driver_id.length < 2) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Driver's ID is required"
      })
   }
   //send the request to the user
   if (socketUser.online[driver_id]) {
      //send the request to the driver
      helpers.outputResponse(ws, {
         action: requestAction.riderRejectContinueDelayRide,
         trip_id,
         rider_id: ws._user_data.token,
      }, socketUser.online[driver_id])
      //reply the rider
      helpers.outputResponse(ws, {
         action: requestAction.riderRejectContinueDelayRide,
         trip_id,
      })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Driver's phone is unreachable"
      })
   }
}

//for a rider to continue a delay ride
trip.acceptContinueDelayRide = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   let driver_id = helpers.getInputValueString(payload, 'driver_id')

   if (!trip_id || trip_id.length !== 24) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip id is required" })
   }
   if (!driver_id || driver_id.length < 5) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Driver id is required" })
   }

   if (socketUser.online[driver_id]) {
      //update the trip to delay
      //update the data to arrive pickup
      let updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: trip_id },
         { ride_status: "on_ride", 'riders.0.stage': 3, 'riders.0.action': requestAction.driverStartTripSuccess }, { new: true, lean: true }).catch(e => ({ error: e }))

      //check if it's not updated
      if (!updateData || updateData.error) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Could not delay ride" })
         //do somthing here
      }
      //send to the driver
      helpers.outputResponse(ws, {
         action: requestAction.continueRideRequestAccepted,
         trip_id,
      }, socketUser.online[driver_id])
      //send to the user
      helpers.outputResponse(ws, {
         action: requestAction.continueRideRequestAccepted,
         trip_id,
      })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Driver's phone is unreachable"
      })
   }
}

//for canceling a trip
trip.cancelRequest = async (ws, payload) => {
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let cancelLevel = helpers.getInputValueString(payload, 'cancel_level')
   let userType = ws._user_data.user_type //get the user type

   //check the cancel level
   if (["1", "2", "3"].indexOf(cancelLevel) === -1) {
      return helpers.outputResponse(ws, { error: "Unknown cancel level", action: requestAction.inputError })
   }
   // console.log(payload)
   //clear timer and the old data
   clearTimeout(socketUser.requestDriverTimer[rider_id])
   delete socketUser.requestDriverTimer[rider_id]
   //get the rider pending request data
   let rData = socketUser.pendingTrip[rider_id];

   delete socketUser.pendingTrip[rider_id]
   //cancel level one (1) is just to cancel a request a driver has not accepted
   if (payload.cancel_level === "1") {
      // if the pending data is not found stop
      if (!rData) {
         return helpers.outputResponse(ws, { action: requestAction.tripCancelSuccessfully, rider_id })
      }
      //if a driver cancels a request, search for another driver
      if (userType === 'driver') {
         riderMethod['RequestClass' + rData.class](rData.ws, rData, rData.driver)
         helpers.outputResponse(ws, { action: requestAction.tripCancelSuccessfully, rider_id })
      } else {
         //send cancel event to driver's if request was sent
         if (rData.driver && rData.driver.length > 0) {
            for (let i of rData.driver) {
               if (socketUser.online[i]) {
                  helpers.outputResponse(ws,
                     { action: requestAction.tripRequestCanceled, rider_id },
                     socketUser.online[i])
               }
            }
         }
         //reply the request
         helpers.outputResponse(ws, { action: requestAction.tripCancelSuccessfully, rider_id })
      }
   } else {
      driverMethod.CancelRide(ws, payload)
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
   let getDstFare = helpers.getDistanceCoveredCharges(est_dst / 1000, 50)
   let total = Math.ceil(220 + getTimeFare + getDstFare);
   let estFare = `${total}-${total + Math.ceil(total / 2)}`
   return helpers.outputResponse(ws, { action: requestAction.tripEstimatedFare, fare: estFare })
}

//function to get a pending trip
trip.getPendingTrip = async (ws, payload) => {
   let trip_id = helpers.getInputValueString(payload, 'trip_id')
   //check the trip id
   if (!trip_id || trip_id.length !== 24) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid trip id is required" })
   }
   //find the trip
   let getTrip = await tripModel.TripRequests.aggregate([
      { $match: { _id: dbConnector.mongoose.Types.ObjectId(trip_id) } },
      {
         $lookup: {
            from: "drivers",
            localField: "driver_id",
            foreignField: "user_id",
            as: "driver_data"
         }
      },
      {
         $project: {
            riders: 1,
            ride_status: 1,
            ride_class: 1,
            ride_class_complete: 1,
            driver_data: 1
         }
      }
   ])
   if (getTrip && getTrip.error) {
      return
   }
   helpers.outputResponse(ws, { action: requestAction.pendingTrip, data: getTrip })
}

//function to handle a re-requesting of a driver when on a request
trip.driverOnRequest = async (ws, payload) => {
   let rider_id = helpers.getInputValueString(payload, 'rider_id')
   let driver_id = helpers.getInputValueString(payload, 'driver_id')
   //check if the request has been canceled
   if (!socketUser.pendingTrip[rider_id]) { return }
   //check if there's no driver ID
   if (!driver_id || driver_id.length < 5) { return }
   //if the request has been tried twice, don't try again
   if (payload.trial === 2) { return }
   //get the pending data
   let getPendData = socketUser.pendingTrip[rider_id]
   let sendData = {
      ...getPendData,
      action: requestAction.newTripRequest,
      trial: 2,
      driver: undefined,
      request_time: undefined,
      ws: undefined
   }
   //clear the timer request
   clearTimeout(socketUser.requestDriverTimer[rider_id])
   delete socketUser.requestDriverTimer[rider_id] //remove from the object
   //open another wait time to check on the driver
   setTimeout(() => {
      helpers.outputResponse(ws, sendData)
      riderMethod.requestDriverWaitFor30Sec(rider_id, getPendData.ws)
   }, 6000);

}

//function to send ride request/share invite
trip.shareRideInvite = async (ws, payload) => {
   let phone = helpers.getInputValueString(payload, "invitee_phone")
   let name = helpers.getInputValueString(payload, "name")
   let token = helpers.getInputValueString(payload, "token")
   let startLon = helpers.getInputValueNumber(payload, "start_lon")
   let startLat = helpers.getInputValueNumber(payload, "start_lat")
   let endLon = helpers.getInputValueNumber(payload, "end_lon")
   let endLat = helpers.getInputValueNumber(payload, "end_lat")
   let startAddr = helpers.getInputValueString(payload, "start_address")
   let endAddr = helpers.getInputValueString(payload, "end_address")
   let rideClass = helpers.getInputValueString(payload, "class")

   //check the name
   if (!name) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Name is required"
      })
   }

   //check the longitude 
   if (!startLon || isNaN(startLon) || !startLat || isNaN(startLat)) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Start longitude and latitude are required"
      })
   }
   //check the longitude 
   if (!endLon || isNaN(endLon) || !endLat || isNaN(endLat)) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "End longitude and latitude are required"
      })
   }
   //check the phone number
   if (!startAddr || !endAddr) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "start and end addresses are required"
      })
   }
   if (["B", "C", "D"].indexOf(rideClass) === -1) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Ride class is required. B, C or D"
      })
   }
   //check the phone number
   if (!phone || phone.length !== 11) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Invitee phone number is required"
      })
   }
   //check the phone number
   if (!token) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Token is required"
      })
   }
   //get the data from the server
   let getUser = await helpers.makeHTTPRequest({
      uri: `http://taxipassengerbackend-microservices.apps.waaron.com/api/passengers/${phone}`,
      method: "GET", headers: { "Authorization": token }
   })
   let inviteeData;
   try {
      inviteeData = typeof getUser === "object" ? getUser : JSON.parse(getUser)
   } catch (e) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Invitee data not found"
      })
   }
   //check if the data no found
   if (!inviteeData || !inviteeData.authId) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Invitee data not found"
      })
   }
   //send 
   let sendData = {
      ...payload,
      action: requestAction.rideInvitation,
      host_id: ws._user_data.token,
   }
   //if the invitee is online
   if (socketUser.online[inviteeData.authId]) {
      helpers.outputResponse(ws, sendData, socketUser.online[inviteeData.authId])
      helpers.outputResponse(ws, {
         action: requestAction.rideInvitationSent,
         invitee_phone: phone, class: payload.class
      })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "The user is not reachable at the moment. Please ensure the user has his/her Lagos Ride App opened"
      })
   }
}

trip.acceptRideInvite = async (ws, payload) => {

   let phone = helpers.getInputValueString(payload, "phone")
   let name = helpers.getInputValueString(payload, "name")
   let host_id = helpers.getInputValueString(payload, "host_id")

   //check the phone number
   if (!phone || phone.length !== 11) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Phone number is required"
      })
   }
   //check the phone number
   if (!name) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Name is required"
      })
   }
   if (!host_id) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Host id is required"
      })
   }
   let sendData = {
      ...payload,
      action: requestAction.riderAcceptRideInvite,
      rider_id: ws._user_data.token,
   }
   //check if the host is online
   if (socketUser.online[host_id]) {
      helpers.outputResponse(ws, sendData, socketUser.online[host_id])
      helpers.outputResponse(ws, {
         action: requestAction.riderAcceptRideInviteSuccessfully,
      })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "The host is not reachable at the moment"
      })
   }
}

trip.cancelRideInvite = async (ws, payload) => {

   let phone = helpers.getInputValueString(payload, "phone")
   let name = helpers.getInputValueString(payload, "name")
   let host_id = helpers.getInputValueString(payload, "host_id")

   //check the phone number
   if (!phone || phone.length !== 11) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Phone number is required"
      })
   }
   //check the phone number
   if (!name) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Name is required"
      })
   }
   if (!host_id) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Host id is required"
      })
   }
   let sendData = {
      ...payload,
      action: requestAction.riderCancelRideInvite,
      invitee_phone: phone,
   }
   //check if the host is online
   if (socketUser.online[host_id]) {
      helpers.outputResponse(ws, sendData, socketUser.online[host_id])
      helpers.outputResponse(ws, {
         action: requestAction.riderCancelRideInviteSuccessfully,
      })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "The host is not reachable at the moment"
      })
   }
}

module.exports = trip;