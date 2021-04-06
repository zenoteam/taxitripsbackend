const url = require('url')
const API_ROUTE = require('./router')
const SERVER_EXTENSION = require('./serverExtension')

const httpServer = {}

httpServer.createServer = (req, res) => {
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
   let body = '';
   req.on('data', (chunk) => {
      body += chunk
   })
   req.on('end', () => {
      SERVER_EXTENSION.httpExtension(req, res, body)
      API_ROUTE.use(req, res, urlRoute)
   })
}

module.exports = httpServer;