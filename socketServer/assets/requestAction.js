const requestAction = {}

requestAction.inputError = "input_error"
requestAction.serverError = "server_error"
requestAction.driverNotFound = "driver_not_found"
requestAction.newTripRequest = "new_trip_request"
requestAction.tripRequestAvailabe = "trip_request_available"
requestAction.driverAcceptRequest = "driver_accept_request"
requestAction.driverArrivePickUp = "driver_arrive_pickup_location"
requestAction.driverStartTripSuccess = "driver_start_trip_success"
requestAction.driverStatusSet = "driver_status_set_success"
requestAction.rideRecommendation = "recommending_another_ride_class"
requestAction.driverEndRide = "driver_end_ride"
requestAction.driverEndRideSuccessfully = "ride_ended_successfully"

module.exports = requestAction;