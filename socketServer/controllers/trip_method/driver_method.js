const helpers = require('../../assets/helpers')
const requestAction = require('../../assets/requestAction')
const driverModel = require('../../../models/driver')
const socketUser = require('../../assets/socketUser')
const tripModel = require('../../../models/trip_request')

const driverMethod = {}
//for getting rider full data
const getRiderData = (payload, pendingData) => {
   return {
      rider_id: payload.rider_id,
      name: pendingData.name,
      email: pendingData.email,
      phone: pendingData.phone,
      startAddr: pendingData.start_address,
      endAddr: pendingData.end_address,
      est_dst: pendingData.distance,
      est_time: pendingData.est_time,
      est_fare: pendingData.est_fare,
      accepted_at: new Date().toISOString(),
      arrive_pickup_at: '',
      start_trip_at: '',
      end_trip_at: '',
      waiting_time: 0,
      end_time: 0,
      total_distance: 0,
      status: "request_accepted",
      fare: 0,
   }
}

//for getting waiting time charge
const getWaitingTimeCharges = (waitingTime, maxAllowTimeInSec = 180, chargePerMinute = 50) => {
   let getTimeSpent = waitingTime ? (waitingTime > maxAllowTimeInSec) ? waitingTime - maxAllowTimeInSec : 0 : 0
   let chargePerSec = chargePerMinute / 60
   return Math.ceil(chargePerSec * getTimeSpent)

}

//for getting waiting time charge
const getDistanceCoveredCharges = (totalDstInKM, chargePerKM = 100) => {
   if (isNaN(totalDstInKM)) return //if there's no valid value return
   totalDstInKM = parseFloat(totalDstInKM)
   let chargePerMeter = chargePerKM / 1000 //get the charge per meter
   return Math.ceil((totalDstInKM * 1000) * chargePerMeter)
}

//for getting waiting time charge
const getTimeCoveredCharges = (totalTimeInSec, chargePerMinute = 100) => {
   if (isNaN(totalTimeInSec)) return //if there's no valid value return
   let chargePerSec = chargePerMinute / 60 //get the charge per second
   return Math.ceil(totalTimeInSec * chargePerSec) //calculate the prce
}




//function that handles class A ride acceptance for driver
driverMethod.AcceptClassA = async (ws, payload, pendingData) => {
   //get the driver's unique id
   let driverId = ws._user_data.token
   // update the driver's trip data
   let updateData = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: true }, { new: true }).catch(e => ({ error: e }))
   //if there's an error 
   if (!updateData || updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }

   //delete the request from pending requests
   delete socketUser.pendingTrip[payload.rider_id]

   //Saving the trip in the trip table
   let riderData = getRiderData(payload, pendingData)

   //save the trip data
   let saveTrip = await tripModel.TripRequests.create({
      driver_id: driverId,
      riders: riderData,
      ride_status: "waiting",
      ride_class: 'A',
      location: [{
         origin: { coordinates: [pendingData.start_lon, pendingData.start_lat] },
         destination: { coordinates: [pendingData.end_lon, pendingData.end_lat] }
      }]
   }).catch(e => ({ error: e }))

   // send response to the driver
   let sendData = {
      action: requestAction.tripRequestAvailabe,
      rider_id: payload.rider_id,
      class: 'A', trip_id: saveTrip._id
   }
   helpers.outputResponse(ws, sendData)

   //send response to the user (rider) that a driver accepts the request
   if (socketUser.online[payload.rider_id]) {
      let sendData1 = {
         ...payload,
         car_plate_number: pendingData.driver.car_plate_number,
         car_color: pendingData.driver.car_color,
         car_model: pendingData.driver.car_model,
         trip_id: saveTrip._id,
         action: requestAction.driverAcceptRequest
      }
      helpers.outputResponse(ws, sendData1, socketUser.online[payload.rider_id])
   }
}


