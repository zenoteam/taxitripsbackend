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
      rider: pendingData.rider,
      name: pendingData.name,
      email: pendingData.email,
      phone: pendingData.phone,
      avatar: pendingData.avatar,
      start_lon: pendingData.start_lon,
      start_lat: pendingData.start_lat,
      end_lon: pendingData.end_lon,
      end_lat: pendingData.end_lat,
      start_address: pendingData.start_address,
      end_address: pendingData.end_address,
      est_dst: pendingData.distance,
      est_time: pendingData.est_time,
      est_fare: pendingData.est_fare,
      accepted_at: new Date().toISOString(),
      arrive_pickup_at: '',
      start_trip_at: '',
      end_trip_at: '',
      waiting_time: 0,
      end_time: 0,
      delay_time: 0,
      total_distance: 0,
      status: "request_accepted",
      cancel_reason: {},
      previous_destination: [],
      fare: 0,
   }
}



//function that handles class A ride acceptance for driver
driverMethod.AcceptClassA = async (ws, payload, pendingData) => {
   //get the driver's unique id
   let driverId = ws._user_data.token
   // update the driver's trip data
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: "yes" }, { new: true }).catch(e => ({ error: e }))
   //if there's an error 
   if (!updateDriver || updateDriver.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   //delete the request from pending requests
   delete socketUser.pendingTrip[payload.rider_id]

   //Saving the trip in the trip table
   let riderData = getRiderData(payload, pendingData)
   riderData.rider = 1 //add the rider position
   //save the trip data
   let saveTrip = await tripModel.TripRequests.create({
      driver_id: driverId,
      riders: riderData,
      ride_status: "waiting",
      ride_class: "A",
      rider_compass: payload.rider_id,
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
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         trip_id: saveTrip._id,
         driver_id: driverId,
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
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: riderNumber === 1 ? "waiting" : "yes" }, { new: true }).catch(e => ({ error: e }))
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
         ride_class: "B",
         rider_compass: payload.rider_id,
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
         riders: saveTrip.riders,
         driver_id: driverId,
         trip_id: saveTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
      //send the response to the driver
      helpers.outputResponse(ws, {
         action: requestAction.tripRequestAvailabe,
         class: "B", rider: 1,
         rider_id: payload.rider_id,
         trip_id: saveTrip._id
      })
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
         }, { new: true, lean: true }).catch(e => ({ error: e }))
      //if there's error
      if (!updateTrip || updateTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]

      //get all the riders who are still on trip
      let onTripRiders = updateTrip.riders.filter(d => d.status !== "cancel")

      let sendData = {
         ...payload,
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         class: "B",
         action: requestAction.driverAcceptRequest,
         rider: 2,
         driver_id: driverId,
         riders: onTripRiders,
         trip_id: updateTrip._id
      }

      //send the response to the driver
      helpers.outputResponse(ws, {
         action: requestAction.tripRequestAvailabe,
         class: "B", rider: 2,
         rider_id: payload.rider_id,
         trip_id: updateTrip._id
      })
      //send the response to the riders
      for (let i of onTripRiders) {
         //if the user's trip was not cancel
         if (i.rider_id !== payload.rider_id && i.status !== "cancel") {
            //if the user is online
            if (socketUser.online[i.rider_id]) {
               // console.log('Sent response to', i.rider_id)
               helpers.outputResponse(ws, {
                  ...pendingData,
                  action: requestAction.newRideJoin,
                  riders: onTripRiders,
               }, socketUser.online[i.rider_id])
            } else {
               // console.log('Rider not online', i.rider_id)
            }
         } else {
            // console.log('No Ride to send the response')
         }
      }
      //send the response to the last rider
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
   }
}

