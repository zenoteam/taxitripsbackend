const helpers = require("../assets/helpers")
const NotificationModel = require('../../models/notification')
const requestAction = require("../assets/requestAction")
const socketUser = require("../assets/socketUser")
const validator = require('validator');
const driverModel = require('../../models/driver');


const user = {}


//for pulling the user notification
user.getNotification = async (ws, payload) => {
   let userID = ws._user_data.token //get the user
   //get the notifications
   let getData = await NotificationModel.Notifications.aggregate([
      { $match: { user_id: { $in: [userID, 'all'] } } },
      {
         $project: {
            title: 1,
            body: 1,
            createdAt: 1,
            status: { $indexOfArray: ["$status", userID] },
         }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 }
   ])

   //fetch the user
   helpers.outputResponse(ws, {
      action: requestAction.userNotification,
      data: getData
   })
}

//for clearing a notificaton
user.clearNotification = async (ws, payload) => {
   let userID = ws._user_data.token
   let id = helpers.getInputValueString(payload, "notification_id")

   //check if the notification ID is not submitted
   if (!id || id.length !== 24) {
      return helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "A valid notification id is required"
      })
   }
   // update the data
   let updateData = await NotificationModel.Notifications.findOneAndUpdate({ _id: id, status: { $nin: [userID] } },
      { $push: { status: userID } }).catch(e => ({ error: e }))

   //check if there's an error
   if (updateData && updateData.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   helpers.outputResponse(ws, {
      action: requestAction.clearNotification,
      notification_id: id
   })
}

//for sending a chat to the user
user.sendChat = async (ws, payload) => {
   let message = helpers.getInputValueString(payload, "message")
   let recipient_id = helpers.getInputValueString(payload, "recipient_id")
   let created = helpers.getInputValueString(payload, "created")

   let userType = ws._user_data.user_type
   let userID = ws._user_data.token
   let token = helpers.generateToken(30)
   //check the values
   if (!message || message.length < 1) {
      return helpers.outputResponse(ws, { action: "Message is required" })
   }
   if (!recipient_id) {
      return helpers.outputResponse(ws, { action: "Recipient id is required" })
   }
   if (!created) {
      return helpers.outputResponse(ws, { action: "Created date is required" })
   }

   let sendData = {
      action: requestAction.newChatMessage,
      sender_id: ws._user_data.token,
      message, created
   }
   //send the message to the recipient
   if (socketUser.online[recipient_id]) {
      helpers.outputResponse(ws, sendData, socketUser.online[recipient_id])
      helpers.outputResponse(ws, { action: requestAction.newChatMessageSent, created, recipient_id, message })
   } else {
      helpers.outputResponse(ws, {
         action: requestAction.inputError,
         error: "Recipient's phone is unreachable"
      })
   }
}

user.setOnlineStatus = async (ws, payload) => {
   let lon = helpers.getInputValueNumber(payload, 'longitude')
   let lat = helpers.getInputValueNumber(payload, 'latitude')
   let status = helpers.getInputValueString(payload, 'status')
   let driverId = ws._user_data.token

   //check if not valid data
   if (isNaN(lon) || isNaN(lat)) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid lat or lon is required" })
   }
   if (['on', 'off'].indexOf(status) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid status" })
   }
   //update the status
   let updateStatus = await driverModel.findOneAndUpdate({ user_id: driverId },
      {
         online: status === 'on' ? true : false,
         'location.coordinates': [lon, lat]
      }, { upsert: true }).catch(e => ({ error: e }))
   //check if not updated 
   if (!updateStatus) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   helpers.outputResponse(ws, { action: requestAction.driverStatusSet })
}

