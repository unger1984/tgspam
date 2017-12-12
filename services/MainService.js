'use strict'

import config from "../config";

const info = require('debug')('tgspam:info:mainservice')
const debug = require('debug')('tgspam:debug:mainservice')

import lockFile from 'lockfile'
import fs from 'fs-extra'

import Task from '../models/Task'
import Phone from '../models/Phone'

import Telegram from '../telegram'
import SIM5 from '../sms/5sim'
import SIMSms from '../sms/simsms'
import SMSActivate from '../sms/sms-activate'
import SMSka from '../sms/smska'
import SMSReg from '../sms/sms-reg'
import SIMOnline from '../sms/onlinesim'
import log from '../utils/mongo-logger'
import Util from '../utils'
import FakeSMS from "../fake/fakesms";
import FakeTelegram from "../fake/telegram";
import {generateFirstName, generateLastName} from "../utils/profile-util";
import TargetChat from "../models/TargetChat";

import RegWorker from "./RegWorker";
import JoinWorker from "./JoinWorker";
import SpamWorker from "./SpamWorker";
import Settings from "../models/Settings";

let instance = null

export default class MainService {

    static lockFilePath = './lock'

    __workerId = null

    Telegram_auth = {
        app_id: "",
        app_hash: "",
    }

    constructor() {
        if (!instance) {
            instance = this;
            instance.__workerId = Util.randomInteger(100, 999)

            const init = async () => {
                debug("clean locks...")
                fs.ensureDirSync(MainService.lockFilePath)
                fs.removeSync(MainService.lockFilePath + "/regloop.lock")
                fs.removeSync(MainService.lockFilePath + "/joinloop.lock")
                fs.removeSync(MainService.lockFilePath + "/spamloop.lock")

                let settings = await Settings.findOne({});
                if(!settings){
                    settings = new Settings({app_id: '',app_hash: ''})
                }

                instance.Telegram_auth.app_id = settings.app_id
                instance.Telegram_auth.app_hash = settings.app_hash

                debug("init done")
            }
            init();
            setTimeout(instance.loopMain, 10001); // wait other workers
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
                debug("%d %d %s %o", (new Date()).getTime(), this.__workerId, "lock err", e)
                resolve(false)
            }

        } else {
            try {
                lockFile.unlockSync(MainService.lockFilePath + "/" + type + ".lock")
                resolve(true)
            } catch (e) {
                debug("%d %d %s %o", (new Date()).getTime(), this.__workerId, "ulock err", e)
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

    loopReg = async () => {
        if (!await this.__lockFile("regloop", true)) return;
        info("%d %d %s", (new Date()).getTime(), this.__workerId, ">reg")

        const task = await this.__getTask();
        if (task.count > (await Phone.count({}))) {
            const worker = new RegWorker(this.Telegram_auth)
            await worker.run(task.smservice, task.country, task.capacity)
        }
        info("%d %d %s", (new Date()).getTime(), this.__workerId, "<reg")
        this.__lockFile("regloop", false)
    }

    loopJoin = async () => {
        if (!await this.__lockFile("joinloop", true)) return;
        info("%d %d %s", (new Date()).getTime(), this.__workerId, ">join")

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
            const worker = new JoinWorker(this.Telegram_auth);
            await worker.run(phone);
        }

        info("%d %d %s", (new Date()).getTime(), this.__workerId, "<join")
        this.__lockFile("joinloop", false)
    }

    loopSpam = async () => {
        if (!await this.__lockFile("spamloop", true)) return;
        info("%d %d %s", (new Date()).getTime(), this.__workerId, ">spam")

        const task = await this.__getTask();
        const phone = await Phone.findOne({'joinedchat': {$size: task.capacity}})
            .where('active').equals(true)
            .where('seen').lte(new Date((new Date()).getTime() - 1 * 60 * 1000))
            .where('sent').lt(task.capacity)
            .limit(1)
            .exec()
        if (phone) {
            const worker  = new SpamWorker(this.Telegram_auth)
            await worker.run(phone);
        }

        info("%d %d %s", (new Date()).getTime(), this.__workerId, "<spam")
        this.__lockFile("spamloop", false)
    }

    loopMain = async () => {
        if (await this.__isTaskActive()) {
            info("%d %d %s", (new Date()).getTime(), this.__workerId, ">mainloop")
            if (!await this.___isLockFile("regloop")) await this.loopReg()
            if (!await this.___isLockFile("joinloop")) await this.loopJoin()
            if (!await this.___isLockFile("spamloop")) await this.loopSpam()
            info("%d %d %s", (new Date()).getTime(), this.__workerId, "<mainloop")
        } else
            info("%d %d %s", (new Date()).getTime(), this.__workerId, "=skip")
        await Util.pause(500, true)
        this.loopMain();
    }

    isStart = async () => {
        return await this.__isTaskActive()
    }
}