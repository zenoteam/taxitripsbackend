const requestAction = {}

requestAction.inputError = "input_error"
requestAction.serverError = "server_error"
requestAction.driverNotFound = "driver_not_found"
requestAction.newTripRequest = "new_trip_request"
requestAction.tripRequestAvailabe = "trip_request_available"
requestAction.tripRequestCanceled = "trip_request_canceled"
requestAction.driverAcceptRequest = "driver_accept_request"
requestAction.driverNotOnline = "driver_not_online"
requestAction.driverArrivePickUp = "driver_arrive_pickup_location"
requestAction.driverStartTripSuccess = "driver_start_trip_success"
requestAction.driverStatusSet = "driver_status_set_success"
requestAction.driverGoingToPickUpLocation = "driver_going_to_pick_up_location"
requestAction.rideRecommendation = "recommending_another_ride_class"
requestAction.driverEndRide = "driver_end_ride"
requestAction.driverEndRideSuccessfully = "ride_ended_successfully"
requestAction.tripCancelSuccessfully = "trip_cancel_successfully"
requestAction.tripEstimatedFare = "trip_estimated_fare"
requestAction.ratingSubmittedSuccessfully = "user_rating_submitted_successfully"
requestAction.newRideJoin = "new_rider_join_trip"

module.exports = requestAction;