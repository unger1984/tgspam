'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import mongoose from 'mongoose'

import TargetChat from '../models/TargetChat'
import Telegram from '../telegram'

const router = new Router({prefix: "/chats"});

router.use(body());
router.post("/list", async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length>0) {
        let list = ctx.request.body.list;
        list.map(link => {
            if(link.trim().length>0) {
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

router.get("/list",async ctx => {
    let list = await TargetChat.find({});
    ctx.body = {status: true, list: list}
})

router.put("/",async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length>0) {
        let list = ctx.request.body.list;
        let ids = []
        for(let i=0; i<list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))
        await TargetChat.remove({'_id': {$in: ids}})
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

router.delete("/list",async ctx => {
    await TargetChat.remove({})
    ctx.body = {status: true}
})

export default router