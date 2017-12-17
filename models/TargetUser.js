'use strict'

import mongoose from 'mongoose'

const TargetUser = mongoose.Schema({
    created: {type: Date, default: Date.now, required: true},                   // date when chat created in system
    user_id: {type: mongoose.Schema.Types.Number, required: true, unique: true},              // Telegram chat id
    access_hash: {type: mongoose.Schema.Types.String, required: false},         // Telegram access hash fot channels
    username: {type: mongoose.Schema.Types.String, required: false},
    first_name: {type: mongoose.Schema.Types.String, required: false},
    last_name: {type: mongoose.Schema.Types.String, required: false},
    sent: {type: mongoose.Schema.Types.Number, default: 0, required: true},     // Sent message counter
    issent: {type: mongoose.Schema.Types.Boolean, default: false, required: true},     // is sent message
    last: {type: Date, required: false},                                              // Last sent message date
    appoinet: {type: mongoose.Schema.Types.Number, default: 0, required: false},       // If chat appoinet any number
    active: {type: mongoose.Schema.Types.Boolean, default: true, required: true},
    error: {type: mongoose.Schema.Types.String, required: false}
})

export default mongoose.model("TargetUser",TargetUser)