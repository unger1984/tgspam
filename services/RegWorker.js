'use strict'

import Util from "../utils";
import Task from "../models/Task";
import SMSka from "../sms/smska";
import config from "../config";
import FakeSMS from "../fake/fakesms";
import log from "../utils/mongo-logger";
import SIMOnline from "../sms/onlinesim";
import Telegram from "../telegram";
import SMSReg from "../sms/sms-reg";
import {generateFirstName, generateLastName} from "../utils/profile-util";
import FakeTelegram from "../fake/telegram";
import SMSActivate from "../sms/sms-activate";
import SIMSms from "../sms/simsms";
import Phone from "../models/Phone";
import Reg from "../models/Reg";
import SIM5 from "../sms/5sim";
import fs from "fs-extra";
import redis from "redis";

const debug = require('debug')('tgspam:debug:regworker')

export default class RegWorker {

    static lockFilePath = './lock'

    __isRuning = true
    __isBusy = false
    __timecounter = 0
    __isDone = false;
    __hangingTimeout = 5 * 60   // timeout in sec
    __workerId = null
    __TelegramClient = null;

    constructor() {
        this.__workerId = Util.randomInteger(100, 999)

        const subscriber = redis.createClient()
        subscriber.on("message", async (channel, message) => {
            debug("message", channel, message)
            switch (channel) {
                case "tgspam:reg:stop":
                    this.__isRuning = false
                    break;
                case "tgspam:reg:start":
                    this.__isRuning = true
                    if (this.__isBusy) return;
                    this.__isBusy = true;
                    let reg = await Reg.findOneAndUpdate({"lock": false}, {$set: {"lock": true}}, {new: false})
                    while (reg) {
                        let res = false;
                        if (this.__isRuning) {
                            res = await this.run(reg)
                        }
                        if (!res) {
                            reg.lock = false
                            await Reg.findOneAndRemove({_id: reg._id});
                            if (!this.__isRuning) return;
                        }else{
                            await reg.remove();
                        }
                        reg = await Reg.findOneAndUpdate({"lock": false}, {$set: {"lock": true}}, {new: false})
                    }
                    this.__isBusy = false;
                    break;
                case "tgspam:reg:reg":
                    if (this.__isRuning) {
                        this.__isRuning = true
                        const reg = await Reg.findOneAndUpdate({"lock": false}, {$set: {"lock": true}}, {new: false})
                        if (reg) {
                            this.run(reg)
                        }
                    }
                    break;
            }
        })

        subscriber.subscribe("tgspam:reg:stop")
        subscriber.subscribe("tgspam:reg:start")
        subscriber.subscribe("tgspam:reg:reg")
    }

    __hangingTimer = async () => {
        if (this.__isDone) return;
        // debug("%d %d %s %d",(new Date()).getTime(), this.__workerId, "hangin tick",this.__timecounter)
        if (this.__timecounter >= this.__hangingTimeout) {
            // kill worker, it was hanging
            log("error", "telegram hanging " + this.__timecounter + "sec, try kill it...")
            fs.removeSync(RegWorker.lockFilePath + "/regloop.lock")
            log("telegram killed")
            process.exit(1)
        }
        this.__timecounter++;
        setTimeout(this.__hangingTimer, 1001)
    }

    __getTask = async () => {
        let task = await Task.findOne({});
        if (!task) {
            task = new Task({smservice: 'simsms', country: 'ru', count: 10, max: 10, active: false})
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

    run = async (reg) => {
        this.__timecounter = 0
        this.__hangingTimer()
        const task = await this.__getTask();
        this.__isDone = false;
        let res = null
        if (task.count > (await Phone.count({})) && this.__isRuning) {
            res = await this.__worker(task.smservice, task.country, task.max)
        }
        this.__isDone = true;
        return res;
    }

    __worker = async (smservice, country, max) => {
        if (!this.__isRuning) return false

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
                case 'smska':
                    smsService = new SMSka(isDebug)
                    break;
                case 'sms-reg':
                    smsService = new SMSReg(isDebug);
                    break;
                case 'onlinesms':
                    smsService = new SIMOnline(isDebug);
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
            return false;
        }
        if (parseInt(balance) < 10) {
            log("error", "Balance < 10");
            await this.pause(10)    // TODO configure delay
            return false;
        }
        if (!this.__isRuning) return false;

        // Get Phone number
        let state = await smsService.getNumber(country);
        if (!state) {
            log("error", smsService.state.error)
            await this.pause(10) // TODO configure delay
            return false;
        }
        if (!this.__isRuning) return false;

        // Telegram
        try {
            // Try connect
            log("connect telegram")
            if (config.fake) this.__TelegramClient = new FakeTelegram('./auth/' + state.phone + '.auth');
            else this.__TelegramClient = new Telegram('./auth/' + state.phone + '.auth');

            // Try send code
            log("send code for " + state.phone)
            let {phone_registered, phone_code_hash} = await this.__TelegramClient.sendCode(state.phone)
            if (!phone_code_hash) {
                log("error", "no answer")
                smsService.ban()
                await this.__TelegramClient.remove()
                await this.pause(10)
                return false;
            }
            if (!this.__isRuning) {
                log("break")
                await this.__TelegramClient.remove()
                return false;
            }

            // Wait sms code
            log("WAIT_CODE", state.phone)
            let sms = "WAIT_CODE"
            while (sms === "WAIT_CODE") {
                await this.pause(20)    // TODO configure delay
                sms = await smsService.waitSMS();

                if (!await this.__isTaskActive()) {
                    log("break")
                    await this.__TelegramClient.remove()
                    return false;
                }
            }
            if (!sms) {
                log("error", state.phone, smsService.state.error)
                smsService.ban()
                await this.__TelegramClient.remove()
                await this.pause(10) // TODO configure delay
                return false;
            }

            // Try register in Telegram
            let auth = false
            if (phone_registered) {
                log("sigIn", state.phone, sms)
                auth = await this.__TelegramClient.signIn(state.phone, phone_code_hash, sms)
            } else {
                let first_name = generateFirstName()
                let last_name = generateLastName()
                log("sigUp", state.phone, sms, first_name, last_name)
                auth = await this.__TelegramClient.signUp(state.phone, phone_code_hash, sms, first_name, last_name)
            }
            if (!auth) {
                smsService.ban()
                await this.__TelegramClient.remove()
                await this.pause(10)    // TODO configure delay
                return false;
            }
            let phone = new Phone({
                number: state.phone,
                user_id: auth.user.id,
                max: max
            })
            await phone.save();
            smsService.done();
            await this.__TelegramClient.done();
            log("REG OK", phone.number)
            await this.pause(5)     // TODO configure delay
            return true;
        } catch (e) {
            log("error", state.phone, e)
            if (e.message === "PHONE_NUMBER_BANNED")
                smsService.ban();
            if (this.__TelegramClient !== null)
                await this.__TelegramClient.remove()
            await this.pause(10)    // TODO configure delay
            return false;
        }
    }
}