'use strict'

import mongoose from 'mongoose'

const PmPhone = mongoose.Schema({
    number: {type: mongoose.Schema.Types.Number, required: true},                   // Phone number
    user_id: {type: mongoose.Schema.Types.Number, required: false},                 // telegram user_id
    created: {type: Date, default: Date.now, required: true},                       // date when phone registered in telegram
    max: {type: mongoose.Schema.Types.Number, default: 5, required: true,},         // Maximum chat joined
    joined: {type: mongoose.Schema.Types.Number, default: 0, required: true,},
    sent: {type: mongoose.Schema.Types.Number, default: 0, required: true},         // Sent message counter
    last: {type: Date, required: false},                                            // Last sent message date
    seen: {type: Date, required: false},
    active: {type: mongoose.Schema.Types.Boolean, default: true, required: true},
    error: {type: mongoose.Schema.Types.String, required: false}
})

export default mongoose.model("PmPhone",PmPhone)