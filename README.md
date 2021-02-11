# taxitripsbackend

# Connection (Connecting to the service)
Every user is connected to the service through socket. Each connection (device) has a unique generated socket id which is held on the 
memory. Typically you will see socketUsers.online['user_id']. This represent a particular device that is connected to the socket and it's referenced by the user id (the person using the device). e.g socketUsers is an object with two properties: online and pendingTrip.
 ```js
socketUsers={}
sockUsers.online={} // this holds all the online users connected to the socket
sockUsers.pendingTrip ={} // this holds all the pending trip request made by the user
 ```
 Typically, to fix a user on the online object, each time a new connection is detected and it passed authentication. It will be fixed as
  ```js
sockUsers.online['user_id'] = ws.id // using the user's id as a object key to hold the socket id value
 ```
 On a fresh connection from socket-client, the server expects the client to submit user id and user type. e.g below
 ```js
 let socketIO = io("https://domain.com?user_type=driver&token=user_id")
 userType = "driver | user"
 token = "the user's auth token"
 ```
 The above will establish a valid connection with the service.

 # Trip Requests

 ### Driver
1. Every driver who connects to the service and turns status to online has a geo coordinates (lon & lat)
2. When the status successfully turns to online, the service stores the geo coordinates on the driver database
3. At this point, the driver's geo cordinates form a focal point waiting for a request which will fall within
0-1km radius from the driver's focal point

### payload
Every request to the service requires a payload. The action to be taken by the service is determined by the payload property (key) called action

```js
let requestData={
   action: 'trip/requestDriver', //this is the endpoint of which the request will trigger
      start_lon: -122.406417, // the client origin (pickup location) longitude
      start_lat: 37.785994,  // the client origin (pickup location) latitude
      end_lon: -122.409117,  // the client destination (drop off location) longitude
      end_lat: 37.785994, // the client destination (drop off location) latitude
      est_time: 2034, // the estimated time for the trip
      est_fare: "400-500", // the estimated fare
      name: "Vikky", // the name of the requester
      phone: "09035345545", // phone of the requester
      email:"mail@gmail.com" //the email of the requester
      start_address: "Plot 3, Tony Oghenejode Close, Lekki Phase 1, Lagos", //origin address in a plain text
      end_address: "Abramham Adesanga Estate, Ajah, Lagos", // destination address in a plain text
      avatar: "https://avatar.lagosride.com/my-avatar-url.png", // the photo url of the requester
      class: "A", // the class of request
}
```

### For Class A
1. When a user initializes a request, the service validates all the required data from the payload.
2. The start longitide and latitude is taken to find a driver who has the requester fallen within 0-1km from the driver's focal points.
3. If a driver is not found within the area, the service searches for any pending request from class B,C,D that is going same destination (0-1km drop off) and has requester's start coordinates fall within 0-1km of the first requester coordinates on the pending ride.
 4. if a class B or C or D is found, the service reply the request recommending to the user a pending trip of the respective class found, if the user would join
 5. If the user decides to join the trip, the service map the user to complete the trip in the class of ride.