const helpers = require('../../assets/helpers')
const requestAction = require('../../assets/requestAction')
const driverModel = require('../../../models/driver')
const TripModel = require('../../../models/trip_request')
const socketUser = require('../../assets/socketUser')

const riderMethod = {}

//for converting deg to randian
function deg2rad(deg) {
   return deg * (Math.PI / 180)
}

//get the distance
const getGeometryDistanceKM = (geo1, geo2) => {
   var R = 6371; // Radius of the earth in km
   var dLat = deg2rad(geo2.latitude - geo1.latitude);  // deg2rad below
   var dLon = deg2rad(geo2.longitude - geo1.longitude);
   var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(geo1.latitude)) * Math.cos(deg2rad(geo2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
      ;
   var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   var d = R * c; // Distance in km
   return !isNaN(d) ? d.toFixed(2) : d;
}

//for delaying a request for 30 while sending to the driver
const requestDriverWaitFor30Sec = (rider_id, ws) => {
   socketUser.requestDriverTimer[rider_id] = setTimeout(() => {
      // console.log('time finished')
      //if the request has been sent to 2 or more drivers and no answer, send response that was no driver available
      if (socketUser.pendingTrip[rider_id] && //if the trip exit
         socketUser.pendingTrip[rider_id].driver && //if thereis/are drivers
         socketUser.pendingTrip[rider_id].driver.length >= 2 // if the drivers are more than 1
      ) {
         //send driver not found to the user
         helpers.outputResponse(ws, {
            action: requestAction.driverNotFound,
            request_type: socketUser.pendingTrip[rider_id].action,
            rider_id
         })
         //delete the pending request
         delete socketUser.pendingTrip[rider_id]
      } else {
         //get all the drivers that did not response to the request
         let getallDrivers = socketUser.pendingTrip[rider_id].driver
         let riderClass = socketUser.pendingTrip[rider_id].class
         //send cancel ride to the drivers
         if (socketUser.pendingTrip[rider_id] &&
            socketUser.pendingTrip[rider_id].driver &&
            socketUser.pendingTrip[rider_id].driver.length
         ) {
            //run a loop
            for (let i of socketUser.pendingTrip[rider_id].driver) {
               //if the driver's phone is reachable
               if (socketUser.online[i]) {
                  helpers.outputResponse(ws, {
                     action: requestAction.tripRequestCanceled,
                     request_type: socketUser.pendingTrip[rider_id].action,
                     rider_id
                  }, socketUser.online[i])
               }
            }
         }
         //do a new request
         riderMethod['RequestClass' + riderClass](ws, socketUser.pendingTrip[rider_id], getallDrivers)
      }
      clearTimeout(socketUser.requestDriverTimer[rider_id])
      delete socketUser.requestDriverTimer[rider_id]
   }, 30000)
}






//function that handles class A ride request
riderMethod.RequestClassA = async (ws, payload, driversDidNotAccept = [], acceptRideRecommended = undefined) => {
   //find a free driver withing the location
   // console.log(payload)
   let getDriver = await driverModel.aggregate([
      {
         $geoNear: {
            "near": { "type": "Point", "coordinates": [payload.start_lon, payload.start_lat] },
            "distanceField": "location.distance",
            "minDistance": 0,
            "spherical": true,
            "maxDistance": 1000,
            "distanceMultiplier": 0.001
         }
      },
      { $match: { user_approve: true, on_trip: "no", online: true, user_id: { $nin: driversDidNotAccept } } },
      {
         $project: { user_id: 1 }
      },
      { $sort: { "location.distance": 1 } },
      { $limit: 1 },
   ])
   //get the rider data
   let riderData = ws._user_data;
   //if there's a driver
   if (getDriver && getDriver.length > 0) {
      //the rider data
      //the driver data
      let driverData = getDriver[0]
      //add the distance to the payload
      payload.distance = getGeometryDistanceKM(
         {
            latitude: payload.start_lat,
            longitude: payload.start_lon
         },
         {
            latitude: payload.end_lat,
            longitude: payload.end_lon
         })
      //hold the request payload and the driver's data till the driver accept the request
      socketUser.pendingTrip[riderData.token] = {
         ...payload,
         driver: [...driversDidNotAccept, driverData.user_id],
         request_time: new Date(),
         ws
      }

      //send the request to the driver
      let sendData = {
         ...payload,
         rider_id: riderData.token,
         action: requestAction.newTripRequest,
      }
      // console.log(socketUser.online)
      //if driver is online, send the request to the driver and wait for 30 secs to accept
      if (socketUser.online[driverData.user_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
         requestDriverWaitFor30Sec(sendData.rider_id, ws)
      } else {
         //if driver's device is not reachable, go back and find another driver and exempt this driver
         riderMethod.RequestClassA(ws, payload, [...driversDidNotAccept, driverData.user_id])
      }
   } else {
      // if the user does not accept a ride recommendation, send the user no driver available
      if (acceptRideRecommended === false) {
         //delete pending trip data id if any
         delete socketUser.pendingTrip[riderData.token]
         return helpers.outputResponse(ws, { action: requestAction.driverNotFound, request_type: payload.action })
      }

      //find any pending request if any
      let getPendingTrip = await TripModel.TripRequests.aggregate([
         {
            $match: {
               'location.origin.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.start_lon, payload.start_lat], 1 / 6371] }
               },
               'location.destination.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.end_lon, payload.end_lat], 1 / 6371] }
               },
               ride_status: 'waiting', ride_class: { $in: ['B', 'C'] }, driver_id: { $nin: driversDidNotAccept }
            }
         },
         { $sort: { ride_class: 1 } },
         { $limit: 1 }
      ])
      //check if there's no pending ride going to user's location
      if (!getPendingTrip || getPendingTrip.length === 0) {
         //delete pending trip data id if any
         delete socketUser.pendingTrip[riderData.token]
         return helpers.outputResponse(ws, { action: requestAction.driverNotFound, request_type: payload.action })
      }
      //if ride exist, recommend the ride to the user
      let sendData = {
         action: requestAction.rideRecommendation,
         class: getPendingTrip[0].ride_class,
         trip_id: getPendingTrip[0]._id,
      }
      //delete the pending data
      delete socketUser.pendingTrip[riderData.token]
      //send the request to the user, informing the user of the recommended ride that is going same destination
      helpers.outputResponse(ws, sendData)
   }
}