//function that handles class B ride acceptance for driver
driverMethod.AcceptClassB = async (ws, payload, pendingData) => {
   //get the driver's unique id
   let driverId = ws._user_data.token
   //get the rider's position (if first rider or second rider)
   let riderNumber = pendingData.rider
   // update the driver's trip data
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: riderNumber === 2 ? true : false }, { new: true }).catch(e => ({ error: e }))
   //if there's an error 
   if (!updateDriver || updateDriver.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }

   //Saving the trip in the class be trip table
   let riderData = getRiderData(payload, pendingData)
   //Save the data in the database
   if (riderNumber === 1) {
      let saveTrip = await tripModel.TripRequests.create({
         driver_id: driverId,
         riders: riderData,
         ride_status: "waiting",
         ride_class: 'B',
         location: [{
            origin: { coordinates: [pendingData.start_lon, pendingData.start_lat] },
            destination: { coordinates: [pendingData.end_lon, pendingData.end_lat] }
         }]
      }).catch(e => ({ error: e }))
      //check if the trip is
      if (!saveTrip || saveTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //send response to the user (rider) that a driver accepts the request
      let sendData = {
         ...payload,
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         class: "B",
         action: requestAction.driverAcceptRequest,
         rider: 1,
         trip_id: saveTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "B", rider: 1, rider_id: payload.rider_id, trip_id: saveTrip._id })
   } else {
      //get the record ID of the first rider
      let recordID = pendingData.trip_id
      recordID = String(recordID)
      // if the record is is not a valid mongo id
      if (typeof recordID !== 'string' && recordID.length !== 24) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip could not be found" })
      }
      //update the data
      let updateTrip = await tripModel.TripRequests.findOneAndUpdate({ _id: recordID, driver_id: driverId },
         {
            $push: { riders: riderData },
            ride_status: "on_ride",
         }, { new: true, }).catch(e => ({ error: e }))

      //if there's error
      if (!updateTrip || updateTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //send response to the user (rider) that a driver accepts the request
      let sendData = {
         ...payload,
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         class: "B",
         action: requestAction.driverAcceptRequest,
         rider: 2,
         riders: updateTrip.riders,
         trip_id: updateTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "B", rider: 2, rider_id: payload.rider_id, trip_id: updateTrip._id })
   }
}


//function that handles class C ride acceptance for driver
driverMethod.AcceptClassC = async (ws, payload, pendingData) => {
   //get the driver's unique id
   let driverId = ws._user_data.token
   //get the rider's position (if first rider or second rider)
   let riderNumber = pendingData.rider
   // update the driver's trip data
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: riderNumber === 3 ? true : false }, { new: true }).catch(e => ({ error: e }))
   //if there's an error 
   if (!updateDriver || updateDriver.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }

   //Saving the trip in the class be trip table
   let riderData = getRiderData(payload, pendingData)

   //Save the data in the database
   if (riderNumber === 1) {
      let saveTrip = await tripModel.TripRequests.create({
         driver_id: driverId,
         riders: riderData,
         ride_status: "waiting",
         ride_class: "C",
         location: [{
            origin: { coordinates: [pendingData.start_lon, pendingData.start_lat] },
            destination: { coordinates: [pendingData.end_lon, pendingData.end_lat] }
         }]
      }).catch(e => ({ error: e }))
      //check if the trip is
      if (!saveTrip || saveTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //send response to the user (rider) that a driver accepts the request
      let sendData = {
         ...payload,
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         class: "C",
         action: requestAction.driverAcceptRequest,
         rider: 1,
         trip_id: saveTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "C", rider: 1, rider_id: payload.rider_id, trip_id: saveTrip._id })
   } else {
      //get the record ID of the first rider
      let recordID = pendingData.trip_id
      recordID = String(recordID)
      // if the record is is not a valid mongo id
      if (typeof recordID !== 'string' && recordID.length !== 24) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip could not be found" })
      }
      //update the data
      let updateTrip = await tripModel.TripRequests.findOneAndUpdate({ _id: recordID, driver_id: driverId },
         {
            $push: { riders: riderData },
            ride_status: pendingData.rider === 3 ? "on_ride" : "waiting",
         }, { new: true }).catch(e => ({ error: e }))

      //if there's error
      if (!updateTrip || updateTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }

      //send response to the user (rider) that a driver accepts the request
      let sendData = {
         ...payload,
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         class: "C",
         action: requestAction.driverAcceptRequest,
         rider: payload.rider,
         riders: updateTrip.riders,
         trip_id: updateTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
      //send the response to the driver
      let sendData1 = {
         action: requestAction.tripRequestAvailabe,
         class: "C", rider: pendingData.rider,
         rider_id: payload.rider_id,
         trip_id: updateTrip._id
      }
      helpers.outputResponse(ws, sendData1)
   }
}

