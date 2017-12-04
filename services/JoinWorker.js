'use strict'

import Util from "../utils";
import Task from "../models/Task";
import config from "../config";
import log from "../utils/mongo-logger";
import Telegram from "../telegram";
import FakeTelegram from "../fake/telegram";
import TargetChat from "../models/TargetChat";
import fs from "fs-extra";

const debug = require('debug')('tgspam:debug:joinworker')

export default class JoinWorker {

    static lockFilePath = './lock'

    __timecounter = 0
    __isDone = false
    __hangingTimeout = 20   // timeout in sec
    __workerId = null
    __TelegramClient = null;


    constructor() {
        this.__workerId = Util.randomInteger(100, 999)
    }

    __hangingTimer = async () => {
        if(this.__isDone) return;
        // debug("%d %d %s %d",(new Date()).getTime(), this.__workerId, "hangin tick",this.__timecounter)
        if (this.__timecounter >= this.__hangingTimeout) {
            // kill worker, it was hanging
            log("error", "telegram hanging " + this.__timecounter + "sec, try kill it...")
            fs.removeSync(JoinWorker.lockFilePath + "/joinloop.lock")
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

    run = async (phone) => {
        this.__timecounter = 0
        this.__hangingTimer()
        const res = await this.__worker(phone)
        this.__isDone = true;
        return res;
    }

    __worker = async (phone) => {
        const task = await this.__getTask()
        if (!task.active) return;

        let targetchat = null
        let chat = null
        try {
            if (config.fake) {
                this.__TelegramClient = new FakeTelegram('./auth/' + phone.number + '.auth',20);
            } else {
                this.__TelegramClient = new Telegram('./auth/' + phone.number + '.auth',20);
            }
            targetchat = await TargetChat.findOne({$and: [{"appoinet": 0}, {"active": true}]});
            if (!targetchat) {
                log("error", phone.number, "NO_EMPTY_CHATS")
                await this.__TelegramClient.done();
                return;
            }
            if (!await this.__isTaskActive()) {
                await this.__TelegramClient.remove()
                return;
            }

            log("join", phone.number, targetchat.link)
            chat = await this.__TelegramClient.joinChat(targetchat, 40)
            if (!chat) {
                log("join fail",phone.number)
            } else {
                let type = null;
                if (chat._ === "channel") {
                    targetchat.channel_id = chat.id
                    targetchat.access_hash = chat.access_hash
                    type = "channel"
                } else {
                    targetchat.chat_id = chat.id
                    type = "chat"
                }
                targetchat.appoinet = phone.number
                await targetchat.save();
                phone.joinedchat.push(
                    {
                        link: targetchat.link,
                        type: type,
                        chat_id: chat.id,
                        access_hash: targetchat.access_hash,
                        sent: 0
                    }
                )
                phone.seen = new Date();
                await phone.save();
                log("JOIN OK",phone.number)
            }
        } catch (e) {
            console.log(e)
            log("error", phone.number, e)
            if (e.message === "INVITE_HASH_EXPIRED" ||
                e.message === "USERNAME_NOT_OCCUPIED" ||
                e.message === "USERNAME_INVALID" ||
                e.message === "NO_CHANNEL") {
                targetchat.active = false;
                targetchat.error = e.message;
                await targetchat.save()
                if (this.__TelegramClient !== null)
                    this.__TelegramClient.done()
                return;
            } else {
                phone.active = false;
                phone.error = e.message;
                phone.save();
                if (this.__TelegramClient !== null)
                    this.__TelegramClient.done()
                return;
            }
        }
    }
}