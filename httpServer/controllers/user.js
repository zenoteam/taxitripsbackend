const helpers = require('../assets/helpers')
const notificationModel = require('../../models/notification')
const socketHelpers = require('../../socketServer/assets/helpers')
const socketUsers = require('../../socketServer/assets/socketUser')
const rAction = require('../../socketServer/assets/requestAction')



class driver {
   constructor(req, res, payload, userData) {
      this.method = req.method.toLowerCase()
      this.req = req
      this.res = res
      this.userData = userData;
      this.payload = payload
   }


   async sendNotification() {
      if (this.method !== 'post') {
         return helpers.outputError(this.res, 405)
      }
      let phone = helpers.getInputValueString(this.payload, 'phone')
      let title = helpers.getInputValueString(this.payload, 'title')
      let message = helpers.getInputValueString(this.payload, 'message')
      //check the user the message is for
      if (!phone) {
         return helpers.outputError(this.res, null,
            "Recipient phone is required. Use 'all' to send to all the users or specify the recipient's phone number")
      }
      //check the message
      if (!message) {
         return helpers.outputError(this.res, null, "Message is required")
      }
      //check the message
      if (!title) {
         return helpers.outputError(this.res, null, "Title is required")
      }

      let checkPhone;
      //if phone is not all
      if (phone !== "all") {
         checkPhone = await socketHelpers.makeHTTPRequest({
            uri: `http://taxiusersbackend-microservices.apps.waaron.com/admin/users/checkphonenum/${phone}`,
            headers: { Authorization: this.req.headers.authorization }
         })
         //parse the request
         try {
            //parse the response if not object
            checkPhone = typeof checkPhone === 'object' ? checkPhone : JSON.parse(checkPhone)
            //if there's no id in the token returned
            if (!checkPhone || !checkPhone.result || !checkPhone.result.auth_id) {
               return helpers.outputError(res, 401)
            }
         } catch (e) {
            return helpers.outputError(res, 401)
         }
      }

      //save the notification
      let saveNotify = await notificationModel.Notifications.collection.insertMany([
         {
            user_id: phone === "all" ? "all" : checkPhone.result.auth_id,
            title: title, body: message, status: [],
            createdAt: new Date().toISOString()
         }
      ]).catch(e => ({ error: e }))
      //check if there's an error
      if (saveNotify && saveNotify.error) {
         return helpers.outputError(this.res, 500)
      }

      //get all online users
      let onlineUsers = Object.keys(socketUsers.online)
      //check if there's no user online
      if (onlineUsers.length === 0) {
         return this.res.json({
            status: "success",
            message: "Notification has been logged for the user(s) but user(s) not currently online"
         })
      }
      //send the notification to the user
      if (phone === "all") {
         for (let i of onlineUsers) {
            socketHelpers.outputResponse(socketUsers.serverWS, {
               action: rAction.newNotification,
               user_id: i, title: title,
               body: message, status: -1,
               createdAt: new Date().toISOString()
            })
         }
      } else {
         //if the user is online
         if (socketUsers.online[checkPhone.result.auth_id]) {
            socketHelpers.outputResponse(socketUsers.serverWS, {
               action: rAction.newNotification,
               user_id: checkPhone.result.auth_id,
               title: title, body: message,
               status: -1, createdAt: new Date().toISOString()
            }, socketUsers.online[checkPhone.result.auth_id])
         } else {
            return this.res.json({
               status: "success",
               message: "Notification has been logged for the user but the user is not currently online"
            })
         }
      }


      this.res.json({ status: "success", message: "Notification sent" })

   }



   async getEstimatedFare() {
      if (this.method !== 'post') {
         return helpers.outputError(this.res, 405)
      }
      let estTime = helpers.getInputValueString(this.payload, 'est_time')
      let estDst = helpers.getInputValueString(this.payload, 'est_dst')
      let rideClass = helpers.getInputValueString(this.payload, 'class')

      //check the values
      if (!estTime || isNaN(estTime)) {
         return helpers.outputError(this.res, null, "Estimated time is required. est_time")
      }
      //check the values
      if (!estDst || isNaN(estDst)) {
         return helpers.outputError(this.res, null, "Estimated distance is required. est_dst")
      }

      //if the class is not provided
      if (["A", "B", "C", "D"].indexOf(rideClass) === -1) {
         return helpers.outputError(this.res, null, "Ride class is required. class")
      }

      let getTimeFare = socketHelpers.getTimeCoveredCharges(estTime, 15)
      let getDstFare = socketHelpers.getDistanceCoveredCharges(estDst / 1000, 50)
      let getTimeAndDstFare = getTimeFare + getDstFare
      //split the fare based on class
      switch (rideClass) {
         case "B":
            getTimeAndDstFare /= 2
            break;
         case "C":
            getTimeAndDstFare /= 3
            break;
         case "D":
            getTimeAndDstFare /= 4
            break;
         default:
      }
      //add the fare and the base fare
      let total = Math.ceil(220 + getTimeAndDstFare);
      //add a surge upper bound
      let tripFare = `${total}-${Math.ceil(1.2 * total)}`
      //replace the last digit with zero
      tripFare = `${tripFare.substr(0, tripFare.length - 1)}0`
      tripFare = tripFare.replace(/\d-/, "0-")
      this.res.json({ status: "success", tripFare })

   }
}

module.exports = driver;