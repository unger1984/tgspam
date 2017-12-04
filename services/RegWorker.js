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
import SIM5 from "../sms/5sim";
import fs from "fs-extra";

const debug = require('debug')('tgspam:debug:regworker')

export default class RegWorker {

    static lockFilePath = './lock'

    __timecounter = 0
    __isDone = false;
    __hangingTimeout = 5 * 60   // timeout in sec
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

    run = async (smservice, country, capacity) => {
        this.__timecounter = 0
        this.__hangingTimer()
        const res = await this.__worker(smservice,country,capacity)
        this.__isDone = true;
        return res;
    }

    __worker = async (smservice, country, capacity) => {
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
            if (!await this.__isTaskActive()) {
                log("break")
                await this.__TelegramClient.remove()
                return;
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
                    return;
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
                max: capacity
            })
            await phone.save();
            smsService.done();
            await this.__TelegramClient.done();
            log("REG OK", phone.number)
            await this.pause(5)     // TODO configure delay
            return;
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