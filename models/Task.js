'use strict'

import mongoose from 'mongoose'

const Task = mongoose.Schema({
    created: {type: Date, default: Date.now, required: true},                       // date when write log
    active: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
    smservice: {type: mongoose.Schema.Types.String, required: true},
    country: {type: mongoose.Schema.Types.String, required: true},
    count: {type: mongoose.Schema.Types.Number, required: false},
    capacity: {type: mongoose.Schema.Types.Number, required: false},
    message: {type: mongoose.Schema.Types.String, required: false},
    sent: {type: mongoose.Schema.Types.Number, default: 0, required: true},
    type: {type: mongoose.Schema.Types.String, default: 'chat', required: true, unique: true},
})

export default mongoose.model("Task",Task)