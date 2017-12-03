'use strict'

import config from "../config";

const info = require('debug')('tgspam:mainservice:info')
const debug = require('debug')('tgspam:mainservice:debug')

import lockFile from 'lockfile'
import fs from 'fs-extra'

import Task from '../models/Task'
import Phone from '../models/Phone'

import Telegram from '../telegram'
import SIM5 from '../sms/5sim'
import SIMSms from '../sms/simsms'
import SMSActivate from '../sms/sms-activate'
import log from '../utils/mongo-logger'
import Util from '../utils'
import FakeSMS from "../fake/fakesms";
import FakeTelegram from "../fake/telegram";
import {generateFirstName, generateLastName} from "../utils/profile-util";
import TargetChat from "../models/TargetChat";

let instance = null

export default class MainService {

    static lockFilePath = './lock'

    __workerId = null

    constructor() {
        if (!instance) {
            instance = this;
            instance.__workerId = Util.randomInteger(100, 300)

            const init = () => {
                debug("clean locks...")
                fs.ensureDirSync(MainService.lockFilePath)
                fs.removeSync(MainService.lockFilePath + "/regloop.lock")
                fs.removeSync(MainService.lockFilePath + "/joinloop.lock")
                fs.removeSync(MainService.lockFilePath + "/spamloop.lock")

                debug("init done")
            }
            init();
            setTimeout(instance.loopMain, 5001); // wait other workers
        }
        return instance;
    }

    static getInstance() {
        return new MainService();
    }

    // TODO hack
    pause = async (sec) => {
        for (let i = 0; i < sec; i++) {
            if (!this.__isTaskActive()) return;
            await Util.pause(1)
        }
    }

    __lockFile = (type, block) => new Promise(resolve => {
        if (block) {
            try {
                lockFile.lockSync(MainService.lockFilePath + "/" + type + ".lock", {retries: 0})
                resolve(true)
            } catch (e) {
                debug("%s %o", "lock err", e)
                resolve(false)
            }

        } else {
            try {
                lockFile.unlockSync(MainService.lockFilePath + "/" + type + ".lock")
                resolve(true)
            } catch (e) {
                debug("%s %o", "ulock err", e)
                resolve(false)
            }
        }
    })

    ___isLockFile = (type) => new Promise(resolve => {
        resolve(lockFile.checkSync(MainService.lockFilePath + "/" + type + ".lock"))
    })

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

