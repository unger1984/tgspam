'use strict'

import mongoose from 'mongoose'

const Log = mongoose.Schema({
    created: {type: Date, default: Date.now, required: true},                       // date when write log
    message: {type: mongoose.Schema.Types.String, required: true},                     // Log message
})

export default mongoose.model("Log",Log)