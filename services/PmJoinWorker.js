'use strict'

import Util from "../utils";
import Task from "../models/Task";
import config from "../config";
import log from "../utils/mongo-logger";
import Telegram from "../telegram";
import FakeTelegram from "../fake/telegram";
import TargetChat from "../models/TargetChat";
import fs from "fs-extra";
import TargetUser from "../models/TargetUser";

const debug = require('debug')('tgspam:debug:pmjoinworker')

export default class PmJoinWorker {

    static lockFilePath = './lock'

    Telegram_auth = {
        app_id: "",
        app_hash: "",
    }

    __timecounter = 0
    __isDone = false
    __hangingTimeout = 20   // timeout in sec
    __workerId = null
    __TelegramClient = null;


    constructor(auth) {
        this.__workerId = Util.randomInteger(100, 999)
        this.Telegram_auth = auth;
    }

    __hangingTimer = async () => {
        if (this.__isDone) return;
        // debug("%d %d %s %d",(new Date()).getTime(), this.__workerId, "hangin tick",this.__timecounter)
        if (this.__timecounter >= this.__hangingTimeout) {
            // kill worker, it was hanging
            log("error", "telegram hanging " + this.__timecounter + "sec, try kill it...")
            fs.removeSync(PmJoinWorker.lockFilePath + "/pmjoinloop.lock")
            log("telegram killed")
            process.exit(1)
        }
        this.__timecounter++;
        setTimeout(this.__hangingTimer, 1001)
    }

    __getTask = async () => {
        let task = await Task.findOne({type: 'pm'});
        if (!task) {
            task = new Task({type: 'pm', smservice: 'simsms', country: 'ru', active: false})
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
                this.__TelegramClient = new FakeTelegram('./auth/' + phone.number + '.auth', 20);
            } else {
                this.__TelegramClient = new Telegram(this.Telegram_auth, './auth/' + phone.number + '.auth', 20);
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
            chat = await this.__TelegramClient.joinChat(targetchat, true)
            if (!chat) {
                log("join fail", phone.number)
            } else {
                let chatUsers = null
                if (chat._ === "chatInviteAlready") {
                    chat = chat.chat
                    chatUsers = await this.__TelegramClient.getChat(chat.id)
                    chatUsers = chatUsers.users
                } else if (chat._ === "updates") {
                    chat = chat.chats[0]
                    chatUsers = await this.__TelegramClient.getChat(chat.id, chat.access_hash)
                    chatUsers = chatUsers.users
                } else {
                    chatUsers = chat.users;
                    chat = chat[0]
                }

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
                phone.joined++
                phone.seen = new Date();
                await phone.save();
                log("JOIN OK", phone.number)
                let userCount = 0;
                if (chatUsers && chatUsers.length > 0) {
                    for (let j = 0; j < chatUsers.length; j++) {
                        let u = chatUsers[j];
                        if ((!u.self || u.self === undefined) && (!u.deleted || u.deleted === undefined)) {
                            let user = await TargetUser.findOne({"user_id": u.id});
                            if (!user) {
                                user = new TargetUser({
                                    user_id: u.id,
                                    access_hash: u.access_hash,
                                    username: u.username,
                                    first_name: u.first_name,
                                    last_name: u.last_name
                                })
                                await user.save()
                                userCount++;
                            }
                        }
                    }
                }
                log("Add user ", userCount)
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