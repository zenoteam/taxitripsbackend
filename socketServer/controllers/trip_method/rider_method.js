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


//function that handles class A ride request
riderMethod.RequestClassA = async (ws, payload) => {
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
      { $match: { user_approve: true, on_trip: false, online: true } },
      {
         $project: { user_id: 1 }
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
      //hold the request payload and the driver's data till the driver accept the request
      socketUser.pendingTrip[riderData.token] = { ...payload, driver: driverData.user_id, request_time: new Date() }

      //send the request to the driver
      let sendData = {
         ...payload,
         rider_id: riderData.token,
         action: requestAction.newTripRequest,
      }

      //if driver online
      if (socketUser.online[driverData.user_id]) {
         helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
      } else {
         //if driver's device is not reachable (TODO)
      }
   } else {
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
               ride_status: 'waiting', ride_class: { $in: ['B', 'C'] }
            }
         },
         { $sort: { ride_class: 1 } },
         { $limit: 1 }
      ])
      //check if there's no pending ride going to user's location
      if (!getPendingTrip || getPendingTrip.length === 0) {
         return helpers.outputResponse(ws, { action: requestAction.driverNotFound })
      }
      //if ride exist, recommend the ride to the user
      let sendData = {
         action: requestAction.rideRecommendation,
         class: getPendingTrip[0].ride_class,
         trip_id: getPendingTrip[0]._id,
      }
      //if driver is online
      let driverId = getPendingTrip[0].driver_id
      if (socketUser.online[driverId]) {
         helpers.outputResponse(ws, sendData, driverId)
      } else {
         return helpers.outputResponse(ws, { action: requestAction.driverNotFound })
      }
   }
}


// function that handles class B request
riderMethod.RequestClassB = async (ws, payload) => {
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

   //find any pending request of class B or C
   let getPendingTrip = await TripModel.TripRequests.aggregate([
      {
         $match: {
            'location.origin.coordinates': {
               $geoWithin: { $centerSphere: [[payload.start_lon, payload.start_lat], 1 / 6371] }
            },
            'location.destination.coordinates': {
               $geoWithin: { $centerSphere: [[payload.end_lon, payload.end_lat], 1 / 6371] }
            },
            ride_status: 'waiting', ride_class: { $in: ['B', 'C'] }
         }
      },
      { $sort: { ride_class: 1 } },
      { $limit: 1 }
   ])

   let riderData = ws._user_data //get the requestor data

   //if there's a pending request
   if (getPendingTrip && getPendingTrip.length > 0) {
      let td = getPendingTrip[0]
      //check the class of the trip
      if (td.ride_class === 'B') {
         //add the rider position
         payload.rider = 2
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: { user_id: td.driver_id },
            trip_id: td._id,
            request_time: new Date()
         }
         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            action: requestAction.newTripRequest,
         }
         //check if driver online
         if (socketUser.online[td.driver_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[td.driver_id])
         } else {
            //driver phone not reachable, do something (TODO)
         }
      } else {
         //send the request to the driver
         let sendData = {
            trip_id: td._id,
            class: td.ride_class,
            action: requestAction.rideRecommendation,
         }
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
         { $match: { user_approve: true, on_trip: false, online: true } },
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
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = { ...payload, driver: driverData.user_id, request_time: new Date() }

         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            action: requestAction.newTripRequest,
         }

         //if driver online
         if (socketUser.online[driverData.user_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
         } else {
            //if driver's device is not reachable (TODO)
         }
      } else {
         helpers.outputResponse(ws, { action: requestAction.driverNotFound })
      }
   }
}

// function that handles class B request
riderMethod.RequestClassC = async (ws, payload) => {
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

   //find any pending request of class B or C
   let getPendingTrip = await TripModel.TripRequests.aggregate([
      {
         $match: {
            'location.origin.coordinates': {
               $geoWithin: { $centerSphere: [[payload.start_lon, payload.start_lat], 1 / 6371] }
            },
            'location.destination.coordinates': {
               $geoWithin: { $centerSphere: [[payload.end_lon, payload.end_lat], 1 / 6371] }
            },
            ride_status: 'waiting', ride_class: { $in: ['B', 'C'] }
         }
      },
      { $sort: { ride_class: -1 } },
      { $limit: 1 }
   ])

   let riderData = ws._user_data //get the requestor data

   //if there's a pending request
   if (getPendingTrip && getPendingTrip.length > 0) {
      let td = getPendingTrip[0]
      //check the class of the trip
      if (td.ride_class === 'C') {
         //add the rider postion
         payload.rider = td.riders.length + 1
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = {
            ...payload,
            driver: { user_id: td.driver_id },
            trip_id: td._id,
            request_time: new Date()
         }
         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            rider: td.riders.length === 2 ? 3 : 2,
            action: requestAction.newTripRequest,
         }
         //check if driver online
         if (socketUser.online[td.driver_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[td.driver_id])
         } else {
            //driver phone not reachable, do something (TODO)
         }
      } else {
         //send the request to the driver
         let sendData = {
            trip_id: td._id,
            class: td.ride_class,
            action: requestAction.rideRecommendation,
         }
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
         { $match: { user_approve: true, on_trip: false, online: true } },
         {
            $project: { user_id: 1 }
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
         //hold the request payload and the driver's data till the driver accept the request
         socketUser.pendingTrip[riderData.token] = { ...payload, driver: driverData.user_id, request_time: new Date() }

         //send the request to the driver
         let sendData = {
            ...payload,
            rider_id: riderData.token,
            action: requestAction.newTripRequest,
         }

         //if driver online
         if (socketUser.online[driverData.user_id]) {
            helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
         } else {
            //if driver's device is not reachable (TODO)
         }
      } else {
         helpers.outputResponse(ws, { action: requestAction.driverNotFound })
      }
   }
}

module.exports = riderMethod;
