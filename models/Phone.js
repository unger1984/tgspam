'use strict'

import mongoose from 'mongoose'

const Phone = mongoose.Schema({
    number: {type: mongoose.Schema.Types.Number, required: true},                   // Phone number
    user_id: {type: mongoose.Schema.Types.Number, required: false},                 // telegram user_id
    created: {type: Date, default: Date.now, required: true},                       // date when phone registered in telegram
    joined: {type: mongoose.Schema.Types.Number, required: false, default: 0},
    sent: {type: mongoose.Schema.Types.Number, default: 0, required: true},         // Sent message counter
    seen: {type: Date, required: false},
    active: {type: mongoose.Schema.Types.Boolean, default: true, required: true},
    error: {type: mongoose.Schema.Types.String, required: false},
    lock: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
})

export default mongoose.model("Phone",Phone)