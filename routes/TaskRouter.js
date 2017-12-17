'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'

import Task from '../models/Task'
import TargetChat from "../models/TargetChat";

const router = new Router({prefix: "/tasks"});
import log from '../utils/mongo-logger'
import TargetUser from "../models/TargetUser";

router.use(body());

router.get("/",async ctx => {
    let task = await Task.findOne({type: 'chat'});
    if(!task){
        task = new Task({smservice: 'simsms',country: 'ru', count: 10, capacity: 10, active: false})
    }
    let good = await TargetChat.count({$and: [{"appoinet": {$gt: 0}},{"active":true}]});
    let total = await TargetChat.count({"appoinet": {$gt: 0}});
    ctx.body = {status: true, task: task, good: good, total: total}
})

router.get("/pm",async ctx => {
    let task = await Task.findOne({type: 'pm'});
    if(!task){
        task = new Task({smservice: 'simsms',country: 'ru', type: 'pm', count: 10, capacity: 10, active: false})
    }
    let chats = await TargetChat.count({"active":true});
    let users = await TargetUser.count({});
    ctx.body = {status: true, task: task, chats: chats, users: users}
})

router.post("/start",async ctx => {
    let ntask = ctx.request.body.task;
    if(!ntask){
        ctx.body = {status: false, error: "no body"}
        return;
    }
    let task = await Task.findOne({type: 'chat'});
    if(!task){
        task = new Task({smservice: ntask.smservice,country: ntask.country, count: ntask.count, capacity: ntask.capacity, message: ntask.message, active: true})
        await task.save()
        log("Start task")
    }else{
        task.active = true;
        task.smservice = ntask.smservice
        task.country = ntask.country
        task.count = ntask.count
        task.capacity = ntask.capacity
        task.message = ntask.message
        await task.save()
        log("Start task")
    }
    ctx.body = {status: true}
})

router.post("/stop",async ctx => {
    let task = await Task.findOne({type: 'chat'});
    if(!task){
        ctx.body = {status: false, error: "no tasks"}
        return;
    }
    task.active = false;
    await task.save()
    log("Stop task")
    ctx.body = {status: true}
})

router.post("/pmstart",async ctx => {
    let ntask = ctx.request.body.task;
    if(!ntask){
        ctx.body = {status: false, error: "no body"}
        return;
    }
    let task = await Task.findOne({type: 'pm'});
    if(!task){
        task = new Task({type: 'pm', smservice: ntask.smservice,country: ntask.country, message: ntask.message, active: true})
        await task.save()
        log("Start task")
    }else{
        task.active = true;
        task.smservice = ntask.smservice
        task.country = ntask.country
        task.message = ntask.message
        await task.save()
        log("Start task")
    }
    ctx.body = {status: true}
})

router.post("/pmstop",async ctx => {
    let task = await Task.findOne({type: 'pm'});
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