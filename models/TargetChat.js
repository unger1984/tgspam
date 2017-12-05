'use strict'

import mongoose from 'mongoose'

const TargetChat = mongoose.Schema({
    created: {type: Date, default: Date.now, required: true},                   // date when chat created in system
    link: {type: mongoose.Schema.Types.String, required: true},                 // Link to chat (http://t.me/...)
    type: {type: mongoose.Schema.Types.String, required: true},                 // Type of link (public|private)
    chat_id: {type: mongoose.Schema.Types.Number, required: false},              // Telegram chat id
    channel_id:  {type: mongoose.Schema.Types.Number, required: false},
    access_hash: {type: mongoose.Schema.Types.String, required: false},         // Telegram access hash fot channels
    issent: {type: mongoose.Schema.Types.Boolean, default: false, required: true},     // is sent message
    last: {type: Date, required: false},                                              // Last sent message date
    number: {type: mongoose.Schema.Types.Number, default: 0, required: false},       // If chat appoinet any number
    active: {type: mongoose.Schema.Types.Boolean, default: true, required: true},
    error: {type: mongoose.Schema.Types.String, required: false},
    lock: {type: mongoose.Schema.Types.Boolean, default: false, required: true},
})

export default mongoose.model("TargetChat",TargetChat)