// function that handles class B request
riderMethod.RequestClassB = async (ws, payload, driversDidNotAccept = [], acceptRideRecommended = undefined) => {
   //add the distance to the payload
   payload.distance = getGeometryDistanceKM(
      {
         latitude: payload.start_lat,
         longitude: payload.start_lon
      },
      {
         latitude: payload.end_lat,
         longitude: payload.end_lon
      })
   //get the requestor data
   let riderData = ws._user_data
   let getPendingTrip = [];
   //for a fresh request without ride recommendation
   if (acceptRideRecommended === undefined) {
      //find any pending request of class B or C
      getPendingTrip = await TripModel.TripRequests.aggregate([
         {
            $match: {
               'location.origin.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.start_lon, payload.start_lat], 1 / 6371] }
               },
               'location.destination.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.end_lon, payload.end_lat], 1 / 6371] }
               },
               ride_status: 'waiting', ride_class: { $in: ['B', 'C'] }, driver_id: { $nin: driversDidNotAccept }
            }
         },
         { $sort: { ride_class: 1 } },
         { $limit: 1 }
      ])
   } else if (acceptRideRecommended === true) {
      //if the user accept a ride recommendation, find the ride and proceed
      //check if there's no trip id from the request
      if (!payload.trip_id || payload.trip_id.length !== 24) {
         //delete any pending trip data
         delete socketUser.pendingTrip[riderData.token]
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip id is required" })
      }
      //find the trip
      getPendingTrip = await TripModel.TripRequests.findOne({ _id: payload.trip_id }, null, { lean: true }).catch(e => ({ error: e }))
      //if there's an error
      if (getPendingTrip && getPendingTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //if the trip is not found
      if (!getPendingTrip) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not found" })
      }
      //if trip is found, check if it's not available any more
      if (getPendingTrip.riders.length === 2) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not available anymore" })
      }
   }
   //if there's a pending request
   if (getPendingTrip && getPendingTrip.length > 0) {
      let td = getPendingTrip[0]
      //check the class of the trip
      if (td.ride_class === "B") {
         //add the rider position
         let onTripUser = td.riders.filter(e => e.status !== "cancel")
         payload.rider = onTripUser.length + 1
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: [...driversDidNotAccept, td.driver_id],
            trip_id: td._id,
            request_time: new Date(),
            ws,
            rider_id: riderData.token //add the rider id
         }
         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            action: requestAction.newTripRequest,
         }
         //check if driver online, send the request and wait for 30sec
         if (socketUser.online[td.driver_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[td.driver_id])
            requestDriverWaitFor30Sec(riderData.token, ws, [...driversDidNotAccept, td.driver_id])
         } else {
            //if the driver's phone not reachable,
            //if it's a trip recommendation, tell the user the driver is not available
            if (acceptRideRecommended === true) {
               delete socketUser.pendingTrip[riderData.token] //remove any pending data is available
               helpers.outputResponse(ws, { action: requestAction.driverNotOnline, request_type: requestAction.rideRecommendation })
            } else {
               // find another driver and exclude him
               riderMethod.RequestClassB(ws, payload, [...driversDidNotAccept, td.driver_id])
            }
         }
      } else {
         //send the request to the driver
         let sendData = {
            trip_id: td._id,
            class: td.ride_class,
            action: requestAction.rideRecommendation,
         }
         //delete pending data if any
         delete socketUser.pendingTrip[riderData.token]
         helpers.outputResponse(ws, sendData)
      }
   } else {
      // if no pending class B or C that matches the request, book new driver
      //find a free driver withing the location
      let getDriver = await driverModel.aggregate([
         {
            $geoNear: {
               "near": { "type": "Point", "coordinates": [payload.start_lon, payload.start_lat] },
               "distanceField": "location.distance",
               "minDistance": 0,
               "spherical": true,
               "maxDistance": 1000,
               "distanceMultiplier": 0.001
            }
         },
         { $match: { user_approve: true, on_trip: "no", online: true, user_id: { $nin: driversDidNotAccept } } },
         {
            $project: { user_id: 1, }
         },
         { $sort: { "location.distance": 1 } },
         { $limit: 1 },
      ])
      //if there's a driver
      if (getDriver && getDriver.length > 0) {
         let riderData = ws._user_data; //the rider data
         //the driver data
         let driverData = getDriver[0]
         //add the distance to the payload
         payload.distance = getGeometryDistanceKM(
            {
               latitude: payload.start_lat,
               longitude: payload.start_lon
            },
            {
               latitude: payload.end_lat,
               longitude: payload.end_lon
            })
         //add the rider position
         payload.rider = 1
         payload.rider_id = riderData.token //add the rider id
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: [...driversDidNotAccept, driverData.user_id],
            ws,
            request_time: new Date()
         }

         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            action: requestAction.newTripRequest,
         }
         //if driver online, send the request and wait for 30sec
         if (socketUser.online[driverData.user_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
            requestDriverWaitFor30Sec(riderData.token, ws)
         } else {
            riderMethod.RequestClassB(ws, payload, [...driversDidNotAccept, driverData.user_id])
         }
      } else {
         //delete any pending data
         delete socketUser.pendingTrip[riderData.token]
         helpers.outputResponse(ws, { action: requestAction.driverNotFound, request_type: payload.action })
      }
   }
}

