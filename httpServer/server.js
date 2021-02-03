const url = require('url')
const API_ROUTE = require('./router')
const SERVER_EXTENSION = require('./serverExtension')

module.exports = (req, res) => {
   // Allow CORS 
   res.setHeader('Access-Control-Allow-Origin', '*')
   res.setHeader('Access-Control-Allow-Credentials', true)
   res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
   //if the method is option; allow
   if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      res.statusCode = 200
      return res.end()
   }
   let urlRoute = url.parse(req.url).pathname
   //if the request is for file upload
   if (urlRoute.indexOf('/api/v1/file-upload/') > -1) {
      // let url = urlRoute.replace(/^\/+|\/+$/gi, '');
      // let endpointParts = url.split('/');
      // //execute the method 
      // let controller = require('./controller/v1/file-upload')
      // let classParent = new controller(req, res)
      // //if the file exist, check if the method exist
      // if (typeof classParent[endpointParts[endpointParts.length - 1]] === 'function') {
      //    return classParent[endpointParts[endpointParts.length - 1]]()
      // } else {
      //    return res.status(404).json({ 'error': 'The requested resource does not exist' })
      // }
      //for serving images uploaded
   } else {
      let body = '';
      req.on('data', (chunk) => {
         body += chunk
      })
      req.on('end', () => {
         SERVER_EXTENSION.httpExtension(req, res, body)
         API_ROUTE.use(req, res, urlRoute)
      })
   }
}