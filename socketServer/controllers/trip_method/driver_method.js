const helpers = require('../../assets/helpers')
const requestAction = require('../../assets/requestAction')
const driverModel = require('../../../models/driver')
const socketUser = require('../../assets/socketUser')
const tripModel = require('../../../models/trip_request')
const notificationModel = require('../../../models/notification')


const driverMethod = {}
//for getting rider full data
const getRiderData = (payload, pendingData) => {
   return {
      rider_id: payload.rider_id,
      rider: pendingData.rider,
      name: pendingData.name,
      phone: pendingData.phone,
      avatar: pendingData.avatar,
      start_lon: pendingData.start_lon,
      start_lat: pendingData.start_lat,
      end_lon: pendingData.end_lon,
      end_lat: pendingData.end_lat,
      start_address: pendingData.start_address,
      end_address: pendingData.end_address,
      est_dst: pendingData.est_dst,
      est_time: pendingData.est_time,
      est_fare: pendingData.est_fare,
      sex: pendingData.sex,
      accepted_at: new Date().toISOString(),
      arrive_pickup_at: '',
      start_trip_at: '',
      delay_trip_at: '',
      end_trip_at: '',
      class: pendingData.class_complete ? pendingData.class_complete : pendingData.class,
      class_complete: pendingData.class_complete,
      waiting_time: 0,
      end_time: 0,
      delay_time: 0,
      total_distance: 0,
      pickup_distance: payload.pickup_distance,
      status: "request_accepted",
      stage: 0,
      cancel_reason: {},
      previous_destination: [],
      fare: 0,
      action: requestAction.driverAcceptRequest
   }
}

//for getting driver's data
const getDriverData = (driverData, payload) => {
   return {
      driver_id: driverData.user_id,
      lon: payload.lon,
      lat: payload.lat,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      avatar: payload.avatar,
      rating: payload.rating,
      car_plate_number: driverData.car_plate_number,
      car_color: driverData.car_color,
      car_model: driverData.car_model
   }
}


