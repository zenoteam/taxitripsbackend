const helpers = require('../../assets/helpers')
const requestAction = require('../../assets/requestAction')
const driverModel = require('../../../models/driver')
const RiderModel = require('../../../models/trip_request')
const socketUser = require('../../assets/socketUser')

const riderMethod = {}

//function that handles class A ride request
riderMethod.RequestClassA = async (ws, payload) => {
   // //this block is for test 
   // //send the request to the driver
   // let riderDataT = ws._user_data;
   // let sendDataT = {
   //    ...payload,
   //    rider_id: riderDataT.token,
   //    action: requestAction.newTripRequest,
   // }
   // socketUser.pendingTrip[riderDataT.token] = { ...payload }

   // helpers.outputResponse(ws, sendDataT, socketUser.online[payload.driver_id])

   // //the block stop here
   // return

   //find a driver withing the location
   let getDriver = await driverModel.aggregate([
      {
         $geoNear: {
            "near": { "type": "Point", "coordinates": [parseFloat(payload.start_lon), parseFloat(payload.start_lat)] },
            "distanceField": "location.distance",
            "minDistance": 0,
            "spherical": true,
            "maxDistance": 1000,
            "distanceMultiplier": 0.001
         }
      },
      { $match: { user_approve: true, on_trip: false, online: true } },
      {
         $project: {
            user_id: 1,
            location: 1,
            car_plate_number: 1,
            car_color: 1,
            car_model: 1,
         }
      },
      { $sort: { "location.distance": 1 } },
      { $limit: 1 },
   ])

   // check if there  no driver
   if (!getDriver || getDriver.length === 0) {
      return helpers.outputResponse(ws, { action: requestAction.driverNotFound })
   }

   let riderData = ws._user_data;
   let driverData = getDriver[0]
   //hold the request payload and the driver's data till the driver accept the request
   socketUser.pendingTrip[riderData.token] = { ...payload, driver: driverData }

   //send the request to the driver
   let sendData = {
      ...payload,
      rider_id: riderData.token,
      action: requestAction.newTripRequest,
   }
   helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
}

//Private function that handles class B request
riderMethod.RequestClassB = async (ws, payload) => {
   // //this block below for test
   // let riderDataT = ws._user_data;
   // //add the rider position
   // payload.rider = 1
   // //hold the request payload and the driver's data till the driver accept the request
   // socketUser.pendingTrip[riderDataT.token] = { ...payload, driver: [] }

   // //send the request to the driver
   // let sendDataT = {
   //    ...payload,
   //    rider_id: riderDataT.token,
   //    action: requestAction.newTripRequest
   // }
   // helpers.outputResponse(ws, sendDataT, socketUser.online[payload.driver_id])

   // return

   //check if there's a trip in trip class B database
   let checkTripB = await RiderModel.TripClassB.find({}).limit(1).catch(e => ({ error: e }))
   if (checkTripB && !checkTripB.error) {
      //First check if there's a pending request on the class B that is going same way
      let getPendingTrip = await RiderModel.TripClassB.aggregate([
         {
            $geoNear: {
               "near": { "type": "Point", "coordinates": [parseFloat(payload.end_lon), parseFloat(payload.end_lat)] },
               "distanceField": "location.distance",
               "minDistance": 0,
               "spherical": true,
               "maxDistance": 1000,
               "distanceMultiplier": 0.001
            }
         },
         { $match: { ride_status: 'waiting' } },
         { $project: { driver_id: 1, _id: 1 } },
         { $sort: { "destination.distance": 1 } },
         { $limit: 20 }
      ])

      //check if there's any result
      if (getPendingTrip instanceof Array && getPendingTrip.length > 0) {
         //get all the drivers' id
         let driversIDs = []
         for (let i of getPendingTrip) {
            driversIDs.push(i.driver_id) //push the driver's id to the array
         }
         //check if there's a driver close to the person (second rider)
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
            { $match: { on_trip: false, online: true, user_id: { $in: driversIDs } } },
            {
               $project: {
                  user_id: 1,
                  location: 1,
                  car_plate_number: 1,
                  car_color: 1,
                  car_model: 1,
                  riders: 1,
               }
            },
            { $sort: { "location.distance": 1 } },
            { $limit: 1 },
         ])

         //if there's a driver
         if (getDriver instanceof Array && getDriver.length > 0) {
            let riderData = ws._user_data;
            let driverData = getDriver[0]
            //add the rider position
            payload.rider = 2
            //get the first rider record id
            payload.record_id = getPendingTrip[getPendingTrip.findIndex(ed => ed.driver_id === driverData.user_id)]._id
            //hold the request payload and the driver's data till the driver accept the request
            socketUser.pendingTrip[riderData.token] = { ...payload, driver: driverData }
            //send the request to the driver
            let sendData = {
               ...payload,
               rider_id: riderData.token,
               action: requestAction.newTripRequest,
            }
            //check if the driver is online and send
            if (socketUser.online[driverData.user_id]) {
               helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
            } else {
               helpers.outputResponse(ws, { action: requestAction.driverNotFound, })
            }
            //stop the code if there's a driver found
            return
         }
      }

   }


   //if there's no pending/driver found. Search for a driver freshly close to the rider
   let getDriver = await driverModel.aggregate([
      {
         $geoNear: {
            "near": { "type": "Point", "coordinates": [parseFloat(payload.start_lon), parseFloat(payload.start_lat)] },
            "distanceField": "location.distance",
            "minDistance": 0,
            "spherical": true,
            "maxDistance": 1000,
            "distanceMultiplier": 0.001
         }
      },
      { $match: { user_approve: true, on_trip: false, online: true } },
      {
         $project: {
            user_id: 1,
            location: 1,
            car_plate_number: 1,
            car_color: 1,
            car_model: 1,
            riders: 1,
         }
      },
      { $sort: { "location.distance": 1 } },
      { $limit: 1 },
   ])

   //check if there error or no driver
   if (!getDriver || getDriver.length === 0) {
      return helpers.outputResponse(ws, { action: requestAction.driverNotFound })
   }

   let riderData = ws._user_data;
   let driverData = getDriver[0]
   //add the rider position
   payload.rider = 1
   //hold the request payload and the driver's data till the driver accept the request
   socketUser.pendingTrip[riderData.token] = { ...payload, driver: driverData }

   //send the request to the driver
   let sendData = {
      ...payload,
      rider_id: riderData.token,
      action: requestAction.newTripRequest
   }
   helpers.outputResponse(ws, sendData, socketUser.online[driverData.user_id])
}

module.exports = riderMethod;
