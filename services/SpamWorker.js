'use strict'

import Util from "../utils";
import Task from "../models/Task";
import config from "../config";
import log from "../utils/mongo-logger";
import Telegram from "../telegram";
import FakeTelegram from "../fake/telegram";
import Chat from "../models/Chat";
import Phone from "../models/Phone";
import fs from "fs-extra";

const debug = require('debug')('tgspam:debug:spamworker')

export default class SpamWorker {

    static lockFilePath = './lock'

    __timecounter = 0
    __isDone = false
    __hangingTimeout = 20   // timeout in sec
    __workerId = null
    __TelegramClient = null;

    phone = null

    constructor() {
        this.__workerId = Util.randomInteger(100, 999)
    }

    __hangingTimer = async () => {
        if(this.__isDone) return;
        // debug("%d %d %s %d",(new Date()).getTime(), this.__workerId, "hangin tick",this.__timecounter)
        if (this.__timecounter >= this.__hangingTimeout) {
            // kill worker, it was hanging
            log("error", "telegram hanging " + this.__timecounter + "sec, try kill it...")
            fs.removeSync(SpamWorker.lockFilePath + "/spamloop.lock")

            // Unlock task
            if(this.phone!==null){
                this.phone.lock = false
                await this.phone.save()
            }

            log("telegram killed")
            process.exit(1)
        }
        this.__timecounter++;
        setTimeout(this.__hangingTimer, 1001)
    }

    __getTask = async () => {
        let task = await Task.findOne({});
        if (!task) {
            task = new Task({smservice: 'simsms', country: 'ru', count: 10, capacity: 10, active: false})
        }
        return task
    }

    __isTaskActive = async () => {
        return (await this.__getTask()).active;
    }

    pause = async (sec) => {
        for (let i = 0; i < sec; i++) {
            if (!this.__isTaskActive()) return;
            await Util.pause(1)
        }
    }

    run = async (phone) => {
        this.__timecounter = 0
        this.phone = phone
        this.__hangingTimer()
        const res = await this.__worker()
        this.__isDone = true;
        return res;
    }

    __worker = async () => {
        if (!await this.__isTaskActive()) return

        let targetchats = await TargetChat.find({
            $and: [
                {"appoinet": this.phone.number},
                {"issent": false},
                {"active": true}
            ]
        })
        if (!targetchats || targetchats.length <= 0) {
            log("error", "no active chat for", phone.number)
            return
        }
        const task = await this.__getTask();
        let targetChat = null
        try {
            if (config.fake) {
                this.__TelegramClient = new FakeTelegram('./auth/' + this.phone.number + '.auth');
            } else {
                this.__TelegramClient = new Telegram('./auth/' + this.phone.number + '.auth');
            }
            for (let i = 0; i < targetchats.length; i++) {
                if (!await this.__isTaskActive()) {
                    log("break")
                    await this.__TelegramClient.done();
                    return;
                }

                targetChat = targetchats[i];
                log("send msg", this.phone.number, targetChat.link)
                try {
                    if (targetChat.channel_id)
                        await this.__TelegramClient.messageToChat(task.message, targetChat.channel_id, targetChat.access_hash)
                    else if (targetChat.chat_id)
                        await this.__TelegramClient.messageToChat(task.message, targetChat.chat_id);

                    targetChat.issent = true
                    targetChat.last = new Date();
                    await targetChat.save()
                    this.phone.sent++
                    this.phone.seen = new Date();
                    await this.phone.save();
                    log("SEND OK", this.phone.number)
                    await this.pause(1)         // TODO configure delay
                    this.__timecounter = 0
                } catch (ex) {
                    log("error", this.phone.number, ex)
                    if (ex.message === "USER_DEACTIVATED"
                        || ex.message === "USER_BANNED_IN_CHANNEL") {
                        this.phone.error = ex.message
                        this.phone.active = false
                        await this.phone.save()
                        this.__TelegramClient.done();
                        return;
                    } else {
                        targetChat.active = false
                        targetChat.error = ex.message
                        await targetChat.save();
                        this.phone.sent++;
                        await this.phone.save()
                        await this.pause(1)     // TODO configure delay
                        this.__timecounter = 0
                    }
                }
            }
        } catch (e) {
            log("error", this.phone.number, e)
            this.phone.active = false
            this.phone.error = e.message
            await this.phone.save();
            if (this.__TelegramClient !== null)
                this.__TelegramClient.done();
            return;
        }
    }
}