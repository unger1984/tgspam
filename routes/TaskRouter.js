'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'

import Task from '../models/Task'
import Chat from "../models/Chat";

const router = new Router({prefix: "/tasks"});
import log from '../utils/mongo-logger'

router.use(body());

/**
 * Get Task
 */
router.get("/",async ctx => {
    let task = await Task.findOne({});
    if(!task){
        task = new Task({smservice: 'simsms',country: 'ru', count: 10, max: 10, active: false})
    }
    let sent = await Chat.count({$and: [{"number": {$gt: 0}},{"active":true},{"issent":true}]});
    let good = await Chat.count({$and: [{"number": {$gt: 0}},{"active":true}]});
    let joined = await Chat.count({"number": {$gt: 0}});
    let total = await Chat.count({});
    ctx.body = {status: true, task: task, sent: sent, good: good, joined: joined, total: total}
})

/**
 * Execute task
 */
router.post("/start",async ctx => {
    let ntask = ctx.request.body.task;
    if(!ntask){
        ctx.body = {status: false, error: "no body"}
        return;
    }
    let task = await Task.findOne({});
    if(!task){
        task = new Task({smservice: ntask.smservice,country: ntask.country, count: ntask.count, max: ntask.max, message: ntask.message, algoritm: ntask.algoritm})
        await task.save()
    }else{
        task.active = true;
        task.smservice = ntask.smservice
        task.country = ntask.country
        task.count = ntask.count
        task.max = ntask.max
        task.message = ntask.message
        task.algoritm = ntask.algoritm
        await task.save()
        log("Start task")
    }
    ctx.body = {status: true}
})

/**
 * Stop task execute
 */
router.post("/stop",async ctx => {
    let task = await Task.findOne({});
    if(!task){
        ctx.body = {status: false, error: "no tasks"}
        return;
    }
    task.active = false;
    await task.save()
    log("Stop task")
    ctx.body = {status: true}
})

export default router