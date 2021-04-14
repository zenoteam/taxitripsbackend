const http = require('http')
const https = require('https')
const httpServer = require('./httpServer/server')
const socketServer = require('./socketServer/server')
const driverModel = require('./models/driver')


//create http server
const app = http.createServer(httpServer.createServer)

//create Socket.io server
socketServer.createServer(app)
let port = process.env.PORT || 8080
app.listen(port, () => {
   console.log('Server listening on port ' + port)
});


