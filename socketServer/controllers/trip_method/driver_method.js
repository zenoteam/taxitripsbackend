const helpers = require('../../assets/helpers')
const requestAction = require('../../assets/requestAction')
const driverModel = require('../../../models/driver')
const socketUser = require('../../assets/socketUser')
const tripModel = require('../../../models/trip_request')

const driverMethod = {}

//function that handles class A ride acceptance by the driver
driverMethod.AcceptClassA = async (ws, payload, pendingData) => {
   // //delete the request from pending requests
   // delete socketUser.pendingTrip[payload.rider_id]
   // // send response to the driver
   // helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, rider_id: payload.rider_id, class: 'A' })
   // return

   //get the driver's unique id
   let driverId = ws._user_data.token
   // update the driver's trip data
   let updateData = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: true }, { upsert: true }).catch(e => ({ error: e }))
   //if there's an error 
   if (!updateData || updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }

   //delete the request from pending requests
   delete socketUser.pendingTrip[payload.rider_id]

   //Saving the trip in the class be trip table
   let riderData = {
      rider_id: payload.rider_id,
      name: pendingData.name,
      email: pendingData.email,
      phone: pendingData.phone,
      startAddr: pendingData.start_address,
      endAddr: pendingData.end_address,
      distance: pendingData.distance,
      accepted_at: new Date().toISOString(),
      arrive_pickup_at: '',
      start_trip_at: '',
      end_trip_at: '',
      status: "request_accepted",
      fare: 0,
   }

   //save the trip data
   let saveTrip = await tripModel.TripClassA.create({
      driver_id: driverId,
      riders: riderData,
      ride_status: "waiting"
   }).catch(e => ({ error: e }))

   // send response to the driver
   helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, rider_id: payload.rider_id, class: 'A', trip_id: saveTrip._id })

   //send response to the user (rider) that a driver accepts the request
   let sendData = {
      ...payload,
      car_plate_number: pendingData.driver.car_plate_number,
      car_color: pendingData.driver.car_color,
      car_model: pendingData.driver.car_model,
      trip_id: saveTrip._id,
      action: requestAction.driverAcceptRequest
   }
   helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
}



//function that handles class B ride acceptance by the driver
driverMethod.AcceptClassB = async (ws, payload, pendingData) => {
   // //delete the request from pending requests
   // delete socketUser.pendingTrip[payload.rider_id]
   // // send response to the driver
   // helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, rider_id: payload.rider_id, class: 'B' })
   // return

   //get the driver's unique id
   let driverId = ws._user_data.token
   //get the rider's position (if first rider or second rider)
   let riderNumber = pendingData.rider
   // update the driver's trip data
   let updateData = await driverModel.findOneAndUpdate({ user_id: driverId }, { on_trip: riderNumber === 2 ? true : false }, { upsert: true }).catch(e => ({ error: e }))
   //if there's an error 
   if (!updateData || updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }

   //Saving the trip in the class be trip table
   let riderData = {
      rider_id: payload.rider_id,
      name: pendingData.name,
      email: pendingData.email,
      phone: pendingData.phone,
      startAddr: pendingData.start_address,
      endAddr: pendingData.end_address,
      distance: pendingData.distance,
      accepted_at: new Date().toISOString(),
      arrive_pickup_at: '',
      start_trip_at: '',
      end_trip_at: '',
      status: "request_accepted",
      fare: 0,
   }

   //Save the data in the database
   if (riderNumber === 1) {
      let saveTrip = await tripModel.TripClassB.create({
         driver_id: driverId,
         riders: riderData,
         ride_status: "waiting",
         destination: { type: "Point", coordinates: [pendingData.end_lon, pendingData.end_lat] }
      }).catch(e => ({ error: e }))
      //check if the trip is
      if (!saveTrip || saveTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //send response to the user (rider) that a driver accepts the request
      let sendData = {
         ...payload,
         car_plate_number: pendingData.driver.car_plate_number,
         car_color: pendingData.driver.car_color,
         car_model: pendingData.driver.car_model,
         class: "B",
         action: requestAction.driverAcceptRequest,
         rider: 1,
         trip_id: saveTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "B", rider: 1, rider_id: payload.rider_id, trip_id: saveTrip._id })
   } else {
      //get the record ID of the first rider
      let recordID = pendingData.record_id
      recordID = String(recordID)
      // if the record is is not a valid mongo id
      if (typeof recordID !== 'string' && recordID.length !== 24) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip could not be found" })
      }
      //update the data
      let updateTrip = await tripModel.TripClassB.findOneAndUpdate({ _id: recordID, driver_id: driverId },
         {
            $push: { riders: riderData },
            ride_status: "on_ride",
         }, { upsert: true }).catch(e => ({ error: e }))

      //check if the trip is
      if (!updateTrip || updateTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //send response to the user (rider) that a driver accepts the request
      let sendData = {
         ...payload,
         car_plate_number: pendingData.driver.car_plate_number,
         car_color: pendingData.driver.car_color,
         car_model: pendingData.driver.car_model,
         class: "B",
         action: requestAction.driverAcceptRequest,
         rider: 2,
         trip_id: updateTrip._id
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "B", rider: 2, rider_id: payload.rider_id, trip_id: updateTrip._id })
   }
}