    regNumber = async (smservice, country, capacity) => {
        if (!await this.__isTaskActive()) return

        const isDebug = false;
        let smsService = null
        if (config.fake) {
            smsService = new FakeSMS(isDebug)
        } else
            switch (smservice) {
                case 'sim5':
                    smsService = new SIM5(isDebug)
                    break;
                case 'sms-activate':
                    smsService = new SMSActivate(isDebug)
                    break;
                case 'simsms':
                default:
                    smsService = new SIMSms(isDebug)
                    break;
            }

        // Check Balance
        let balance = await smsService.getBalance();
        if (!balance) {
            log("error", smsService.state.error)
            return;
        }
        if (parseInt(balance) < 10) {
            log("error", "Balance < 10");
            await this.pause(10)    // TODO configure delay
            return;
        }
        if (!await this.__isTaskActive()) return;

        // Get Phone number
        let state = await smsService.getNumber(country);
        if (!state) {
            log("error", smsService.state.error)
            await this.pause(10) // TODO configure delay
            return false;
        }
        if (!await this.__isTaskActive()) return;

        // Telegram
        let tg = null;
        try {
            // Try connect
            log("connect telegram")
            if (config.fake) tg = new FakeTelegram('./auth/' + state.phone + '.auth');
            else tg = new Telegram('./auth/' + state.phone + '.auth');

            // Try send code
            log("send code for " + state.phone)
            let {phone_registered, phone_code_hash} = await tg.sendCode(state.phone)
            if (!phone_code_hash) {
                log("error", "no answer")
                smsService.ban()
                await tg.remove()
                await this.pause(10)
                return false;
            }
            if (!await this.__isTaskActive()) {
                log("break")
                await tg.remove()
                return;
            }

            // Wait sms code
            log("WAIT_CODE")
            let sms = "WAIT_CODE"
            while (sms === "WAIT_CODE") {
                await this.pause(20)    // TODO configure delay
                sms = await smsService.waitSMS();

                if (!await this.__isTaskActive()) {
                    log("break")
                    await tg.remove()
                    return;
                }
            }
            if (!sms) {
                log("error", smsService.state.error)
                smsService.ban()
                await tg.remove()
                await this.pause(10) // TODO configure delay
                return false;
            }

            // Try register in Telegram
            let auth = false
            if (phone_registered) {
                log("sigIn", state.phone, sms)
                auth = await tg.signIn(state.phone, phone_code_hash, sms)
            } else {
                let first_name = generateFirstName()
                let last_name = generateLastName()
                log("sigUp", state.phone, sms, first_name, last_name)
                auth = await tg.signUp(state.phone, phone_code_hash, sms, first_name, last_name)
            }
            if (!auth) {
                smsService.ban()
                await tg.remove()
                await this.pause(10)    // TODO configure delay
                return false;
            }
            let phone = new Phone({
                number: state.phone,
                user_id: auth.user.id,
                max: capacity
            })
            await phone.save();
            smsService.done();
            await tg.done();
            await this.pause(5)     // TODO configure delay
            return;
        } catch (e) {
            log("error", e)
            if (tg !== null)
                await tg.remove()
            await this.pause(10)    // TODO configure delay
            return false;
        }
    }

    joinPhone = async (phone) => {
        const task = await this.__getTask()
        if (!task.active) return;

        // let cnt = phone.max - phone.joinedchat.length; // left join
        // if (cnt > 1)
        //     cnt = 1;
        //
        // for (let i = 0; i < cnt; i++) {
            let tg = null
            let targetchat = null
            let chat = null
            try {
                if (config.fake) {
                    tg = new FakeTelegram('./auth/' + phone.number + '.auth',20);
                } else {
                    tg = new Telegram('./auth/' + phone.number + '.auth',20);
                }
                targetchat = await TargetChat.findOne({$and: [{"appoinet": 0}, {"active": true}]});
                if (!targetchat) {
                    log("error", "NO_EMPTY_CHATS")
                    await tg.done();
                    return;
                }
                if (!await this.__isTaskActive()) {
                    await tg.remove()
                    return;
                }

                log("join", phone.number, targetchat.link)
                chat = await tg.joinChat(targetchat, 40)
                if (!chat) {
                    log("join fail")
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
                    log("JOIN OK")
                }
            } catch (e) {
                console.log(e)
                log("error", e)
                if (e.message === "INVITE_HASH_EXPIRED" ||
                    e.message === "USERNAME_NOT_OCCUPIED" ||
                    e.message === "USERNAME_INVALID" ||
                    e.message === "NO_CHANNEL") {
                    targetchat.active = false;
                    targetchat.error = e.message;
                    await targetchat.save()
                    if (tg !== null)
                        tg.done()
                    return;
                } else {
                    phone.active = false;
                    phone.error = e.message;
                    phone.save();
                    if (tg !== null)
                        tg.done()
                    return;
                }
            }
        // }
    }