// when the driver arrives the pickup location
driverMethod.ArrivePickUp = async (ws, payload) => {
   let rideClass = payload.class
   let updateData;
   let arriveTime = new Date().toISOString()
   if (rideClass === "A") {
      //update the data to arrive pickup
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime } }, { new: true }).catch(e => ({ error: e }))
   } else if (rideClass === "B") {
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime } }, { new: true }).catch(e => ({ error: e }))

   } else if (rideClass === "C") {
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime } }, { new: true }).catch(e => ({ error: e }))
   } else {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Class" })
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
      //do somthing here
   }
   //send the response to the rider (user)
   if (socketUser.online[payload.rider_id]) {
      helpers.outputResponse(ws, { action: requestAction.driverArrivePickUp }, socketUser.online[payload.rider_id])
   }
}


//when the driver start trip
driverMethod.StartRide = async (ws, payload) => {
   let rideClass = payload.class
   let startTime = new Date().toISOString()
   let updateData;
   if (rideClass === 'A') {
      //update the data to arrive start trip
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
         {
            $set: {
               'riders.0.status': 'picked',
               'riders.0.start_trip_at': startTime,
               'riders.0.waiting_time': payload.riders[0].waiting_time,
            }, ride_status: 'on_ride'
         }, { new: true }).catch(e => ({ error: e }))
   } else if (rideClass === 'B') {
      //check the riders data length
      if (payload.riders.length !== 2) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Incomplete riders data" })
      }
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
         {
            $set: {
               'riders.$[].status': 'picked', 'riders.$[].start_trip_at': startTime,
               'riders.$[first].waiting_time': payload.riders[0].waiting_time,
               'riders.$[second].waiting_time': payload.riders[1].waiting_time,
            },
            ride_status: 'on_ride'
         },
         {
            arrayFilters: [
               { "first.rider_id": payload.riders[0].rider_id },
               { "second.rider_id": payload.riders[1].rider_id }
            ],
            new: true
         }
      ).catch(e => ({ error: e }))

   } else if (rideClass === 'C') {
      //check the riders data length
      if (payload.riders.length !== 3) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Incomplete riders data" })
      }
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
         {
            $set: {
               'riders.$[].status': 'picked', 'riders.$[].start_trip_at': startTime,
               'riders.$[first].waiting_time': payload.riders[0].waiting_time,
               'riders.$[second].waiting_time': payload.riders[1].waiting_time,
               'riders.$[third].waiting_time': payload.riders[2].waiting_time,
            },
            ride_status: 'on_ride'
         },
         {
            arrayFilters: [
               { "first.rider_id": payload.riders[0].rider_id },
               { "second.rider_id": payload.riders[1].rider_id },
               { "third.rider_id": payload.riders[2].rider_id },
            ],
            new: true
         }
      ).catch(e => ({ error: e }))
   } else {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Class" })
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      //do somthing here
      return helpers.outputResponse(ws, { action: requestAction.serverError, })
   }
   //send the response to the rider(s)
   for (let i of payload.riders) {
      if (socketUser.online[i.rider_id]) {
         helpers.outputResponse(ws, {
            action: requestAction.driverStartTripSuccess,
            rider_id: payload.rider_id,
            class: payload.class,
         }, socketUser.online[i.rider_id])
      }
   }
   //send the response to the driver
   helpers.outputResponse(ws, {
      action: requestAction.driverStartTripSuccess,
      rider_id: payload.rider_id,
      class: payload.class,
   })
}