user.setOnlineStatusTem = async (ws, payload) => {
   let lon = helpers.getInputValueNumber(payload, 'longitude')
   let lat = helpers.getInputValueNumber(payload, 'latitude')
   let status = helpers.getInputValueString(payload, 'status')
   let email = helpers.getInputValueString(payload, 'email')
   let name = helpers.getInputValueString(payload, 'name')
   let phone = helpers.getInputValueString(payload, 'phone')
   let plateNo = helpers.getInputValueString(payload, 'plateNo')
   let driverId = ws._user_data.token


   if (['on', 'off'].indexOf(status) === -1) {
      return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid status" })
   }
   let updateStatus;
   if (status === 'off') {
      //update the status
      updateStatus = await driverModel.findOneAndUpdate({ user_id: driverId },
         { online: false, }, { new: true }).catch(e => ({ error: e }))
   } else {
      //check if not valid data
      if (isNaN(lon) || isNaN(lat)) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "A valid lat or lon is required" })
      }
      if (!validator.default.isEmail(email)) {
         return helpers.outputResponse(ws, { action: requestAction.inputError, error: "Invalid email" })
      }
      updateStatus = await driverModel.findOneAndUpdate({ user_email: email },
         {
            user_id: driverId,
            user_email: email,
            user_name: name,
            user_approve: true,
            user_phone: phone,
            car_plate_number: plateNo,
            location: { type: "Point", coordinates: [lon, lat] },
            online: true,
            on_trip: "no",
         }, { upsert: true, new: true }).catch(e => ({ error: e }))

   }
   //check if not updated
   if (!updateStatus || updateStatus.error) {
      return helpers.outputResponse(ws, { action: requestAction.serverError })
   }
   if (!socketUser.online[driverId]) {
      socketUser.online[driverId] = ws.id
   }
   helpers.outputResponse(ws, { action: requestAction.driverStatusSet, status })
}

user.getOnlineStatus = async (ws, payload) => {
   let driverId = ws._user_data.token
   //check if the driver is still online
   let getStatus = await driverModel.findOne({ user_id: driverId }, { online: 1 }).catch(e => ({ error: e }))
   // console.log(driverId)
   // console.log(getStatus)
   if (!getStatus || getStatus.error) {
      helpers.outputResponse(ws, { action: requestAction.driverStatusSet, status: 'off' })
   } else {
      if (getStatus.online) {
         socketUser.online[driverId] = ws.id
      }
      console.log(socketUser.online)
      helpers.outputResponse(ws, { action: requestAction.driverStatusSet, status: getStatus.online ? 'on' : 'off' })
   }

}




// chat.sendMessage = async (ws, payload) => {
//    let senderName = helpers.getInputValueString(payload, "name")
//    let message = helpers.getInputValueString(payload, "message")
//    let recipient_id = helpers.getInputValueString(payload, "recipient_id")
//    let todayDate = (new Date().toISOString()).substr(0, 10)
//    let userType = ws._user_data.user_type
//    let userID = ws._user_data.token
//    let token = helpers.generateToken(30)
//    //check the values
//    if (!senderName || senderName.length < 1) {
//       return helpers.outputResponse(ws, { action: "Sender name is required" })
//    }
//    if (!message || message.length === 0) {
//       return helpers.outputResponse(ws, { action: "Message is required" })
//    }
//    if (!recipient_id || recipient_id.length === 0) {
//       return helpers.outputResponse(ws, { action: "Recipient ID is required" })
//    }

//    //add the chat
//    let saveChat = await MessageModel.Inbox.findOneAndUpdate(userType === "driver" ?
//       {
//          created: todayDate,
//          driver_id: userType === "driver" ? userID : recipient_id,
//          rider_id: userType === "driver" ? recipient_id : userID
//       } :
//       {
//          driver_id: userType === "driver" ? userID : recipient_id,
//          rider_id: userType === "driver" ? recipient_id : userID,
//          $push: {
//             message: {
//                sender_id: userID,
//                sender_name: senderName,
//                message,
//                id: token,
//                createdAt: new Date().toISOString(),
//                status: 0
//             }
//          }
//       }, { new: true }).catch(e => ({ error: e }))

//    //check for error
//    if (saveChat && saveChat.error) {
//       return helpers.outputResponse(ws, { action: requestAction.serverError })
//    }
//    let sendData = {
//       action: requestAction.newChatMessage,
//       sender_id: ws._user_data.token,
//       message: saveChat.message
//    }
//    //send the message to the recipient
//    if (socketUser.online[recipient_id]) {
//       helpers.outputResponse(ws, sendData)
//    }
// }

//send data back
// chat.getMessage = async (ws, payload) => {
//    let userID = ws._user_data.token
//    let userType = ws._user_data.user_type
//    //get chat
//    let getChat = await MessageModel.find(userType === "driver" ?
//       { driver_id: userID } : { rider_id: userID }).sort("-createdAt").limit(50).catch(e => ({ error: e }))
//    //check if there's no
//    if (getChat && getChat.error) {
//       return
//    }
//    helpers.outputResponse(ws, { action: requestAction.chatMessage, data: getChat })
// }

module.exports = user;