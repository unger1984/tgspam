'use strict'

import mongoose from 'mongoose'

const Settings = mongoose.Schema({
    app_id: {type: mongoose.Schema.Types.String, required: true},                       // date when write log
    app_hash: {type: mongoose.Schema.Types.String, required: true},                     // Log message
})

export default mongoose.model("Settings",Settings)