'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import mongoose from 'mongoose'
import {emptyDirSync, removeSync} from 'fs-extra';

import TargetChat from '../models/TargetChat'
import Phone from '../models/Phone'
import Telegram from '../telegram'

const router = new Router({prefix: "/phones"});

router.use(body());
router.post("/activate", async ctx => {
    if (ctx.request.body.number) {
        const tg = new Telegram(__dirname+"/../auth/"+ctx.request.body.number+".auth")
        try{

        }catch(e){
            ctx.body = {status: false, error: e}
        }
        return
    }
    ctx.body = {status: false}
})

router.get("/list",async ctx => {
    let list = await Phone.find({});
    ctx.body = {status: true, list: list}
})

router.put("/",async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length>0) {
        let list = ctx.request.body.list;
        let ids = []
        for(let i=0; i<list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))
        let phones = await Phone.find({'_id': {$in: ids}})
        for(let i=0; i<phones.length; i++) {
            await TargetChat.update({"appoinet":phones[i].number},{"$set":{"appoinet":0, "sent": 0, "issent": false, "last": undefined}},{multi: true})
            removeSync(__dirname + "/../auth/" + phones[i].number + ".auth");
        }
        await Phone.remove({'_id': {$in: ids}})
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

router.delete("/list",async ctx => {
    let phones = await Phone.find({})
    for(let i=0; i<phones.length; i++) {
        await TargetChat.update({"appoinet":phones[i].number},{"$set":{"appoinet":0, "sent": 0, "issent": false, "last": undefined}},{multi: true})
    }
    await Phone.remove({})
    emptyDirSync(__dirname+"/../auth")
    ctx.body = {status: true}
})

export default router