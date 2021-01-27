# taxitripsbackend

# Process In Request Mapping
### For Class A Ride
1. The requester's start geo code is used in looking for availabe driver in 0-1km distance
2. When the driver is found, the requester's data is held pending while sending the request to the driver
3. When the driver accepts the request, the driver's status on the database is updated to indicate,
 ontrip while the trip in log on it's corresponding table.


 ### For Class B Ride
1. Firstly, the requester's destination geo code is used in checking any existing ride request to that destination with 0-1km difference
2. if there's any pending request to that destination, the drivers with the pending request are queried to check if they are close to the requester by 0-1km
3. if a driver is found close, the request is sent to the driver indicating it as second rider
4. if there's no driver or no pending request to that destination, a new driver is queried to get any close one to the requester
5. When the driver is found, the request is sent to the driver.

# Process In Accepting Request
 1. The requester's payload is sent to the available driver. The payload 
   ```js
  {
      start_lon: //this is the start longitude
      start_lat: // this is the end latitude
      end_lon: // this is the destination longitude
      end_lat : // this is the destination latitude
      distance :// this is the distance 
      name : //name of the requester
      phone: //phone 
      start_address : //start address
      end_address : // end address
      avatar :// image url
      class : // ride class A,B,C,D
      rider_id: // the id of the requester
   }

   ```
2. the above payload is sent to the driver's app. So the driver can see the request
3. When the driver accepts the request. The incoming payload are driver's details 
4. Response is sent to the requester that a driver accept your request. Sending the car name, color, model, number plate,
   driver's name etc


