const auth = require('./auth')
const helpers = require('./assets/helpers');
const router = {}

router.use = (req, res, urlPath) => {
   let url = urlPath.replace(/^\/+|\/+$/gi, ''); //sanitize the url
   let endpointParts = url.split('/'); //split the url
   let requestMethod = req.method.toLowerCase(); //get the request method
   //if the url path not complete
   if (endpointParts.length !== 2) {
      return helpers.outputError(res, 404);
   }
   // run authentication
   auth.authenticate(req, res).then(userData => {
      if (!userData) return // if there's no data return from authentication, stop
      //include the class if exist
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
      let classParent = new controller(req, res, body, userData)
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
   }).catch(e => {
      // console.log(e)
      try {
         helpers.outputError(res, 503);
      } catch (e) {

      }
   })
}

module.exports = router