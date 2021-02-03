const validator = require('validator')
const helpers = require('../assets/helpers')
const driverModel = require('../../models/driver')


class driver {
   constructor(req, res, payload, userData) {
      this.method = req.method.toLowerCase()
      this.req = req
      this.res = res
      this.userData = userData;
      this.payload = payload
   }

   async register() {
      if (this.method !== 'post') {
         return helpers.outputError(this.res, 405)
      }
      let userID = helpers.getInputValueString(this.payload, 'user_id')
      let userStatus = helpers.getInputValueString(this.payload, 'user_status')
      let carNumber = helpers.getInputValueString(this.payload, 'car_plate_number')
      let carColor = helpers.getInputValueString(this.payload, 'car_color')
      let carModel = helpers.getInputValueString(this.payload, 'car_model')

      //check if the required data are not submitted
      if (!userID || !validator.default.isNumeric(userID)) {
         return helpers.outputError(this.res, null, "A valid user id is required")
      }
      //check the driver status
      if (!userStatus || userStatus !== 'approved') {
         return helpers.outputError(this.res, null, "a valid user status is required")
      }
      if (!carNumber || !/^[a-z]{3}\-\d{3,4}[a-z]{2,3}$/i.test(carNumber)) {
         return helpers.outputError(this.res, null, "A valid car number plate is required")
      }
      if (carColor && carColor.length > 10) {
         return helpers.outputError(this.res, null, "Car color too long")
      }
      if (carColor && carColor.length > 15) {
         return helpers.outputError(this.res, null, "Car model too long")
      }

      //check if the user has been created before
      let checkUser = await driverModel.findOne({ user_id: userID }).catch(e => ({ error: e }))
      //if error
      if (checkUser && checkUser.error) {
         return helpers.outputError(this.res, 500)
      }
      //if the user exist
      if (checkUser) {
         return helpers.outputError(this.res, null, "User already exist")
      }

      //register a driver
      let registerDriver = await driverModel.create({
         user_id: userID,
         user_approve: true,
         car_plate_number: carNumber,
         location: { type: "Point", coordinates: [0, 0] },
         car_color: carColor,
         car_model: carModel
      }).catch(e => ({ error: e }))

      // if there's an error 
      if (!registerDriver || registerDriver.error) {
         return helpers.outputError(this.res, 500)
      }
      //return success response
      this.res.json({ status: "success" })
   }

   async changeStatus() {
      if (this.method !== 'post') {
         return helpers.outputError(this.res, 405)
      }
      let userID = helpers.getInputValueString(this.payload, 'user_id')
      let status = helpers.getInputValueString(this.payload, 'user_status')

      //check if the required data are not submitted
      if (!userID || !validator.default.isNumeric(userID)) {
         return helpers.outputError(this.res, null, "Invalid userID")
      }

      //check the status
      if (['approved', 'declined'].indexOf(status) === -1) {
         return helpers.outputError(this.res, null, "Invalid status")
      }
      //cupdate the status
      let updateStatus = await driverModel.findOneAndUpdate({ user_id: userID },
         { user_approve: status === 'approved' ? true : false }, { upsert: true }).catch(e => ({ error: e }))

      //check if there's an error
      if (updateStatus && updateStatus.error) {
         return helpers.outputError(this.res, 500)
      }
      //If not updated
      if (!updateStatus) {
         return helpers.outputError(this.res, null, "Uknown User")
      }
      this.res.json({ status: "success" })

   }
}

module.exports = driver;