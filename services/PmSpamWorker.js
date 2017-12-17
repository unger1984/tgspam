'use strict'

import Util from "../utils";
import Task from "../models/Task";
import config from "../config";
import log from "../utils/mongo-logger";
import Telegram from "../telegram";
import FakeTelegram from "../fake/telegram";
import {generateFullName} from "../utils/profile-util";
import Phone from "../models/Phone";
import fs from "fs-extra";
import TargetUser from "../models/TargetUser";

const debug = require('debug')('tgspam:debug:pmspamworker')

export default class PmSpamWorker {

    static lockFilePath = './lock'

    Telegram_auth = {
        app_id: "",
        app_hash: "",
    }

    __timecounter = 0
    __isDone = false
    __hangingTimeout = 40   // timeout in sec
    __workerId = null
    __TelegramClient = null;

    constructor(auth) {
        this.__workerId = Util.randomInteger(100, 999)
        this.Telegram_auth = auth;
    }

    __hangingTimer = async () => {
        if(this.__isDone) return;
        // debug("%d %d %s %d",(new Date()).getTime(), this.__workerId, "hangin tick",this.__timecounter)
        if (this.__timecounter >= this.__hangingTimeout) {
            // kill worker, it was hanging
            log("error", "telegram hanging " + this.__timecounter + "sec, try kill it...")
            fs.removeSync(PmSpamWorker.lockFilePath + "/pmspamloop.lock")
            log("telegram killed")
            process.exit(1)
        }
        this.__timecounter++;
        setTimeout(this.__hangingTimer, 1001)
    }

    __getTask = async () => {
        let task = await Task.findOne({type: 'pm'});
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
        this.__hangingTimer()
        const res = await this.__worker(phone)
        this.__isDone = true;
        return res;
    }

    __worker = async (phone) => {

        if (!await this.__isTaskActive()) return

        let targetusers = await TargetUser.find({
            $and: [
                {"issent": false},
                {"active": true}
            ]
        })
        if (!targetusers || targetusers.length <= 0) {
            log("error", "no active chat for", phone.number)
            return
        }
        let targetUser = null;
        const task = await this.__getTask();
        try {
            if (config.fake) {
                this.__TelegramClient = new FakeTelegram('./auth/' + phone.number + '.auth');
            } else {
                this.__TelegramClient = new Telegram(this.Telegram_auth,'./auth/' + phone.number + '.auth');
            }
            for (let i = 0; i < targetusers.length; i++) {
                if (!await this.__isTaskActive()) {
                    log("break")
                    await this.__TelegramClient.done();
                    return;
                }

                targetUser = targetusers[i];
                log("send msg", phone.number, targetUser.user_id, targetUser.username, targetUser.first_name, targetUser.last_name)
                try {
                    // await this.__TelegramClient.readMessages(0)
                    // await this.__TelegramClient.messageToUser(task.message+"\n\n"+generateFullName(), targetUser.user_id, targetUser.access_hash);
                    await this.__TelegramClient.messageToUser(generateFullName(), targetUser.user_id, targetUser.access_hash);

                    targetUser.sent++
                    targetUser.issent = true
                    targetUser.last = new Date();
                    targetUser.appoinet = phone.number
                    await targetUser.save()
                    phone.sent++
                    phone.seen = new Date();
                    await phone.save();
                    task.sent++;
                    await task.save()
                    log("SEND OK", phone.number)
                    await this.pause(1)
                    // await this.__TelegramClient.readMessages(0)
                    await this.pause(15)         // TODO configure delay
                    this.__timecounter = 0
                } catch (ex) {
                    log("error", phone.number, ex)
                    if (ex.message === "USER_DEACTIVATED"
                        || ex.message === "USER_BANNED_IN_CHANNEL") {
                        phone.error = ex.message
                        phone.active = false
                        await phone.save()
                        this.__TelegramClient.done();
                        return;
                    } else {
                        targetUser.active = false
                        targetUser.error = ex.message
                        targetUser.appoinet = phone.number
                        await targetUser.save();
                        phone.sent++;
                        await phone.save()
                        await this.pause(15)     // TODO configure delay
                        this.__timecounter = 0
                    }
                }
            }
        } catch (e) {
            log("error", phone.number, e)
            phone.active = false
            phone.error = e.message
            await phone.save();
            if (this.__TelegramClient !== null)
                this.__TelegramClient.done();
            return;
        }
    }
}