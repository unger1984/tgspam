'use strict'

import mongoose from 'mongoose'

const Phone = mongoose.Schema({
    number: {type: mongoose.Schema.Types.Number, required: true},                   // Phone number
    user_id: {type: mongoose.Schema.Types.Number, required: false},                 // telegram user_id
    created: {type: Date, default: Date.now, required: true},                       // date when phone registered in telegram
    max: {type: mongoose.Schema.Types.Number, default: 5, required: true,},         // Maximum chat joined
    joinedchat: [                                                                   // List chat where phone joined
        {
            link: {type: mongoose.Schema.Types.String, required: true},             // Link to chat (http://t.me/...)
            type: {type: mongoose.Schema.Types.String, required: true},             // Type of link (public|private)
            chat_id: {type: mongoose.Schema.Types.Number, required: true},          // Telegram chat id
            access_hash: {type: mongoose.Schema.Types.String, required: false},     // Telegram access hash fot channels
            sent: {type: mongoose.Schema.Types.Number, default: 0, required: true}  // Sent message counter
        }
    ],
    sent: {type: mongoose.Schema.Types.Number, default: 0, required: true},         // Sent message counter
    last: {type: Date, required: false},                                            // Last sent message date
    seen: {type: Date, required: false},
    active: {type: mongoose.Schema.Types.Boolean, default: true, required: true},
    error: {type: mongoose.Schema.Types.String, required: false}
})

export default mongoose.model("Phone",Phone)