// function that handles class C request
riderMethod.RequestClassC = async (ws, payload, driversDidNotAccept = [], acceptRideRecommended = undefined) => {
   //add the distance to the payload
   payload.distance = getGeometryDistanceKM(
      {
         latitude: payload.start_lat,
         longitude: payload.start_lon
      },
      {
         latitude: payload.end_lat,
         longitude: payload.end_lon
      })
   let getPendingTrip = [];
   //get the requestor data
   let riderData = ws._user_data
   if (acceptRideRecommended === undefined) {
      //find any pending request of class B or C
      getPendingTrip = await TripModel.TripRequests.aggregate([
         {
            $match: {
               'location.origin.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.start_lon, payload.start_lat], 1 / 6371] }
               },
               'location.destination.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.end_lon, payload.end_lat], 1 / 6371] }
               },
               ride_status: 'waiting', ride_class: { $in: ['C', 'B'] }, driver_id: { $nin: driversDidNotAccept }
            }
         },
         { $sort: { ride_class: -1 } },
         { $limit: 1 }
      ])
   } else if (acceptRideRecommended === true) {
      //if the user accept a ride recommendation, find the ride and proceed
      //check if there's no trip id from the request
      if (!payload.trip_id || payload.trip_id.length !== 24) {
         //delete any pending trip data
         delete socketUser.pendingTrip[riderData.token]
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip id is required" })
      }
      //find the trip
      getPendingTrip = await TripModel.TripRequests.findOne({ _id: payload.trip_id }, null, { lean: true }).catch(e => ({ error: e }))
      //if there's an error
      if (getPendingTrip && getPendingTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //if the trip is not found
      if (!getPendingTrip) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not found" })
      }
      //if trip is found, check if it's not available any more
      if (getPendingTrip.riders.length === 3) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not available anymore" })
      }
   }

   //if there's a pending request
   if (getPendingTrip && getPendingTrip.length > 0) {
      let td = getPendingTrip[0]
      //check the class of the trip
      if (td.ride_class === "C") {
         //add the rider postion
         let onTripUser = td.riders.filter(e => e.status !== "cancel")
         payload.rider = onTripUser.length + 1
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: [...driversDidNotAccept, td.driver_id],
            trip_id: td._id,
            request_time: new Date(),
            ws,
            rider_id: riderData.token //add the rider id
         }
         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            // rider: td.riders.length === 2 ? 3 : 2,
            action: requestAction.newTripRequest,
         }
         //check if driver is online, send the request and wait for 30sec
         if (socketUser.online[td.driver_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[td.driver_id])
            requestDriverWaitFor30Sec(riderData.token, ws, [...driversDidNotAccept, td.driver_id])
         } else {
            //if the driver's phone not reachable,
            //if it's a trip recommendation, tell the user the driver is not available
            if (acceptRideRecommended === true) {
               delete socketUser.pendingTrip[riderData.token] //remove any pending data is available
               helpers.outputResponse(ws, { action: requestAction.driverNotOnline, request_type: requestAction.rideRecommendation })
            } else {
               // find another driver and exclude him
               riderMethod.RequestClassC(ws, payload, [...driversDidNotAccept, td.driver_id])
            }
         }
      } else {
         //send the request to the driver
         let sendData = {
            trip_id: td._id,
            class: td.ride_class,
            action: requestAction.rideRecommendation,
         }
         delete socketUser.pendingTrip[riderData.token] //delete pending data if any
         helpers.outputResponse(ws, sendData)
      }
   } else {
      // if no pending class B or C that matches the request, book new driver
      //find a free driver withing the location
      let getDriver = await driverModel.aggregate([
         {
            $geoNear: {
               "near": { "type": "Point", "coordinates": [payload.start_lon, payload.start_lat] },
               "distanceField": "location.distance",
               "minDistance": 0,
               "spherical": true,
               "maxDistance": 1000,
               "distanceMultiplier": 0.001
            }
         },
         { $match: { user_approve: true, on_trip: "no", online: true, user_id: { $nin: driversDidNotAccept } } },
         {
            $project: { user_id: 1 }
         },
         { $sort: { "location.distance": 1 } },
         { $limit: 1 },
      ])

      //if there's a driver
      if (getDriver && getDriver.length > 0) {
         //the driver data
         let driverData = getDriver[0]
         //add the distance to the payload
         payload.distance = getGeometryDistanceKM(
            {
               latitude: payload.start_lat,
               longitude: payload.start_lon
            },
            {
               latitude: payload.end_lat,
               longitude: payload.end_lon
            })
         //add the rider position
         payload.rider = 1
         payload.rider_id = riderData.token //add the rider id
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: [...driversDidNotAccept, driverData.user_id],
            ws,
            request_time: new Date()
         }

         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            action: requestAction.newTripRequest,
         }

         //if driver online, send the request and wait for 30sec
         if (socketUser.online[driverData.user_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
            requestDriverWaitFor30Sec(riderData.token, ws)
         } else {
            riderMethod.RequestClassC(ws, payload, [...driversDidNotAccept, driverData.user_id])
         }
      } else {
         //delete any pending data
         delete socketUser.pendingTrip[riderData.token]
         helpers.outputResponse(ws, { action: requestAction.driverNotFound, request_type: payload.action })
      }
   }
}