//function that handles class A ride acceptance for driver
driverMethod.AcceptClassA = async (ws, payload, pendingData) => {
   //get the driver's unique id
   let driverId = ws._user_data.token
   // update the driver's trip data
   let updateDriver = await driverModel.findOneAndUpdate({ user_id: driverId },
      { on_trip: "yes" }, { new: true, lean: true }).catch(e => ({ error: e }))
   //if there's an error 
   if (!updateDriver || updateDriver.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   //delete the request from pending requests
   delete socketUser.pendingTrip[payload.rider_id]

   let riderData = []

   //if the request is a class complete
   if (pendingData.class_complete) {
      //push the other riders data to the array
      for (let i of pendingData.riders) {
         riderData.push(getRiderData({
            ...payload,
            rider_id: i.rider_id
         }, {
            ...pendingData,
            name: i.name, phone: i.phone, sex: i.sex,
            avatar: i.avatar, rider_id: i.rider_id,
         }))
      }
   } else {
      riderData = getRiderData(payload, pendingData)
      riderData.rider = 1 //add the rider position
   }

   //prepare driver's data
   let driverData = getDriverData(updateDriver, payload)

   //save the trip data
   let saveTrip = await tripModel.TripRequests.create({
      driver_id: driverId,
      riders: riderData,
      driver_data: driverData,
      ride_status: "on_pickup",
      ride_class: pendingData.class_complete ? pendingData.class_complete : "A",
      rider_compass: payload.rider_id,
      ride_class_complete: pendingData.class_complete ? true : false,
      location: [{
         origin: { coordinates: [pendingData.start_lon, pendingData.start_lat] },
         destination: { coordinates: [pendingData.end_lon, pendingData.end_lat] }
      }]
   }).catch(e => ({ error: e }))

   //check if there's an error
   if (saveTrip && saveTrip.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }

   //save the notification
   let saveNotify = await notificationModel.Notifications.collection.insertMany([
      {
         user_id: payload.rider_id,
         status: [],
         title: payload.name + " accepted your request",
         body: `Class ${pendingData.class} request from ${pendingData.start_address} to ${pendingData.end_address}`,
         createdAt: new Date().toISOString()
      },
      {
         user_id: ws._user_data.token,
         status: [],
         title: `You accepted ${pendingData.name}'s request`,
         body: `Class ${pendingData.class} request from ${pendingData.start_address} to ${pendingData.end_address}`,
         createdAt: new Date().toISOString()
      }
   ]).catch(e => ({ error: e }))

   // console.log(saveNotify)

   // send response to the driver
   let sendData = {
      action: requestAction.tripRequestAvailabe,
      rider_id: payload.rider_id,
      class: 'A', trip_id: saveTrip._id
   }
   helpers.outputResponse(ws, sendData)

   //send response to the user (rider) that a driver accepts the request
   if (saveTrip.ride_class_complete === true) {
      //get all riders who still on trip
      let onTripRiders = saveTrip.riders.filter(e => e.status !== "cancel")
      //send em the respone
      for (let i of onTripRiders) {
         //if the user is online
         if (socketUser.online[i.rider_id]) {
            helpers.outputResponse(ws, {
               ...payload,
               car_plate_number: updateDriver.car_plate_number,
               car_color: updateDriver.car_color,
               car_model: updateDriver.car_model,
               trip_id: saveTrip._id,
               driver_id: driverId,
               rider_id: i.rider_id,
               riders: onTripRiders,
               class: pendingData.class_complete,
               class_complete: pendingData.class_complete,
               action: requestAction.driverAcceptRequest
            }, socketUser.online[i.rider_id])
         }
      }
   } else {
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
      //prepare driver's data
      let driverData = getDriverData(updateDriver, payload)
      //save the trip
      let saveTrip = await tripModel.TripRequests.create({
         driver_id: driverId,
         riders: riderData,
         driver_data: driverData,
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
            ride_status: "on_pickup",
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
         //if the rider's id not the one the request is accepted for
         if (i.rider_id !== payload.rider_id) {
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
      //send the response to the rider whose request is accepted
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
      //prepare driver's data
      let driverData = getDriverData(updateDriver, payload)
      //save the trip
      let saveTrip = await tripModel.TripRequests.create({
         driver_id: driverId,
         riders: riderData,
         driver_data: driverData,
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
            ride_status: pendingData.rider === 3 ? "on_pickup" : "waiting",
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
         if (i.rider_id !== payload.rider_id) {
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
      //prepare driver's data
      let driverData = getDriverData(updateDriver, payload)
      //save the trip data
      let saveTrip = await tripModel.TripRequests.create({
         driver_id: driverId,
         driver_data: driverData,
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
            ride_status: pendingData.rider === 4 ? "on_pickup" : "waiting",
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
         if (i.rider_id !== payload.rider_id) {
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
      if (payload.ride_class_complete) {
         updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
            { $set: { 'riders.$[].action': requestAction.driverArrivePickUp, 'riders.$[].status': 'arrive_pickup', 'riders.$[].arrive_pickup_at': arriveTime, 'riders.$[].statge': 1 } },
            { new: true, lean: true }).catch(e => ({ error: e }))
      } else {
         updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id },
            { $set: { 'riders.$.action': requestAction.driverArrivePickUp, 'riders.$.status': 'arrive_pickup', 'riders.$.arrive_pickup_at': arriveTime, 'riders.$.statge': 1 } },
            { new: true, lean: true }).catch(e => ({ error: e }))
      }
   } else {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Unknown Class" })
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
      //do somthing here
   }
   //save the notification
   let saveNotify = await notificationModel.Notifications.collection.insertMany([
      {
         user_id: payload.rider_id,
         title: "Driver arrived your location",
         body: `Driver has arrived your location for a pickup`,
         status: [],
         createdAt: new Date().toISOString()
      }
   ]).catch(e => ({ error: e }))

   // console.log(saveNotify)

   //also send to other riders
   for (let i of updateData.riders) {
      if (i.status !== 'cancel') {
         if (socketUser.online[i.rider_id]) {
            helpers.outputResponse(ws, {
               rider_id: payload.ride_class_complete ? i.rider_id : payload.rider_id,
               arrive_time: arriveTime,
               action: requestAction.driverArrivePickUp
            }, socketUser.online[i.rider_id])
         }
      }
   }
   //reply the driver
   helpers.outputResponse(ws, {
      rider_id: payload.rider_id,
      arrive_time: arriveTime,
      action: requestAction.driverArrivePickUp
   })
}

driverMethod.StartRide = async (ws, payload) => {
   let rideClass = payload.class
   let startTime = new Date().toISOString()
   let updateData;
   if (rideClass === "A") {
      //update the data to arrive start trip
      if (payload.ride_class_complete) {
         updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
            {
               $set: {
                  'riders.$[].status': 'picked',
                  'riders.$[].stage': 3,
                  'riders.$[].start_trip_at': startTime,
                  'riders.$[].waiting_time': payload.waiting_time,
                  'riders.$[].action': requestAction.driverStartTripSuccess,
               }, ride_status: 'on_ride'
            }, { new: true }).catch(e => ({ error: e }))
      } else {
         updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
            {
               $set: {
                  'riders.0.status': 'picked',
                  'riders.0.stage': 3,
                  'riders.0.start_trip_at': startTime,
                  'riders.0.waiting_time': payload.waiting_time,
                  'riders.0.action': requestAction.driverStartTripSuccess,
               }, ride_status: 'on_ride'
            }, { new: true }).catch(e => ({ error: e }))
      }
   } else {
      updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id },
         {
            $set: {
               'riders.$[].status': 'picked', 'riders.$[].start_trip_at': startTime,
               'riders.$[].stage': 3, 'riders.$[].action': requestAction.driverStartTripSuccess,
               'riders.$[last].waiting_time': payload.waiting_time
            },
            ride_status: 'on_ride'
         },
         {
            arrayFilters: [{ 'last.rider_id': payload.rider_id }],
            new: true,
         }
      ).catch(e => ({ error: e }))
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      //do somthing here
      return helpers.outputResponse(ws, { action: requestAction.serverError, })
   }

   //save the notification
   let MsgText = []
   for (let i of payload.riders) {
      MsgText.push({
         user_id: i.rider_id,
         title: "Ongoing Trip",
         body: `Enjoy your trip. Feel free to give use feedback about your trip`,
         status: [],
         createdAt: new Date().toISOString()
      })
   }
   let saveNotify = await notificationModel.Notifications.collection.insertMany(MsgText).catch(e => ({ error: e }))

   // console.log(saveNotify)


   //send the response to the rider(s)
   for (let i of payload.riders) {
      if (socketUser.online[i.rider_id]) {
         helpers.outputResponse(ws, {
            action: requestAction.driverStartTripSuccess,
            rider_id: payload.rider_id,
            class: payload.class,
            start_time: updateData.updatedAt,
         }, socketUser.online[i.rider_id])
      }
   }
   //send the response to the driver
   helpers.outputResponse(ws, {
      action: requestAction.driverStartTripSuccess,
      rider_id: payload.rider_id,
      class: payload.class, start_time: updateData.updatedAt,
   })
}

//when the driver ends trip
driverMethod.EndRide = async (ws, payload) => {
   let rideClass = payload.class
   let endTime = new Date().toISOString()
   let updateData;
   //get the user that the trip is ending for
   let getUser = await tripModel.TripRequests.findOne({ _id: payload.trip_id },
      null, { lean: true }).catch(e => ({ error: e }))
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
   let getTimeFare = helpers.getTimeCoveredCharges(totalTimeCovered, timeFarePerMinute)
   //get distance fare
   let getDstFare = helpers.getDistanceCoveredCharges(totalDstCovered, distanceFarePerKM)

   //split the fare if not a class a ride
   if (payload.class !== "A") {
      getTimeFare /= payload.class === "B" ? 2 : payload.class === "C" ? 3 : 4
   }

   //split the fare if not a class a ride
   if (payload.class !== "A") {
      getDstFare /= payload.class === "B" ? 2 : payload.class === "C" ? 3 : 4
   }

   //sum the total fare
   totalFare = String(Math.ceil(getTimeFare + getDstFare + getWaitingFare + baseFare))
   //replace the last digit with zero to round the paymant
   totalFare = `${totalFare.substr(0, totalFare.length - 1)}0`
   //parse the value make it number
   totalFare = parseInt(totalFare)

   //get people that hv been dropped off
   let dropOffRiders = getUser.riders.filter(d => d.status === 'completed')

   //check the trip and clear the driver
   if ((rideClass === "B" && dropOffRiders.length === 1) ||
      (rideClass === "C" && dropOffRiders.length === 2) ||
      (rideClass === "D" && dropOffRiders.length === 3) ||
      rideClass === "A" || getUser.ride_class_complete === true) {
      //clear the driver from ontrip
      let updateDriver = await driverModel.findOneAndUpdate({ user_id: ws._user_data.token },
         { on_trip: "no", 'location.coordinates': [payload.longitude, payload.latitude] },
         { new: true }).catch(e => ({ error: e }))
      //check if it's not updated
      if (!updateDriver || updateDriver.error) {
         helpers.outputResponse(ws, {
            action: requestAction.inputError,
            error: "Your status could not be set to available. Please contact support"
         })
      }
   }

   // update the trip data for the riders
   if (["A", "B", "C", "D"].indexOf(rideClass) > -1) {
      //if it's a complete ride
      if (getUser.ride_class_complete === true) {
         //update the data to arrive pickup
         updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id }, {
            $set: {
               'riders.$[].status': 'completed',
               'riders.$[].stage': 5,
               'riders.$[].end_trip_at': endTime,
               'riders.$[].end_time': totalTimeCovered,
               'riders.$[].total_distance': totalDstCovered,
               'riders.$[].fare': totalFare,
               'riders.$[].action': requestAction.driverEndRide,
            },
            ride_status: "completed"
         }, { new: true }).catch(e => ({ error: e }))
      } else {
         //update the data to arrive pickup
         updateData = await tripModel.TripRequests.findOneAndUpdate({ _id: payload.trip_id, 'riders.rider_id': payload.rider_id }, {
            $set: {
               'riders.$.status': 'completed',
               'riders.$.stage': 5,
               'riders.$.end_trip_at': endTime,
               'riders.$.end_time': totalTimeCovered,
               'riders.$.total_distance': totalDstCovered,
               'riders.$.fare': totalFare,
               'riders.$.action': requestAction.driverEndRide,
            },
            ride_status: rideClass === "A" ? "completed" :
               (rideClass === "B" && dropOffRiders.length === 1) ? "completed" :
                  (rideClass === "C" && dropOffRiders.length === 2) ? "completed" :
                     (rideClass === "D" && dropOffRiders.length === 3) ? "completed" : "on_ride"
         }, { new: true }).catch(e => ({ error: e }))
      }
   } else {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Unknown Class"
      })
   }
   //check if it's not updated
   if (!updateData || updateData.error) {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Could not update the trip details"
      })
      // return
      //do somthing here
   }
   //add the distance and the tm the driver has covered
   if ((rideClass === "B" && dropOffRiders.length === 1) ||
      (rideClass === "C" && dropOffRiders.length === 2) ||
      (rideClass === "D" && dropOffRiders.length === 3) ||
      rideClass === "A" || getUser.ride_class_complete === true) {
      let addDriverKM = await tripModel.DriverWorkHours.create({
         driver_id: ws._user_data.token,
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
      fare: totalFare,
      start_time: updateData.updatedAt
   }
   //if the ride is a class complete
   if (updateData.ride_class_complete === true) {
      //send the fare to all riders
      for (let i of updateData.riders) {
         if (i.status !== 'cancel') {
            if (socketUser.online[i.rider_id]) {
               helpers.outputResponse(ws, {
                  ...sendData,
                  rider_id: i.rider_id, fare: totalFare,
                  class: updateData.ride_class,
                  class_complete: updateData.ride_class
               }, socketUser.online[i.rider_id])
            }
         }
      }
   } else {
      //send the response to the rider (user)
      if (socketUser.online[payload.rider_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[payload.rider_id])
      }
   }
   //send the response to the driver
   sendData.action = requestAction.driverEndRideSuccessfully
   //if the trip is class complete, send total fare to the driver
   if (updateData.ride_class_complete === true) {
      sendData.fare = updateData.ride_class === "B" ? totalFare * 2 :
         updateData.ride_class === "C" ? totalFare * 3 : totalFare * 4
   }
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
                  'riders.$.stage': 6,
                  'riders.$.action': requestAction.tripRequestCanceled,
                  'riders.$.cancel_reason': cancelData,
                  'location.0.origin.coordinates': [newCompase.start_lon, newCompase.start_lat],
                  'location.0.destination.coordinates': [newCompase.end_lon, newCompase.end_lat],
                  rider_compass: newCompase.rider_id
               } :
               {
                  'riders.$.status': 'cancel',
                  'riders.$.stage': 6,
                  'riders.$.action': requestAction.tripRequestCanceled,
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

      //save the notification
      let saveNotify = await notificationModel.Notifications.collection.insertMany([
         {
            user_id: userType === "driver" ? payload.rider_id : cancelTrip.driver_id,
            title: "Trip Canceled",
            body: `${userType === "driver" ? "Driver" : "Rider"} canceled trip`,
            status: [],
            createdAt: new Date().toISOString()
         }
      ]).catch(e => ({ error: e }))

      // console.log(saveNotify)

      //send the response to the appropriate user
      if ((userType === "driver" && socketUser.online[payload.rider_id]) ||
         (userType !== "driver" && socketUser.online[cancelTrip.driver_id])) {
         helpers.outputResponse(ws, {
            action: requestAction.tripRequestCanceled,
            cancel_level: payload.cancel_level,
            rider_id, trip_id
         }, userType === "driver" ? socketUser.online[payload.rider_id] : socketUser.online[cancelTrip.driver_id])
      }

      //notify all the riders that a ride has been canceled
      let notifyRidersOnTrip = onTripUser.filter(d => d.rider_id !== rider_id)
      for (let i of notifyRidersOnTrip) {
         //send to all the riders on the trip
         if (socketUser.online[i.rider_id]) {
            helpers.outputResponse(ws, {
               action: requestAction.tripRequestCanceled,
               cancel_level: payload.cancel_level,
               rider_id, trip_id
            }, socketUser.online[i.rider_id])
         }
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
