'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import mongoose from 'mongoose'

import Chat from '../models/Chat'
import Telegram from '../telegram'
import Task from "../models/Task";
import Phone from "../models/Phone";

const router = new Router({prefix: "/chats"});

router.use(body());

/**
 * Load new chats
 */
router.post("/list", async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length>0) {
        let list = ctx.request.body.list;
        list.map(link => {
            if(link.trim().length>0) {
                let l = Telegram.parseLink(link.trim());
                let chat = new Chat({link: l.link, type: l.type})
                chat.save();
            }
        })
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

/**
 * Get list of chats
 */
router.get("/list",async ctx => {
    let list = await Chat.find({});
    ctx.body = {status: true, list: list}
})

/**
 * Remove chats by ids
 */
router.put("/",async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length>0) {
        let task = await Task.findOne({});
        if(!task){
            ctx.body = {status: false}
            return
        }
        let list = ctx.request.body.list;
        let ids = []
        for(let i=0; i<list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))
        let chats = await Chat.find({'_id': {$in: ids}})
        for(let i=0; i<chats.length; i++) {
            if(chats[i].number>0) {
                let phone = await Phone.findOne({"number": chats[i].number})
                if(phone){
                    phone.joined--
                    if(chats[i].issent) {
                        phone.sent--
                        await task.save()
                    }
                    await phone.save();
                }
            }
        }
        await Chat.remove({'_id': {$in: ids}})
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

/**
 * Remove all chats
 */
router.delete("/list",async ctx => {
    let task = await Task.findOne({});
    if(!task){
        ctx.body = {status: false}
        return
    }

    let chats = await Chat.remove({})
    for(let i=0; i<chats.length; i++) {
        if(chats[i].number>0) {
            let phone = await Phone.findOne({"number": chats[i].number})
            if(phone){
                phone.joined--;
                if(chats[i].issent) {
                    phone.sent--
                    await task.save()
                }
                await phone.save();
            }
        }
    }
    await Chat.remove({})
    ctx.body = {status: true}
})

export default router