//when the driver ends trip
driverMethod.EndRide = async (ws, payload) => {
   let rideClass = payload.class
   let endTime = new Date().toISOString()
   let updateData;
   //get the user that the trip is ending for
   let getUser = await tripModel.TripRequests.findOne({ _id: payload.trip_id }, null, { lean: true }).catch(e => ({ error: e }))
   //check if error
   if (!getUser || getUser.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   //get the person data
   let userData = getUser.riders[getUser.riders.findIndex(e => e.rider_id === payload.rider_id)]

   let waitingTime = parseInt(userData.waiting_time) //get the waiting time
   let estTime = parseInt(userData.est_time) //get the estimated time
   let estDst = parseFloat(userData.est_dst) //get the estimated distance
   let totalTimeCovered = parseInt(payload.end_time)
   let totalDstCovered = parseFloat(payload.total_distance)
   //fix fares
   let baseFare = 220
   let timeFarePerMinute = 15
   let distanceFarePerKM = 50
   let waitingFarePerMinute = 10
   //variable
   let totalFare;
   let getFare
   //get the waiting time far
   let getWaitingFare = getWaitingTimeCharges(waitingTime, 180, waitingFarePerMinute)
   //if the time covered is more than the est time or the distance covered is less than the estimated distance
   if ((totalTimeCovered > estTime) || (totalDstCovered < estDst)) {
      //then calculate fare by time
      getFare = getTimeCoveredCharges(totalTimeCovered, timeFarePerMinute)
      //split the fare if not a class a ride
      if (payload.class !== 'A') {
         getFare /= payload.class === 'B' ? 2 : payload.class === 'C' ? 3 : 4
      }
   } else {
      //else calculate fare by distance
      getFare = getDistanceCoveredCharges(totalDstCovered, distanceFarePerKM)
      //split the fare if not a class a ride
      if (payload.class !== 'A') {
         getFare /= payload.class === 'B' ? 2 : payload.class === 'C' ? 3 : 4
      }
   }
   //sum the total fare
   totalFare = Math.ceil(getFare + getWaitingFare + baseFare)

   //clear the driver from ontrip
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: ws._user_data.token },
      { on_trip: false, 'location.coordinates': [payload.longitude, payload.latitude] }, { new: true }).catch(e => ({ error: e }))
   //check if it's not updated
   if (!updateDriver || updateDriver.error) {
      helpers.outputResponse(ws, { action: requestAction.inputError, error: "Your status could not be set to available. Please contact support" })
   }

   // update the trip data for the riders
   if (rideClass === 'A') {
      //update the data to arrive pickup
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         {
            $set: {
               'riders.0.status': 'completed',
               'riders.0.end_trip_at': endTime,
               'riders.0.end_time': totalTimeCovered,
               'riders.0.total_distance': totalDstCovered,
               'riders.0.fare': totalFare
            }, ride_status: 'completed'
         }, { new: true }).catch(e => ({ error: e }))
   } else if (rideClass === 'B') {
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         {
            $set: {
               'riders.$.status': 'completed',
               'riders.$.end_trip_at': endTime,
               'riders.$.end_time': totalTimeCovered,
               'riders.$.total_distance': totalDstCovered,
               'riders.$.fare': totalFare
            }, ride_status: payload.rider === 2 ? 'completed' : 'on_ride'
         }, { new: true }).catch(e => ({ error: e }))

   } else if (rideClass === 'C') {
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         {
            $set: {
               'riders.$.status': 'completed',
               'riders.$.end_trip_at': endTime,
               'riders.$.end_time': totalTimeCovered,
               'riders.$.total_distance': totalDstCovered,
               'riders.$.fare': totalFare
            }, ride_status: payload.rider === 3 ? 'completed' : 'on_ride'
         }, { new: true }).catch(e => ({ error: e }))
   } else {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Class" })
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      helpers.outputResponse(ws, { action: requestAction.inputError, error: "Could not update the trip details" })
      // return
      //do somthing here
   }

   //send the respond to the user
   let sendData = {
      action: requestAction.driverEndRide,
      trip_id: payload.trip_id,
      class: payload.class,
      rider_id: payload.rider_id,
      fare: totalFare
   }
   //send the response to the rider (user)
   if (socketUser.online[payload.rider_id]) {
      helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
   }

   //send the response to the driver
   sendData.action = requestAction.driverEndRideSuccessfully
   helpers.outputResponse(ws, sendData)

}






module.exports = driverMethod;