// when the driver arrives the pickup location
driverMethod.ArrivePickUp = async (ws, payload) => {
   let rideClass = payload.class
   let updateData;
   let arriveTime = new Date().toISOString()
   if (rideClass === 'A') {
      //update the data to arrive pickup
      updateData = await tripModel.TripClassA.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime } }, { upsert: true }).catch(e => ({ error: e }))
   } else if (rideClass === 'B') {
      updateData = await tripModel.TripClassB.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime } }, { upsert: true }).catch(e => ({ error: e }))

   } else if (rideClass === 'C') {
      updateData = await tripModel.TripClassB.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime } }, { upsert: true }).catch(e => ({ error: e }))

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
      //update the data to arrive pickup
      updateData = await tripModel.TripClassA.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'picked', 'riders.$.start_trip_at': startTime }, ride_status: 'on_ride' }, { upsert: true }).catch(e => ({ error: e }))
   } else if (rideClass === 'B') {
      updateData = await tripModel.TripClassB.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$[].status': 'picked', 'riders.$[].start_trip_at': startTime }, ride_status: 'on_ride' }, { upsert: true }).catch(e => ({ error: e }))

   } else if (rideClass === 'C') {
      updateData = await tripModel.TripClassB.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'picked', 'riders.$.start_trip_at': startTime }, ride_status: 'on_ride' }, { upsert: true }).catch(e => ({ error: e }))
   } else {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Class" })
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      //do somthing here
      return helpers.outputResponse(ws, { action: requestAction.serverError, })
   }
   //send the response to the rider (user)
   if (socketUser.online[payload.rider_id]) {
      helpers.outputResponse(ws, {
         action: requestAction.driverStartTripSuccess,
         rider_id: payload.rider_id,
         class: payload.class,
      }, socketUser.online[payload.rider_id])
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
   if (rideClass === 'A') {
      //update the data to arrive pickup
      updateData = await tripModel.TripClassA.findOneAndUpdate({ _id: payload.trip_id, 'riders.$.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'completed', 'riders.$.end_trip_at': endTime }, ride_status: 'completed' }, { upsert: true }).catch(e => ({ error: e }))
   } else if (rideClass === 'B') {
      updateData = await tripModel.TripClassB.findOneAndUpdate({ _id: payload.trip_id, 'riders.$.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'completed', 'riders.$.end_trip_at': endTime }, ride_status: payload.rider === 2 ? 'completed' : 'on_ride' }, { upsert: true }).catch(e => ({ error: e }))

   } else if (rideClass === 'C') {
      updateData = await tripModel.TripClassB.findOneAndUpdate({ _id: payload.trip_id, 'riders.$.rider_id': payload.rider_id },
         { $set: { 'riders.$.status': 'completed', 'riders.$.end_trip_at': endTime }, ride_status: payload.rider === 3 ? 'completed' : 'on_ride' }, { upsert: true }).catch(e => ({ error: e }))
   } else {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Class" })
   }
   //check if it's not updated
   if (!updateData) {
      //do somthing here
   }
   //send the response to the rider (user)
   helpers.outputResponse(ws, { action: requestAction.driverArrivePickUp })

}






module.exports = driverMethod;
