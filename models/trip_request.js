const dbConnector = require('./dbconnector');
const Schema = dbConnector.mongoose.Schema;

// const TripClassA = new Schema({
//    id: Schema.Types.ObjectId,
//    driver_id: {
//       type: String,
//       required: true,
//    },
//    riders: {
//       type: Array,
//       default: [],
//       required: true
//    },
//    ride_status: {
//       type: String,
//       enum: ['waiting', 'on_ride', 'completed'],
//       required: true,
//    },
//    created: {
//       type: String,
//       default: (new Date().toString()).substr(0, 10)
//    }
// }, {
//    timestamps: true,
//    minimize: false,
//    id: true,
// });


// const TripClassB = new Schema({
//    id: Schema.Types.ObjectId,
//    driver_id: {
//       type: String,
//       required: true,
//    },
//    riders: {
//       type: Array,
//       default: [],
//       required: true
//    },
//    ride_status: {
//       type: String,
//       enum: ['waiting', 'on_ride', 'completed'],
//       required: true,
//    },
//    ride_class: {
//       type: String,
//       enum: ['A', 'B', 'C', 'D'],
//       required: true
//    },
//    destination: {
//       type: {
//          type: String,
//          enum: ['Point'],
//          required: true
//       },
//       coordinates: {
//          type: [Number],
//          required: true
//       },
//    },
//    created: {
//       type: String,
//       default: (new Date().toString()).substr(0, 10)
//    }
// }, {
//    timestamps: true,
//    minimize: false,
//    id: true,
// });

// TripClassB.index({ destination: '2dsphere' });


const TripRequests = new Schema({
   id: Schema.Types.ObjectId,
   driver_id: {
      type: String,
      required: true,
   },
   riders: {
      type: Array,
      default: [],
      required: true
   },
   ride_status: {
      type: String,
      enum: ['waiting', 'on_ride', 'completed'],
      required: true,
   },
   ride_class: {
      type: String,
      enum: ['A', 'B', 'C', 'D'],
      required: true
   },
   location: [{
      origin: {
         type: {
            type: String,
            required: true,
            default: 'Point'
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
            default: 'Point'
         },
         coordinates: {
            type: [Number],
            required: true
         }
      },
   }],
   created: {
      type: String,
      default: (new Date().toISOString()).substr(0, 10)
   }
}, {
   timestamps: true,
   minimize: false,
   id: true,
});

TripRequests.index({ 'location.origin': '2dsphere', 'location.destination': '2dsphere' });




// the riders field will be array of object. e.g below
// {
//    rider_id: "the-user-id-requesting-the-ride",
//    name: "name-of-the-user",
//    email: "email-of-the-user",
//    phone: "phone-of-the-user",
//    startLoc: "the-rider-pick-up-location",
//    endLoc: "the-rider-destination",
//    distance: "distance-of-the-journey",
//    price: "amount-paid-for-the-trip",
// }



module.exports = {
   // TripClassA: dbConnector.zenoTripDB.model('trip_a_requests', TripClassA),
   // TripClassB: dbConnector.zenoTripDB.model('trip_b_requests', TripClassB),
   TripRequests: dbConnector.zenoTripDB.model('trip_requests', TripRequests)
}