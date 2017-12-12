'use strict'

import mongoose from 'mongoose'

const Reg = mongoose.Schema({
    lock: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
})

export default mongoose.model("Reg",Reg)