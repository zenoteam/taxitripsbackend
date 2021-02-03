const http = require('http')
const https = require('https')
const httpServer = require('./httpServer/server')
const socketServer = require('./socketServer/server')
const driverModel = require('./models/driver')


//create http server
const app = http.createServer(httpServer)

//create Socket.io server
socketServer.createServer(app)

app.listen(4000, () => {
   console.log('Server listening on port 4000')
});


