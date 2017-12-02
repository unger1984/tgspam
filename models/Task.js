'use strict'

import mongoose from 'mongoose'

const Task = mongoose.Schema({
    created: {type: Date, default: Date.now, required: true},                       // date when write log
    active: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
    smservice: {type: mongoose.Schema.Types.String, required: true},
    country: {type: mongoose.Schema.Types.String, required: true},
    count: {type: mongoose.Schema.Types.Number, required: true},
    capacity: {type: mongoose.Schema.Types.Number, required: true},
    message: {type: mongoose.Schema.Types.String, required: false},
    sent: {type: mongoose.Schema.Types.Number, default: 0, required: true},

    isRegLoop: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
    isJoinLoop: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
    isSpamLoop: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
})

export default mongoose.model("Task",Task)