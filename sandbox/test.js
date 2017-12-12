'use strict'

// import Phone from '../models/Phone'
// import Task from "../models/Task";

import redis from 'redis'

import SMSOnline from '../sms/onlinesim'
import SMSReg from '../sms/sms-reg'
import SMSka from '../sms/smska'

const test = async () => {

    const subscriber = redis.createClient()
    subscriber.on("message",(channel,message) => {
        console.log("Message",channel,message)
    })

    subscriber.subscribe("tgspam")

    redis.createClient().publish("tgspam:test",JSON.stringify({test: true}))
}

export default test