//function that handles class C ride acceptance for driver
driverMethod.AcceptClassC = async (ws, payload, pendingData) => {
   //get the driver's unique id
   let driverId = ws._user_data.token
   //get the rider's position (if first rider or second rider)
   let riderNumber = pendingData.rider
   // update the driver's trip data
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: riderNumber === 3 ? "yes" : "waiting" }, { new: true }).catch(e => ({ error: e }))
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
         rider_compass: payload.rider_id,
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
         riders: saveTrip.riders,
         driver_id: driverId,
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
         }, { new: true, lean: true }).catch(e => ({ error: e }))

      //if there's error
      if (!updateTrip || updateTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //get all the riders who are still on trip
      let onTripRiders = updateTrip.riders.filter(d => d.status !== "cancel")

      let sendData = {
         ...payload,
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         class: "C",
         action: requestAction.driverAcceptRequest,
         rider: payload.rider,
         riders: onTripRiders,
         trip_id: updateTrip._id,
         driver_id: driverId,
      }
      //send the response to the driver
      helpers.outputResponse(ws, {
         action: requestAction.tripRequestAvailabe,
         class: "C", rider: onTripRiders.length,
         rider_id: payload.rider_id,
         trip_id: updateTrip._id
      })
      //send the response to the riders
      for (let i of onTripRiders) {
         //if the user's trip was not cancel
         if (i.rider_id !== payload.rider_id && i.status !== "cancel") {
            //if the user is online
            if (socketUser.online[i.rider_id]) {
               // console.log('Sent response to', i.rider_id)
               helpers.outputResponse(ws, {
                  ...pendingData,
                  riders: onTripRiders,
                  action: requestAction.newRideJoin
               }, socketUser.online[i.rider_id])
            } else {
               // console.log('Rider not online', i.rider_id)
            }
         } else {
            // console.log('No Ride to send the response')
         }
      }
      //send the response to the last rider
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
   }
}

//function that handles class C ride acceptance for driver
driverMethod.AcceptClassD = async (ws, payload, pendingData) => {
   //get the driver's unique id
   let driverId = ws._user_data.token
   //get the rider's position (if first rider or second rider)
   let riderNumber = pendingData.rider
   // update the driver's trip data
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: riderNumber === 4 ? "yes" : "waiting" }, { new: true }).catch(e => ({ error: e }))
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
         ride_class: "D",
         rider_compass: payload.rider_id,
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
         class: "D",
         action: requestAction.driverAcceptRequest,
         rider: 1,
         riders: saveTrip.riders,
         driver_id: driverId,
         trip_id: saveTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "D", rider: 1, rider_id: payload.rider_id, trip_id: saveTrip._id })
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
            ride_status: pendingData.rider === 4 ? "on_ride" : "waiting",
         }, { new: true }).catch(e => ({ error: e }))

      //if there's error
      if (!updateTrip || updateTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //get all the riders who are still on trip
      let onTripRiders = updateTrip.riders.filter(d => d.status !== "cancel")

      let sendData = {
         ...payload,
         car_plate_number: updateDriver.car_plate_number,
         car_color: updateDriver.car_color,
         car_model: updateDriver.car_model,
         class: "D",
         action: requestAction.driverAcceptRequest,
         rider: payload.rider,
         riders: onTripRiders,
         trip_id: updateTrip._id,
         driver_id: driverId,
      }
      //send the response to the driver
      helpers.outputResponse(ws, {
         action: requestAction.tripRequestAvailabe,
         class: "D", rider: onTripRiders.length,
         rider_id: payload.rider_id,
         trip_id: updateTrip._id
      })
      //send the response to the riders
      for (let i of onTripRiders) {
         //if the user's trip was not cancel
         if (i.rider_id !== payload.rider_id && i.status !== "cancel") {
            //if the user is online
            if (socketUser.online[i.rider_id]) {
               // console.log('Sent response to', i.rider_id)
               helpers.outputResponse(ws, {
                  ...pendingData,
                  riders: onTripRiders,
                  action: requestAction.newRideJoin
               }, socketUser.online[i.rider_id])
            } else {
               // console.log('Rider not online', i.rider_id)
            }
         } else {
            // console.log('No Ride to send the response')
         }
      }
      //send the response to the last rider
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
   }
}

// when the driver arrives the pickup location
driverMethod.ArrivePickUp = async (ws, payload) => {
   let rideClass = payload.class
   let updateData;
   let arriveTime = new Date().toISOString()
   if (["A", "B", "C", "D"].indexOf(rideClass) > -1) {
      //update the data to arrive pickup
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime } }, { new: true, lean: true }).catch(e => ({ error: e }))
   } else {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Class" })
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
      //do somthing here
   }
   //send the response to the rider (user)
   // if (socketUser.online[payload.rider_id]) {
   //    helpers.outputResponse(ws, { action: requestAction.driverArrivePickUp }, socketUser.online[payload.rider_id])
   //also send to other riders
   for (let i of updateData.riders) {
      if (i.status !== 'cancel') {
         if (socketUser.online[i.rider_id]) {
            helpers.outputResponse(ws, {
               rider_id: payload.rider_id,
               action: requestAction.driverArrivePickUp
            }, socketUser.online[i.rider_id])
         }
      }
   }
   // }
}

