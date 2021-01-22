const dbConnector = require('./dbconnector');
const Schema = dbConnector.mongoose.Schema;

const drivers = new Schema({
   id: Schema.Types.ObjectId,
   user: {
      type: String,
      required: true,
      unique: true
   },
   online: {
      type: Boolean,
      default: false
   },
   on_trip: {
      type: Boolean,
      default: false
   },
   location: {
      type: {
         type: String,
         enum: ['Point'],
         required: true
      },
      coordinates: {
         type: [Number],
         required: true
      },
   },
   riders: {
      type: Array,
      maxlength: 4,
   },
   class: {
      type: String,
      enum: ['A', 'B', 'C', 'D']
   }
}, {
   timestamps: true,
   minimize: false,
   id: true,
});

drivers.index({ location: '2dsphere' });


module.exports = dbConnector.zenoTripDB.model('drivers', drivers);