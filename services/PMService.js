'use strict'

import config from "../config";

const info = require('debug')('tgspam:info:pmmainservice')
const debug = require('debug')('tgspam:debug:pmmainservice')

import lockFile from 'lockfile'
import fs from 'fs-extra'

import Task from '../models/Task'
import PmPhone from '../models/PmPhone'

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
import TargetUser from "../models/TargetUser";

import Settings from "../models/Settings";
import PmRegWorker from "./PmRegWorker";
import PmJoinWorker from "./PmJoinWorker";
import PmSpamWorker from "./PmSpamWorker";

let instance = null

export default class PMService {

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
                fs.ensureDirSync(PMService.lockFilePath)
                fs.removeSync(PMService.lockFilePath + "/pmregloop.lock")
                fs.removeSync(PMService.lockFilePath + "/pmjoinloop.lock")
                fs.removeSync(PMService.lockFilePath + "/pmspamloop.lock")

                let settings = await Settings.findOne({});
                if (!settings) {
                    settings = new Settings({app_id: '', app_hash: ''})
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
        return new PMService();
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
                lockFile.lockSync(PMService.lockFilePath + "/" + type + ".lock", {retries: 0})
                resolve(true)
            } catch (e) {
                debug("%d %d %s %o", (new Date()).getTime(), this.__workerId, "lock err", e)
                resolve(false)
            }

        } else {
            try {
                lockFile.unlockSync(PMService.lockFilePath + "/" + type + ".lock")
                resolve(true)
            } catch (e) {
                debug("%d %d %s %o", (new Date()).getTime(), this.__workerId, "ulock err", e)
                resolve(false)
            }
        }
    })

    ___isLockFile = (type) => new Promise(resolve => {
        resolve(lockFile.checkSync(PMService.lockFilePath + "/" + type + ".lock"))
    })

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

    loopReg = async () => {
        if (!await this.__lockFile("pmregloop", true)) return;
        info("%d %d %s", (new Date()).getTime(), this.__workerId, ">reg")

        const task = await this.__getTask();
        if (((await TargetChat.count({$and: [{"active": true}, {"appoinet": 0}]})) > 0 ||
                (await TargetUser.count({$and: [{"active": true}, {"appoinet": 0}]})) > 0)
                && (await PmPhone.count({active: true})) <= 0) {
            // когда есть незаджойвленные чаты и нет активных номеров
            const worker = new PmRegWorker(this.Telegram_auth)
            await worker.run(task.smservice, task.country)
        } else {
            info("%d %d %s", (new Date()).getTime(), this.__workerId, "=reg-skip")
        }
        info("%d %d %s", (new Date()).getTime(), this.__workerId, "<reg")
        this.__lockFile("pmregloop", false)
    }

    loopJoin = async () => {
        if (!await this.__lockFile("pmjoinloop", true)) return;
        info("%d %d %s", (new Date()).getTime(), this.__workerId, ">join")

        if ((await TargetChat.count({$and: [{"active": true}, {"appoinet": 0}]})) > 0) {
            const phone = await PmPhone.findOne({
                $and: [
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
                const worker = new PmJoinWorker(this.Telegram_auth);
                await worker.run(phone);
            } else {
                info("%d %d %s", (new Date()).getTime(), this.__workerId, "=join-skip")
            }
        } else {
            info("%d %d %s", (new Date()).getTime(), this.__workerId, "=join-skip")
        }

        info("%d %d %s", (new Date()).getTime(), this.__workerId, "<join")
        this.__lockFile("pmjoinloop", false)
    }

    loopSpam = async () => {
        if (!await this.__lockFile("pmspamloop", true)) return;
        info("%d %d %s", (new Date()).getTime(), this.__workerId, ">spam")

        if ((await TargetChat.count({$and: [{"active": true}, {"appoinet": 0}]})) <= 0 &&
            (await TargetUser.count({$and: [{"active": true}, {"issent": false}]})) > 0) {

            const phone = await PmPhone.findOne({})
                .where('active').equals(true)
                .limit(1)
                .exec()
            if (phone) {
                const worker = new PmSpamWorker(this.Telegram_auth)
                await worker.run(phone);
            } else {
                info("%d %d %s", (new Date()).getTime(), this.__workerId, "=spam-skip")
            }
        } else {
            info("%d %d %s", (new Date()).getTime(), this.__workerId, "=spam-skip")
        }
        info("%d %d %s", (new Date()).getTime(), this.__workerId, "<spam")
        this.__lockFile("pmspamloop", false)
    }

    loopMain = async () => {
        if (await this.__isTaskActive()) {
            info("%d %d %s", (new Date()).getTime(), this.__workerId, ">mainloop")
            if (!await this.___isLockFile("pmregloop")) await this.loopReg()
            if (!await this.___isLockFile("pmjoinloop")) await this.loopJoin()
            if (!await this.___isLockFile("pmspamloop")) await this.loopSpam()
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