// function that handles class B request
riderMethod.RequestClassD = async (ws, payload, driversDidNotAccept = [], acceptRideRecommended = undefined) => {
   //add the distance to the payload
   payload.distance = getGeometryDistanceKM(
      {
         latitude: payload.start_lat,
         longitude: payload.start_lon
      },
      {
         latitude: payload.end_lat,
         longitude: payload.end_lon
      })
   let getPendingTrip = [];
   //get the requestor data
   let riderData = ws._user_data
   if (acceptRideRecommended === undefined) {
      //find any pending request of class B or C
      getPendingTrip = await TripModel.TripRequests.aggregate([
         {
            $match: {
               'location.origin.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.start_lon, payload.start_lat], 1 / 6371] }
               },
               'location.destination.coordinates': {
                  $geoWithin: { $centerSphere: [[payload.end_lon, payload.end_lat], 1 / 6371] }
               },
               ride_status: 'waiting', ride_class: { $in: ['D', 'C', 'B'] }, driver_id: { $nin: driversDidNotAccept }
            }
         },
         { $sort: { ride_class: -1 } },
         { $limit: 1 }
      ])
   } else if (acceptRideRecommended === true) {
      //if the user accept a ride recommendation, find the ride and proceed
      //check if there's no trip id from the request
      if (!payload.trip_id || payload.trip_id.length !== 24) {
         //delete any pending trip data
         delete socketUser.pendingTrip[riderData.token]
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip id is required" })
      }
      //find the trip
      getPendingTrip = await TripModel.TripRequests.findOne({ _id: payload.trip_id }, null, { lean: true }).catch(e => ({ error: e }))
      //if there's an error
      if (getPendingTrip && getPendingTrip.error) {
         return helpers.outputResponse(ws, { action: requestAction.serverError })
      }
      //if the trip is not found
      if (!getPendingTrip) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not found" })
      }
      //if trip is found, check if it's not available any more
      if (getPendingTrip.riders.length === 4) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Trip not available anymore" })
      }
   }

   //if there's a pending request
   if (getPendingTrip && getPendingTrip.length > 0) {
      let td = getPendingTrip[0]
      //check the class of the trip
      if (td.ride_class === "D") {
         //add the rider postion
         let onTripUser = td.riders.filter(e => e.status !== "cancel")
         payload.rider = onTripUser.length + 1
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: [...driversDidNotAccept, td.driver_id],
            trip_id: td._id,
            request_time: new Date(),
            rider_id: riderData.token, //add the rider id,
            ws
         }
         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            // rider: td.riders.length === 3 ? 4 :td.riders.length === 2? 3:2,
            action: requestAction.newTripRequest,
         }
         //check if driver is online, send the request and wait for 30sec
         if (socketUser.online[td.driver_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[td.driver_id])
            requestDriverWaitFor30Sec(riderData.token, ws, [...driversDidNotAccept, td.driver_id])
         } else {
            //if the driver's phone not reachable,
            //if it's a trip recommendation, tell the user the driver is not available
            if (acceptRideRecommended === true) {
               delete socketUser.pendingTrip[riderData.token] //remove any pending data is available
               helpers.outputResponse(ws, { action: requestAction.driverNotOnline, request_type: requestAction.rideRecommendation })
            } else {
               // find another driver and exclude him
               riderMethod.RequestClassD(ws, payload, [...driversDidNotAccept, td.driver_id])
            }
         }
      } else {
         //send the request to the driver
         let sendData = {
            trip_id: td._id,
            class: td.ride_class,
            action: requestAction.rideRecommendation,
         }
         delete socketUser.pendingTrip[riderData.token] //delete pending data if any
         helpers.outputResponse(ws, sendData)
      }
   } else {
      // if no pending class B or C that matches the request, book new driver
      //find a free driver withing the location
      let getDriver = await driverModel.aggregate([
         {
            $geoNear: {
               "near": { "type": "Point", "coordinates": [payload.start_lon, payload.start_lat] },
               "distanceField": "location.distance",
               "minDistance": 0,
               "spherical": true,
               "maxDistance": 1000,
               "distanceMultiplier": 0.001
            }
         },
         { $match: { user_approve: true, on_trip: "no", online: true, user_id: { $nin: driversDidNotAccept } } },
         {
            $project: { user_id: 1 }
         },
         { $sort: { "location.distance": 1 } },
         { $limit: 1 },
      ])

      //if there's a driver
      if (getDriver && getDriver.length > 0) {
         //the driver data
         let driverData = getDriver[0]
         //add the distance to the payload
         payload.distance = getGeometryDistanceKM(
            {
               latitude: payload.start_lat,
               longitude: payload.start_lon
            },
            {
               latitude: payload.end_lat,
               longitude: payload.end_lon
            })
         //add the rider position
         payload.rider = 1
         payload.rider_id = riderData.token //add the rider id
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: [...driversDidNotAccept, driverData.user_id],
            request_time: new Date(),
            ws
         }

         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            action: requestAction.newTripRequest,
         }

         //if driver online, send the request and wait for 30sec
         if (socketUser.online[driverData.user_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
            requestDriverWaitFor30Sec(riderData.token, ws)
         } else {
            riderMethod.RequestClassD(ws, payload, [...driversDidNotAccept, driverData.user_id])
         }
      } else {
         //delete any pending data
         delete socketUser.pendingTrip[riderData.token]
         helpers.outputResponse(ws, { action: requestAction.driverNotFound, request_type: payload.action })
      }
   }
}



module.exports = riderMethod;
