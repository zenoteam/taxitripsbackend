const auth = require('./auth')
const helpers = require('./assets/helpers');
const socketHelpers = require('../socketServer/assets/helpers')
const router = {}

router.use = async (req, res, urlPath) => {
   let url = urlPath.replace(/^\/+|\/+$/gi, ''); //sanitize the url
   let endpointParts = url.split('/'); //split the url
   let requestMethod = req.method.toLowerCase(); //get the request method
   //if the url path not complete
   if (endpointParts.length !== 2) {
      return helpers.outputError(res, 404);
   }

   //get the authorization header
   let header = req.headers.authorization
   // if there's no auth
   if (!header) {
      return helpers.outputError(res, 401, "Authorization missing")
   }
   //check if the header has bearer token
   if (!header.match(/^Bearer /)) {
      return helpers.outputError(res, 401, "Invalid Authorization")
   }

   //check the token with the auth service
   let checkToken = await socketHelpers.makeHTTPRequest({
      uri: 'http://taxiusersbackend-microservices.apps.waaron.com/api/verify/',
      method: 'GET', headers: { "Authorization": header }
   })

   //parse the data if returned
   try {
      //parse the response if not object
      checkToken = typeof checkToken === 'object' ? checkToken : JSON.parse(checkToken)
      //if there's no id in the token returned
      if (!checkToken || !/^\d+$/.test(checkToken.id)) {
         return helpers.outputError(res, 401)
      }
   } catch (e) {
      return helpers.outputError(res, 401)
   }


   var controller = null
   try {
      controller = require('./controllers/' + endpointParts[0])
   } catch (e) {
      // console.log(e)
      return helpers.outputError(res, 404);
   }
   //parse the payload if it's a post request
   let body = ''
   if (requestMethod === 'post') {
      try {
         body = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
      } catch (e) {
         return helpers.outputError(res, 400);
      }
   }
   //execute the method 
   let classParent = new controller(req, res, body, checkToken)
   //check if the method exist
   if (typeof classParent[endpointParts[1]] === 'function') {
      try {
         return classParent[endpointParts[1]]()
      } catch (e) {
         helpers.outputError(res, 503)
      }
   } else {
      return helpers.outputError(res, 404);
   }
}

module.exports = router