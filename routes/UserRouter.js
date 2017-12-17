'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import mongoose from 'mongoose'

import TargetUser from '../models/TargetUser'
import Task from "../models/Task";
import PmPhone from "../models/PmPhone";

const router = new Router({prefix: "/users"});

router.use(body());

router.get("/list", async ctx => {
    let list = await TargetUser.find({});
    ctx.body = {status: true, list: list}
})

// Delete users by ids
router.put("/", async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length > 0) {
        let task = await Task.findOne({type: 'pm'});
        if (!task) {
            ctx.body = {status: false}
            return
        }
        let list = ctx.request.body.list;
        let ids = []
        for (let i = 0; i < list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))
        let users = await TargetUser.find({'_id': {$in: ids}})
        for (let i = 0; i < users.length; i++) {
            if (users[i].appoinet > 0) {
                let phone = await PmPhone.findOne({"number": users[i].appoinet})
                if (phone) {
                    if (users[i].issent) {
                        if (phone.sent !== 0) {
                            phone.sent--
                            task.sent--
                            await task.save()
                        }
                    } else {
                        if (phone.joined !== 0) phone.joined--
                    }
                    await phone.save();
                }
            }
        }
        await TargetUser.remove({'_id': {$in: ids}})
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

// Truncate users by ids
router.put("/clear", async ctx => {
    if (ctx.request.body.list && ctx.request.body.list.length > 0) {
        let taskPM = await Task.findOne({type: 'pm'});
        if (!taskPM) {
            ctx.body = {status: false}
            return
        }

        let list = ctx.request.body.list;
        let ids = []
        for (let i = 0; i < list.length; i++)
            ids.push(mongoose.Types.ObjectId(list[i]))

        let users = await TargetUser.find({'_id': {$in: ids}})
        for (let i = 0; i < users.length; i++) {
            if (users[i].appoinet > 0) {
                let phone = await PmPhone.findOne({"number": users[i].appoinet})
                if (phone) {
                    if (phone.joined !== 0) {
                        phone.joined--
                    }
                    if (phone.sent !== 0) {
                        phone.sent--
                        if (taskPM.sent !== 0) {
                            taskPM.sent--
                            await taskPM.save()
                        }
                    }
                    await phone.save();
                }
            }
            users[i].appoinet = 0
            users[i].sent = 0
            users[i].issent = false
            users[i].active = true
            users[i].last = undefined
            await users[i].save();
        }
        ctx.body = {status: true}
        return
    }
    ctx.body = {status: false}
})

export default router