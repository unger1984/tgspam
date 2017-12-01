'use strict'

import Task from '../models/Task'
import Phone from "../models/Phone";
import TargetChat from "../models/TargetChat";
import Telegram from '../telegram'
import SIM5 from '../sms/5sim'
import SIMSms from '../sms/simsms'
import SMSActivate from '../sms/sms-activate'
import log from '../utils/mongo-logger'
import {generateFirstName, generateLastName} from '../utils/profile-util'
import mongoose from "mongoose";


/**
 * Singleton implementation
 *
 * @type {{getInstance}}
 */
const TaskService = (() => {
    let __instance,
        __task = null,
        __count = 0,
        __isLoop = false,
        __isRegLoop = false,
        __idleRegInterval = null,
        __idleInterval = null

    const getTask = () => {
        return __task;
    }

    const joinChat = async (phone, telegram) => {
        if (!__isLoop) {
            __isLoop = true
            let cnt = phone.max - phone.joinedchat.length;

            if (cnt <= 0) {
                // all joined
                __isLoop = false
                return true;
            }

            let tg = null;
            if (telegram)
                tg = telegram
            else
                tg = new Telegram(__dirname + '/../auth/' + phone.number + '.auth');

            if (cnt > 5)
                cnt = 5
            for (let i = 0; i < cnt; i++) {
                let targetchat = await TargetChat.findOne({$and: [{"appoinet": 0}, {"active": true}]});
                if (targetchat) {
                    await Telegram.pause(3)
                    let chat = false;
                    log("join ", phone.number, targetchat.link)
                    try {
                        chat = await tg.joinChat(targetchat)
                        if (chat) {
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
                        }

                    } catch (e) {
                        log("error join", e)
                        if (e.message === "INVITE_HASH_EXPIRED" ||
                            e.message === "USERNAME_NOT_OCCUPIED" ||
                            e.message === "NO_CHANNEL") {
                            targetchat.active = false;
                            targetchat.error = e.message;
                            await targetchat.save()
                            if (!telegram)
                                tg.done()
                            __isLoop = false
                            return false;
                        } else {
                            phone.active = false;
                            phone.error = e.message;
                            phone.save();
                            if (!telegram)
                                tg.done()
                            __isLoop = false
                            return false;
                        }
                    }
                } else {
                    log("NO_CHATS!")
                    if (!telegram)
                        tg.done()
                    __isLoop = false
                    return false;
                }
            }
            __isLoop = false
            return true;
        }
    }

    const waitSMS = async (smsservice, delay) => {
        const del = parseInt(delay) || 20
        while (1) {
            if(!__task.active) return false;
            await Telegram.pause(del);
            if(!__task.active) return false;
            let sms = await smsservice.waitSMS()
            if(!sms){
                log("error",smsservice.state.error)
                return false
            }else if(sms === "WAIT_CODE"){
                log(sms)
            }else{
                return sms
            }
        }
    }

    const regNumber = async () => {
        let smservice = null;
        const isDebug = false;
        switch (__task.smservice) {
            case 'sim5':
                smservice = new SIM5(isDebug)
                break;
            case 'sms-activate':
                smservice = new SMSActivate(isDebug)
                break;
            case 'simsms':
            default:
                smservice = new SIMSms(isDebug)
                break;
        }
        let balance = false;
        try {
            balance = await smservice.getBalance();
        } catch (e) {
            log("error", e)
        }
        if (!balance) {
            log("error", smservice.state.error)
            await Telegram.pause(10)
            return false;
        }
        if (parseInt(balance) < 10) {
            log("error", "Balance < 10");
            await Telegram.pause(10)
            return false;
        }
        if (!__task.active) return false;
        let state = await smservice.getNumber(__task.country);
        if (!state) {
            log("error", smservice.state.error)
            await Telegram.pause(10)
            return false;
        }
        if (!__task.active) return false;
        const tg = new Telegram(__dirname + '/../auth/' + state.phone + '.auth');
        let phone_data = false
        try {
            log("send code for " + state.phone)
            phone_data = await tg.sendCode(state.phone)
        } catch (e) {
            log("error", e)
            await tg.remove()
            await Telegram.pause(10)
            return false;
        }
        if (!phone_data) {
            smservice.ban()
            await tg.remove()
            await Telegram.pause(10)
            return false;
        }
        if (!__task.active) {
            await tg.remove()
            return false;
        }
        let sms = false
        log("WAIT_CODE")
        try {
            sms = await waitSMS(smservice)
        } catch (e) {
            log("error", e)
        }
        if (!sms) {
            log("error", smservice.state.error)
            smservice.ban()
            await tg.remove()
            await Telegram.pause(10)
            return false;
        }
        if (!__task.active) {
            await tg.remove()
            await Telegram.pause(10)
            return false;
        }
        let auth = false
        try {
            if (phone_data.phone_registered) {
                log("sigIn", state.phone, sms)
                auth = await tg.signIn(state.phone, phone_data.phone_code_hash, sms)
            } else {
                let first_name = generateFirstName()
                let last_name = generateLastName()
                log("sigUp", state.phone, sms, first_name, last_name)
                auth = await tg.signUp(state.phone, phone_data.phone_code_hash, sms, first_name, last_name)
            }
        } catch (e) {
            smservice.ban()
            await tg.remove()
            await Telegram.pause(10)
            return false;
        }
        if (!auth) {
            smservice.ban()
            await tg.remove()
            await Telegram.pause(10)
            return false;
        }
        if (!__task.active) {
            await tg.remove()
            await Telegram.pause(10)
            return false;
        }
        let phone = new Phone({
            number: state.phone,
            user_id: auth.user.id,
            max: __task.capacity
        })
        await phone.save();
        smservice.done();
        await tg.done();
        await Telegram.pause(5)
        return true;
    }

    const spamloop = async () => {
        if (__isLoop) return;

        __isLoop = true;
        __count = (await TargetChat.count({
            $and: [
                {"appoinet": {$gt: 0}},
                {"issent": false},
                {"active": true}
            ]
        }));
        console.log("SENTED", __count)
        if (__count > 0 && __task.active) {
            let targetchat = await TargetChat.findOne({
                $and: [
                    {"appoinet": {$gt: 0}},
                    {"issent": false},
                    {"active": true}
                ]
            })
            if(targetchat) {
                let phone = await Phone.findOne({"number": targetchat.appoinet})
                if (phone) {
                    log("sent ", phone.number, targetchat.link)
                    const tg = new Telegram(__dirname + '/../auth/' + phone.number + '.auth');
                    try {
                        if (targetchat.channel_id)
                            await tg.messageToChat(__task.message, targetchat.channel_id, targetchat.access_hash)
                        else if (targetchat.chat_id)
                            await tg.messageToChat(__task.message, targetchat.chat_id);
                    } catch (e) {
                        log("sent error", e)
                        targetchat.active = false
                        targetchat.error = e.message
                        await targetchat.save();
                        __isLoop = false;
                        return;
                    }
                    targetchat.issent = true;
                    targetchat.sent++;
                    targetchat.last = new Date();
                    await targetchat.save();
                    phone.seen = new Date();
                    phone.sent++;
                    await phone.save();
                    __task.sent++;
                    await __task.save();
                    log("OK");
                    __isLoop = false
                }
            }
        } else {
            clearInterval(__idleInterval)
            __isLoop = false
            __task.active = false;
            await __task.save();
        }
    }

    const joinloop = async () => {
        if ((await Phone.count({
                $and: [
                    {$where: "this.joinedchat.length < this.max"},
                    {"active": true},
                ]
            })) > 0 &&
            (await TargetChat.count({appoinet: 0})) > 0 &&
            __task.active) {
            // worked
            let phone = await Phone.findOne({
                $and: [
                    {$where: "this.joinedchat.length < this.max"},
                    {"active": true},
                    {
                        $or: [
                            {'seen': {$lte: new Date((new Date()).getTime() - 5 * 60 * 1000)}},
                            {'seen': {$exists: false}}
                        ]
                    }
                ]
            })
            if (phone) {
                joinChat(phone)
                    .then(r => {
                    })
            }
        } else if (__count >= __task.count && __task.active) {
            if (__idleInterval !== null) {
                clearInterval(__idleInterval);
                __isLoop = false
            }
            if (__idleRegInterval !== null) {
                clearInterval(__idleRegInterval);
                __isRegLoop = false
            }
            log("WELL DONE!")
            __task.active = false;
            __task.save()
        } else {
            // if (!__isRegLoop)
            //     regloop()
        }
        return true;
    }

    const regloop = async () => {
        if(__isRegLoop) return false;

        __isRegLoop = true
        __count = await Phone.count({});
        if(__count < __task.count && __task.active) {
            let s = await regNumber();
            if (s) {
                __count++;
            }
        }
        __isRegLoop = false
        return true;
    }

    const start = async (task) => {
        if (__task === null || !__task.active) {
            __task = task;
            __task.active = true;
            __task.save();
            __count = await Phone.count({});
            // console.log("COUNT",__count,__task.count)
            await log("Task start")
            __idleInterval = setInterval(joinloop, 5001)
            __idleRegInterval = setInterval(regloop, 5501)
        } else {
            await log("Task already started!")
        }
    }

    const spam = async (task) => {
        if (__task === null || !__task.active) {
            __task = task;
            __task.active = true;
            __task.save();
            __count = (await TargetChat.count({
                $and: [
                    {"appoinet": {$gt: 0}},
                    {"issent": false},
                    {"active": true}
                ]
            }));
            await log("Task smap start")
            __idleInterval = setInterval(spamloop, 1001)
        } else {
            await log("Task already started!")
        }
    }

    const stop = async () => {
        if (__task === null) {
            __task = await Task.findOne({})
        }
        if (__task.active) {
            await log("Task stop")
            __task.active = false;
            await __task.save();
            if (__idleInterval !== null) {
                clearInterval(__idleInterval);
                __isLoop = false
            }
            if (__idleRegInterval !== null) {
                clearInterval(__idleRegInterval);
                __isRegLoop = false
            }
        } else {
            await log("Task already stop!")
        }
    }

    const __createInstance = () => {
        return {
            getTask: getTask,
            start: start,
            spam: spam,
            stop: stop,
        }
    }

    return {
        getInstance: () => {
            return __instance || (__instance = __createInstance());
        }
    }
})();

export default TaskService