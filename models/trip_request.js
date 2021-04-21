const dbConnector = require('./dbconnector');
const Schema = dbConnector.mongoose.Schema;


const TripRequests = new Schema({
   id: Schema.Types.ObjectId,
   driver_id: {
      type: String,
      required: true,
   },
   driver_data: {
      type: Object,
      default: {}
   },
   riders: {
      type: Array,
      default: [],
      required: true
   },
   ride_status: {
      type: String,
      enum: ["waiting", "on_ride", "completed", "cancel", "delay", "on_pickup"],
      required: true,
   },
   ride_class: {
      type: String,
      enum: ["A", "B", "C", "D"],
      required: true
   },
   ride_class_complete: {
      type: Boolean,
      default: false
   },
   rider_compass: {
      type: String,
      required: true
   },
   location: [{
      origin: {
         type: {
            type: String,
            required: true,
            default: "Point"
         },
         coordinates: {
            type: [Number],
            required: true
         }
      },
      destination: {
         type: {
            type: String,
            required: true,
            default: "Point"
         },
         coordinates: {
            type: [Number],
            required: true
         }
      },
   }],
   // created: {
   //    type: String,
   //    default: (new Date().toISOString()).substr(0, 10)
   // }
}, {
   timestamps: true,
   minimize: false,
   id: true,
});
TripRequests.index({ 'location.origin': '2dsphere', 'location.destination': '2dsphere' });


//for rating
const TripRatings = new Schema({
   id: Schema.Types.ObjectId,
   user_id: {
      type: String,
      required: true
   },
   trip_id: {
      type: Schema.Types.ObjectId,
      ref: 'trip_request',
      required: true
   },
   rater_id: {
      type: String,
      required: true,
   },
   rating: {
      type: Number,
      default: 0,
      required: true
   }
}, {
   timestamps: true,
   minimize: false,
   id: true
})


//for rating
const DriverWorkHours = new Schema({
   id: Schema.Types.ObjectId,
   driver_id: {
      type: String,
      required: true
   },
   trip_id: {
      type: Schema.Types.ObjectId,
      ref: 'trip_request',
      required: true,
      unique: true
   },
   km: {
      type: Number,
      default: 0,
      required: true,
   },
   time: {
      type: Number,
      default: 0,
      required: true
   }
}, {
   timestamps: true,
   minimize: false,
   id: true
})



module.exports = {
   TripRequests: dbConnector.zenoTripDB.model('trip_requests', TripRequests),
   TripRatings: dbConnector.zenoTripDB.model('trip_ratings', TripRatings),
   DriverWorkHours: dbConnector.zenoTripDB.model('driver_work_hours', DriverWorkHours),
}