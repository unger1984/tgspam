'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import mongoose from 'mongoose'

import TargetChat from '../models/TargetChat'
import Telegram from '../telegram'
import Task from "../models/Task";
import Phone from "../models/Phone";
import PmPhone from "../models/PmPhone";

const router = new Router({prefix: "/chats"});

router.use(body());
router.post("/list", async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length > 0) {
        let list = ctx.request.body.list;
        list.map(link => {
            if (link.trim().length > 0) {
                let l = Telegram.parseLink(link.trim());
                let chat = new TargetChat({link: l.link, type: l.type})
                chat.save();
            }
        })
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

router.get("/list", async ctx => {
    let list = await TargetChat.find({});
    ctx.body = {status: true, list: list}
})

// Delete chats by ids
router.put("/", async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length > 0) {
        let task = await Task.findOne({type: 'chat'});
        if (!task) {
            ctx.body = {status: false}
            return
        }
        let list = ctx.request.body.list;
        let ids = []
        for (let i = 0; i < list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))
        let chats = await TargetChat.find({'_id': {$in: ids}})
        for (let i = 0; i < chats.length; i++) {
            if (chats[i].appoinet > 0) {
                let phone = await Phone.findOne({"number": chats[i].appoinet})
                if (phone) {
                    let joined = []
                    for (let j = 0; j < phone.joinedchat.length; j++) {
                        if (phone.joinedchat[j].link !== chats[i].link) {
                            joined.push(phone.joinedchat[j])
                        }
                    }
                    phone.joinedchat = joined;
                    if (chats[i].issent) {
                        phone.sent--
                        task.sent--
                        await task.save()
                    }
                    await phone.save();
                }
            }
        }
        await TargetChat.remove({'_id': {$in: ids}})
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

// Truncate chats by ids
router.put("/clear", async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length > 0) {
        let taskChat = await Task.findOne({type: 'chat'});
        if (!taskChat) {
            ctx.body = {status: false}
            return
        }
        let taskPM = await Task.findOne({type: 'pm'});
        if (!taskPM) {
            ctx.body = {status: false}
            return
        }

        let list = ctx.request.body.list;
        let ids = []
        for (let i = 0; i < list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))

        let chats = await TargetChat.find({'_id': {$in: ids}})
        for (let i = 0; i < chats.length; i++) {
            if (chats[i].appoinet > 0) {
                let phone = await Phone.findOne({"number": chats[i].appoinet})
                if (phone) {
                    let joined = []
                    for (let j = 0; j < phone.joinedchat.length; j++) {
                        if (phone.joinedchat[j].link !== chats[i].link) {
                            joined.push(phone.joinedchat[j])
                        }
                    }
                    phone.joinedchat = joined;
                    if (chats[i].issent) {
                        if(phone.sent!==0) {
                            phone.sent--
                            if (taskChat.sent !== 0) {
                                taskChat.sent--
                                await taskChat.save()
                            }
                        }
                    }
                    await phone.save();
                }
                phone = await PmPhone.findOne({"number": chats[i].appoinet})
                if (phone) {
                    if(phone.joined!==0) {
                        phone.joined--
                    }
                    if(phone.sent!==0) {
                        phone.sent--
                        if (taskPM.sent !== 0) {
                            taskPM.sent--
                            await taskPM.save()
                        }
                    }
                    await phone.save();
                }
            }
            chats[i].appoinet = 0
            chats[i].sent = 0
            chats[i].issent = false
            chats[i].active = true
            chats[i].last = undefined
            await chats[i].save();
        }
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

export default router