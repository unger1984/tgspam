'use strict'

import Util from "../utils";
import config from "../config";
import log from "../utils/mongo-logger";
import Telegram from "../telegram";
import FakeTelegram from "../fake/telegram";
import Chat from "../models/Chat";
import fs from "fs-extra";
import redis from 'redis'
import Phone from "../models/Phone";

const debug = require('debug')('tgspam:debug:joinworker')

export default class JoinWorker {

    static lockFilePath = './lock'

    __isRuning = true
    __isBusy = false
    __timecounter = 0
    __isDone = false
    __hangingTimeout = 20   // timeout in sec
    __workerId = null
    __TelegramClient = null

    phone = null
    targetchat = null

    constructor() {
        this.__workerId = Util.randomInteger(100, 999)
        const subscriber = redis.createClient()
        subscriber.on("message", async (channel, message) => {
            debug("message",channel,message)
            switch (channel) {
                case "tgspam:join:stop":
                    this.__isRuning = false
                    break;
                case "tgspam:join:start":
                    this.__isRuning = true
                    if (this.__isBusy) return;
                    this.__isBusy = true;
                    let phone = await Phone.findOne({
                        $and: [
                            {$where: "this.joinedchat.length < this.max"},
                            {"active": true},
                            {
                                $or: [
                                    {'seen': {$lte: new Date((new Date()).getTime() - 1 * 60 * 1000)}},
                                    {'seen': {$exists: false}}
                                ]
                            }
                        ]
                    })
                    break;
                case "tgspam:join:join":
                    if (this.__isRuning) {
                        const msg = JSON.parse(message)
                        const phone = await Phone.findOneAndUpdate({
                            $and: [
                                {"number": msg.number},
                                {"active": true},
                                {"lock": false}
                            ]
                        }, {$set: {"lock": true}}, {new: false})
                        if(phone){
                            this.run(phone)
                        }
                    }
                    break;
            }
        })

        subscriber.subscribe("tgspam:join:stop")
        subscriber.subscribe("tgspam:join:start")
        subscriber.subscribe("tgspam:join:join")
    }

    __hangingTimer = async () => {
        if (this.__isDone) return;
        // debug("%d %d %s %d",(new Date()).getTime(), this.__workerId, "hangin tick",this.__timecounter)
        if (this.__timecounter >= this.__hangingTimeout) {
            // kill worker, it was hanging
            log("error", "telegram hanging " + this.__timecounter + "sec, try kill it...")
            fs.removeSync(JoinWorker.lockFilePath + "/joinloop.lock")

            // Unlock task
            if (this.targetchat !== null) {
                this.targetchat.lock = false
                await this.targetchat.save()
            }

            if (this.phone !== null) {
                this.phone.lock = false
                await this.phone.save()
            }

            log("telegram killed")
            process.exit(1)
        }
        this.__timecounter++;
        setTimeout(this.__hangingTimer, 1001)
    }

    run = async (phone) => {
        this.phone = phone
        this.__timecounter = 0
        this.__isDone = false;
        this.__hangingTimer()
        const res = await this.__worker()
        this.phone.lock = false
        await this.phone.save()
        this.__isDone = true;
        return res;
    }

    __worker = async () => {
        if (!this.__isRuning) {
            return;
        }

        let chat = null
        try {
            if (config.fake) {
                this.__TelegramClient = new FakeTelegram('./auth/' + this.phone.number + '.auth', 20);
            } else {
                this.__TelegramClient = new Telegram('./auth/' + this.phone.number + '.auth', 20);
            }
            this.targetchat = await TargetChat.findOneAndUpdate(
                {
                    $and: [
                        {"number": 0},
                        {"active": true},
                        {"lock": false}
                    ]
                }, {$set: {"lock": true}}, {new: false});
            if (!this.targetchat) {
                log("error", this.phone.number, "NO_EMPTY_CHATS")
                await this.__TelegramClient.done();
                return;
            }
            if (!this.__isRuning) {
                this.targetchat.lock = false
                await this.targetchat.save();
                await this.__TelegramClient.done()
                return;
            }

            log("join", this.phone.number, this.targetchat.link)
            chat = await this.__TelegramClient.joinChat(this.targetchat, 40)
            if (!chat) {
                log("join fail", this.phone.number)
                this.targetchat.lock = false
                await this.targetchat.save();
            } else {
                let type = null;
                if (chat._ === "channel") {
                    this.targetchat.channel_id = chat.id
                    this.targetchat.access_hash = chat.access_hash
                    type = "channel"
                } else {
                    this.targetchat.chat_id = chat.id
                    type = "chat"
                }
                this.targetchat.number = this.phone.number
                this.targetchat.lock = false
                await this.targetchat.save()
                this.phone.joined++
                this.phone.seen = new Date()
                await this.phone.save()
                log("JOIN OK", this.phone.number)
            }
        } catch (e) {
            console.log(e)
            log("error", this.phone.number, e)
            if (this.targetchat && (e.message === "INVITE_HASH_EXPIRED" ||
                    e.message === "USERNAME_NOT_OCCUPIED" ||
                    e.message === "USERNAME_INVALID" ||
                    e.message === "NO_CHANNEL")) {
                this.targetchat.active = false;
                this.targetchat.error = e.message;
                this.targetchat.lock = false
                await this.targetchat.save()
                if (this.__TelegramClient !== null)
                    this.__TelegramClient.done()
                return;
            } else {
                this.phone.active = false;
                this.phone.error = e.message;
                this.phone.save();
                if (this.__TelegramClient !== null)
                    this.__TelegramClient.done()
                return;
            }
        }
    }
}