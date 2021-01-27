const helpers = require('../../assets/helpers')
const requestAction = require('../../assets/requestAction')
const driverModel = require('../../models/driver')
const socketUser = require('../../assets/socketUser')
const tripModel = require('../../models/trip_request')

const driverMethod = {}

//function that handles class A ride acceptance by the driver
driverMethod.RequestTypeA = async (ws, payload, pendingData) => {
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
      picked_at: '',
      arrived_At: '',
      status: "requested_accepted",
      fare: 0,
   }

   //save the trip data
   let saveTrip = await tripModel.TripClassA.create({
      driver_id: driverId,
      $push: { riders: riderData },
      ride_status: "waiting"
   }).catch(e => ({ error: e }))

   // send response to the driver
   helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, rider_id: payload.rider_id, class: 'A' })

   //send response to the user (rider) that a driver accepts the request
   let sendData = {
      ...payload,
      car_plate_number: pendingData.driver.car_plate_number,
      car_color: pendingData.driver.car_color,
      car_model: pendingData.driver.car_model,
      action: requestAction.driverAcceptRequest
   }
   helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
}

//function that handles class B ride acceptance by the driver
driverMethod.RequestTypeB = async (ws, payload, pendingData) => {
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
      picked_at: '',
      arrived_At: '',
      status: "requested_accpeted",
      fare: 0,
   }

   //Save the data in the database
   if (riderNumber === 1) {
      let saveTrip = await tripModel.TripClassB.create({
         driver_id: driverId,
         $push: { riders: riderData },
         ride_status: "waiting",
         destination: { type: "Point", coordinates: [payload.end_lon, payload.end_lat] }
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
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "B", rider: 1, rider_id: payload.rider_id })
   } else {
      //get the record ID of the first rider
      let recordID = pendingData.record_id
      // if the record is is not a valid mongo id
      if (typeof recordID !== 'string' && recordID.length !== 24) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip could not be found" })
      }
      //update the data
      let updateTrip = await tripModel.TripClassB.findOneAndUpdate({ _id: recordID, driver_id: driverId },
         {
            $push: { riders: riderData },
            ride_status: "on_ride",
         }).catch(e => ({ error: e }))

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
      }

      //delete the request from pending requests
      delete socketUser.pendingTrip[payload.rider_id]
      //send the response to the user
      helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      //send the response to the driver
      helpers.outputResponse(ws, { action: requestAction.tripRequestAvailabe, class: "B", rider: 2, rider_id: payload.rider_id })
   }
}



module.exports = driverMethod;
