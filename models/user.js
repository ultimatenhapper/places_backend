const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name: { type: String, require: true}, 
    // the unique property creates an index to speed our queries
    email: { type: String, require: true, unique: true },
    password: { type: String, require: true, minlength: 6},
    image: { type: String, require: true},
    places: [{ type: mongoose.Types.ObjectId, require: true, ref: 'Place'}]
});

module.exports = mongoose.model('User', userSchema );