    spamPhone = async (phone) => {
        if (!await this.__isTaskActive()) return

        let targetchats = await TargetChat.find({
            $and: [
                {"appoinet": phone.number},
                {"issent": false},
                {"active": true}
            ]
        })
        if (!targetchats || targetchats.length <= 0) {
            log("error", "no active chat for", phone.number)
            return
        }
        let targetChat = null;
        let tg = null;
        const task = await this.__getTask();
        try {
            if (config.fake) {
                tg = new FakeTelegram('./auth/' + phone.number + '.auth');
            } else {
                tg = new Telegram('./auth/' + phone.number + '.auth');
            }
            for (let i = 0; i < targetchats.length; i++) {
                if (!await this.__isTaskActive()) {
                    log("break")
                    await tg.done();
                    return;
                }

                targetChat = targetchats[i];
                log("send msg", phone.number, targetChat.link)
                try {
                    if (targetChat.channel_id)
                        await tg.messageToChat(task.message, targetChat.channel_id, targetChat.access_hash)
                    else if (targetChat.chat_id)
                        await tg.messageToChat(task.message, targetChat.chat_id);

                    targetChat.sent++
                    targetChat.issent = true
                    targetChat.last = new Date();
                    await targetChat.save()
                    phone.sent++
                    phone.seen = new Date();
                    await phone.save();
                    task.sent++;
                    await task.save()
                    log("SEND OK")
                    await this.pause(1)
                } catch (ex) {
                    log("error",ex)
                    if(ex.message === "USER_DEACTIVATED"){
                        phone.error = ex.message
                        phone.active = false
                        await phone.save()
                        tg.done();
                        return;
                    }else {
                        targetChat.active = false
                        targetChat.error = ex.message
                        await targetChat.save();
                        phone.sent++;
                        await phone.save()
                    }
                }
            }
        } catch (e) {
            log("error", e)
            phone.active = false
            phone.error = e.message
            await phone.save();
            if (tg !== null)
                tg.done();
            return;
        }
    }

    loopReg = async () => {
        if (!await this.__lockFile("regloop", true)) return;
        info("%d %s", (new Date()).getTime(), ">reg")

        const task = await this.__getTask();
        if (task.count > (await Phone.count({"active": true}))) {
            await this.regNumber(task.smservice, task.country, task.capacity)
        }
        info("%d %s", (new Date()).getTime(), "<reg")
        this.__lockFile("regloop", false)
    }

    loopJoin = async () => {
        if (!await this.__lockFile("joinloop", true)) return;
        info("%d %s", (new Date()).getTime(), ">join")

        const phone = await Phone.findOne({
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
        if (phone) {
            await this.joinPhone(phone);
        }

        info("%d %s", (new Date()).getTime(), "<join")
        this.__lockFile("joinloop", false)
    }

    loopSpam = async () => {
        if (!await this.__lockFile("spamloop", true)) return;
        info("%d %s", (new Date()).getTime(), ">spam")

        const phone = await Phone.findOne({
            $and: [
                {$where: "this.joinedchat.length > this.max"},
                {"active": true},
                {'seen': {$lte: new Date((new Date()).getTime() - 1 * 60 * 1000)}},
            ]
        })
        if (phone) {
            await this.spamPhone(phone);
        }

        info("%d %s", (new Date()).getTime(), "<spam")
        this.__lockFile("spamloop", false)
    }

    loopMain = async () => {
        if (await this.__isTaskActive()) {
            info("%d %s %d", (new Date()).getTime(), ">mainloop", this.__workerId)
            if (!await this.___isLockFile("regloop")) await this.loopReg()
            if (!await this.___isLockFile("joinloop")) await this.loopJoin()
            if (!await this.___isLockFile("spamloop")) await this.loopSpam()
            info("%d %s %d", (new Date()).getTime(), "<mainloop", this.__workerId)
        } else
            info("%d %s %d", (new Date()).getTime(), "=skip", this.__workerId)
        // if (!this.__mainLoopIdle) {
        //     this.__mainLoopIdle = setInterval(this.loopMain, 501)
        // }
        await Util.pause(500, true)
        this.loopMain();
    }

    start = async () => {
        const task = await this.__getTask();
        if (!task.active) {
            log("Start task")
            task.active = true;
            await task.save();
        } else {
            log("Task already start")
        }
    }

    stop = async () => {
        const task = await this.__getTask();
        if (task.active) {
            log("Stop task")
            task.active = false;
            await task.save();
        } else {
            log("Task already stop")
        }
    }

    isStart = async () => {
        return await this.__isTaskActive()
    }
}