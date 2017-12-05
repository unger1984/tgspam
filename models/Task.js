'use strict'

import mongoose from 'mongoose'

const Task = mongoose.Schema({
    created: {type: Date, default: Date.now, required: true},                       // date when write log
    active: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
    type: {type: mongoose.Schema.Types.String, required: true, default: "message"},
    smservice: {type: mongoose.Schema.Types.String, required: true},
    country: {type: mongoose.Schema.Types.String, required: true},
    count: {type: mongoose.Schema.Types.Number, required: true},
    max: {type: mongoose.Schema.Types.Number, required: true},
    message: {type: mongoose.Schema.Types.String, required: false},
    algoritm: {type: mongoose.Schema.Types.String, required: true, default: "full"},
})

export default mongoose.model("Task",Task)