//when the driver start trip
driverMethod.StartRide = async (ws, payload) => {
   let rideClass = payload.class
   let startTime = new Date().toISOString()
   let updateData;
   if (rideClass === "A") {
      //update the data to arrive start trip
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
         {
            $set: {
               'riders.0.status': 'picked',
               'riders.0.start_trip_at': startTime,
               'riders.0.waiting_time': payload.riders[0].waiting_time,
            }, ride_status: 'on_ride'
         }, { new: true }).catch(e => ({ error: e }))
   } else if (rideClass === "B") {
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

   } else if (rideClass === "C") {
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
   } else if (rideClass === "D") {
      //check the riders data length
      if (payload.riders.length !== 4) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Incomplete riders data" })
      }
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
         {
            $set: {
               'riders.$[].status': 'picked', 'riders.$[].start_trip_at': startTime,
               'riders.$[first].waiting_time': payload.riders[0].waiting_time,
               'riders.$[second].waiting_time': payload.riders[1].waiting_time,
               'riders.$[third].waiting_time': payload.riders[2].waiting_time,
               'riders.$[forth].waiting_time': payload.riders[3].waiting_time,
            },
            ride_status: 'on_ride'
         },
         {
            arrayFilters: [
               { "first.rider_id": payload.riders[0].rider_id },
               { "second.rider_id": payload.riders[1].rider_id },
               { "third.rider_id": payload.riders[2].rider_id },
               { "forth.rider_id": payload.riders[3].rider_id },
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
   let totalTimeCovered = parseInt(payload.end_time)
   let totalDstCovered = parseFloat(payload.total_distance)
   //fix fares
   let baseFare = 220
   let timeFarePerMinute = 15
   let distanceFarePerKM = 50
   let waitingFarePerMinute = 10
   //variable
   let totalFare;
   //get the waiting time far
   let getWaitingFare = helpers.getWaitingTimeCharges(waitingTime, 180, waitingFarePerMinute)
   //if the time covered is more than the est time or the distance covered is less than the estimated distance

   //get time fare
   //then calculate fare by time
   let getTimeFare = helpers.getTimeCoveredCharges(totalTimeCovered, timeFarePerMinute)
   //split the fare if not a class a ride
   if (payload.class !== "A") {
      getTimeFare /= payload.class === "B" ? 2 : payload.class === "C" ? 3 : 4
   }

   //get distance fare
   //else calculate fare by distance
   let getDstFare = helpers.getDistanceCoveredCharges(totalDstCovered, distanceFarePerKM)
   //split the fare if not a class a ride
   if (payload.class !== "A") {
      getDstFare /= payload.class === "B" ? 2 : payload.class === "C" ? 3 : 4
   }

   //sum the total fare
   totalFare = Math.ceil(getTimeFare + getDstFare + getWaitingFare + baseFare)
   //get people that hv been dropped off
   let dropOffRiders = getUser.riders.filter(d => d.status === 'completed')
   //clear the driver from ontrip
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: ws._user_data.token },
      { on_trip: "no", 'location.coordinates': [payload.longitude, payload.latitude] },
      { new: true }).catch(e => ({ error: e }))
   //check if it's not updated
   if (!updateDriver || updateDriver.error) {
      helpers.outputResponse(ws, { action: requestAction.inputError, error: "Your status could not be set to available. Please contact support" })
   }
   // update the trip data for the riders
   if (["A", "B", "C", "D"].indexOf(rideClass) > -1) {
      //update the data to arrive pickup
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         {
            $set: {
               'riders.$.status': 'completed',
               'riders.$.end_trip_at': endTime,
               'riders.$.end_time': totalTimeCovered,
               'riders.$.total_distance': totalDstCovered,
               'riders.$.fare': totalFare
            },
            ride_status: rideClass === "A" ? "completed" :
               (rideClass === "B" && dropOffRiders.length === 1) ? "completed" :
                  (rideClass === "C" && dropOffRiders.length === 2) ? "completed" :
                     (rideClass === "D" && dropOffRiders.length === 3) ? "completed" : "on_ride"
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
   //add the distance and the tm the driver has covered
   if ((rideClass === "B" && dropOffRiders.length === 1) ||
      (rideClass === "C" && dropOffRiders.length === 2) ||
      (rideClass === "D" && dropOffRiders.length === 3) ||
      rideClass === "A") {
      let addDriverKM = await tripModel.DriverWorkHours.create({
         user_id: ws._user_data.token,
         trip_id: payload.trip_id,
         km: payload.total_distance,
         time: payload.end_time
      })
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

//when canceling a ride
driverMethod.CancelRide = async (ws, payload) => {
   let rider_id = payload.rider_id
   let trip_id = payload.trip_id
   let reason_option = payload.reason_option
   let reason_others = payload.reason_others
   let userType = ws._user_data.user_type //get the user type

   if (payload.cancel_level === "2") {
      //cancel level 2 is when a driver accepts a request
      if (!trip_id || trip_id.length !== 24) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip id is required" })
      }
      //get the trip
      let getTrip = await tripModel.TripRequests.findOne({ _id: trip_id, riders: { $elemMatch: { rider_id } } }, null, { lean: true }).catch(e => ({ error: e }))
      //if there's an error
      if (getTrip && getTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //if there's not trip associated
      if (!getTrip) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not found" })
      }
      let cancelData = {
         cancel_by: userType === "driver" ? "driver" : "rider",
         cancel_reason_option: reason_option,
         cancel_reason_others: reason_others
      }
      //get the location compass use for the trip
      let getCompass = (getTrip.ride_class !== "A" && getTrip.rider_compass === rider_id) ? true : false
      //get all the riders who has not canceled the trip
      let onTripUser = getTrip.riders.filter(e => e.status !== "cancel")
      let newCompase;
      //if the canceler was the compass, assign a new compass
      if (getCompass) {
         newCompase = onTripUser[onTripUser.findIndex(e => e.rider_id !== rider_id)]
         //if there's no other rider to take the compass
         if (!newCompase || !newCompase.start_lat) {
            newCompase = { start_lat: 0, start_lon: 0, end_lat: 0, end_lon: 0, rider_id: 'none' }
         }
      }

      //cancel the trip
      let cancelTrip = await tripModel.TripRequests.findOneAndUpdate({ _id: trip_id, riders: { $elemMatch: { rider_id } } },
         {
            ride_status: getTrip.ride_class === "A" ? "cancel" : onTripUser.length === 1 ? "cancel" : "waiting",
            $set: getCompass ?
               {
                  'riders.$.status': 'cancel',
                  'riders.$.cancel_reason': cancelData,
                  'location.0.origin.coordinates': [newCompase.start_lon, newCompase.start_lat],
                  'location.0.destination.coordinates': [newCompase.end_lon, newCompase.end_lat],
                  rider_compass: newCompase.rider_id
               } :
               {
                  'riders.$.status': 'cancel',
                  'riders.$.cancel_reason': cancelData,
               },
         },
         { new: true, lean: true }
      )
      //check for error
      if (!cancelTrip || cancelTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Request could not be canceled" })
      }

      //free the driver 
      let updateDriver = await driverModel.findOneAndUpdate({ user_id: cancelTrip.driver_id },
         { on_trip: onTripUser.length === 1 ? "no" : "waiting" }).catch(e => ({ error: e }))

      //notify all the riders that a ride has been canceled
      for (let i of onTripUser) {
         //send to all the riders on the trip
         if (socketUser.online[i.rider_id] && i.status !== "cancel" && i.rider_id !== rider_id) {
            helpers.outputResponse(ws, {
               action: requestAction.tripRequestCanceled,
               cancel_level: payload.cancel_level,
               rider_id, trip_id
            }, socketUser.online[i.rider_id])
         }
      }
      //send the response to the appropriate user
      if ((userType === "driver" && socketUser.online[payload.rider_id]) ||
         (userType !== "driver" && socketUser.online[cancelTrip.driver_id])) {
         helpers.outputResponse(ws, {
            action: requestAction.tripRequestCanceled,
            cancel_level: payload.cancel_level,
            rider_id, trip_id
         }, userType === "driver" ? socketUser.online[payload.rider_id] : socketUser.online[cancelTrip.driver_id])
      }

      //reply the user who initiated the request
      helpers.outputResponse(ws, {
         action: requestAction.tripCancelSuccessfully,
         cancel_level: payload.cancel_level,
         rider_id, trip_id
      })
   } else {
      delete socketUser.online[rider_id] //
      helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown cancel level" })
      //log the data on the database
      ///calculate the price the user has to pay for this level
   }
}


module.exports = driverMethod;

