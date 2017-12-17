'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import mongoose from 'mongoose'
import {emptyDirSync, removeSync} from 'fs-extra';

import TargetChat from '../models/TargetChat'
import Phone from '../models/Phone'
import Telegram from '../telegram'
import Task from "../models/Task";

const router = new Router({prefix: "/phones"});

router.use(body());
router.post("/activate", async ctx => {
    if (ctx.request.body.id) {
        const phone = await Phone.findOne({_id: mongoose.Types.ObjectId(ctx.request.body.id)})
        if(!phone){
            ctx.body = {status: false, error: "not found"}
            return
        }
        phone.active = true;
        await phone.save();
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false, error: "not found id"}
})

router.get("/list",async ctx => {
    let list = await Phone.find({});
    ctx.body = {status: true, list: list}
})

// Delete phones by id
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
        let phones = await Phone.find({'_id': {$in: ids}})
        for(let i=0; i<phones.length; i++) {
            await TargetChat.update({"appoinet":phones[i].number},{"$set":{"active": true, "appoinet":0, "sent": 0, "issent": false, "last": undefined}},{multi: true})
            removeSync(__dirname + "/../auth/" + phones[i].number + ".auth");
            task.sent = task.sent - phones[i].sent
        }
        await task.save();
        await Phone.remove({'_id': {$in: ids}})
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

// Truncate phones by id
router.put("/clear",async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length>0) {
        let task = await Task.findOne({});
        if (!task) {
            ctx.body = {status: false}
            return
        }
        let list = ctx.request.body.list;
        let ids = []
        for(let i=0; i<list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))
        let phones = await Phone.find({'_id': {$in: ids}})

        for (let i = 0; i < phones.length; i++) {
            await TargetChat.update({"appoinet": phones[i].number}, {
                "$set": {
                    "active": true,
                    "appoinet": 0,
                    "sent": 0,
                    "issent": false,
                    "last": undefined
                }
            }, {multi: true})
            task.sent = task.sent - phones[i].sent
            phones[i].joinedchat = []
            phones[i].sent = 0
            phones[i].active = true
            await phones[i].save();
        }
        await task.save();

        ctx.body = {status: true}
        return;
    }
    ctx.body = {status: false}
})

export default router