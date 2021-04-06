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


   async sendNotification() {
      if (this.method !== 'post') {
         return helpers.outputError(this.res, 405)
      }
      let userID = helpers.getInputValueString(this.payload, 'user_id')
      let adminID = helpers.getInputValueString(this.payload, 'admin_id')
      let message = helpers.getInputValueString(this.payload, 'message')

   }
}

module.exports = driver;