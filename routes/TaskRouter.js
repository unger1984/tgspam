'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import mongoose from 'mongoose'

import Task from '../models/Task'
import Telegram from '../telegram'
import TaskService from '../services/TaskService'
import TargetChat from "../models/TargetChat";

const router = new Router({prefix: "/tasks"});

router.use(body());

router.get("/",async ctx => {
    let task = await Task.findOne({});
    if(!task){
        task = new Task({smservice: 'simsms',country: 'ru', count: 10, capacity: 10})
    }
    let total = await TargetChat.count({$and: [{"appoinet": {$gt: 0}},{"active": true}]});
    ctx.body = {status: true, task: task, total: total}
})

router.post("/start",async ctx => {
    let ntask = ctx.request.body.task;
    if(!ntask){
        ctx.body = {status: false, error: "no body"}
        return;
    }
    let task = await Task.findOne({});
    if(!task){
        task = new Task({smservice: ntask.smservice,country: ntask.country, count: ntask.count, capacity: ntask.capacity})
        await task.save()
    }else{
        task.smservice = ntask.smservice
        task.country = ntask.country
        task.count = ntask.count
        task.capacity = ntask.capacity
        await task.save()
    }
    await TaskService.getInstance().start(task);
    ctx.body = {status: true, task: TaskService.getInstance().getTask()}
})

router.post("/spam",async ctx => {
    let ntask = ctx.request.body.task;
    if(!ntask || ntask.message.trim().length<=0){
        ctx.body = {status: false, error: "no message"}
        return;
    }
    let task = await Task.findOne({});
    if(!task){
        ctx.body = {status: false, error: "no tasks"}
        return;
    }else{
        task.message = ntask.message.toString()
        await task.save()
    }
    await TaskService.getInstance().spam(task);
    ctx.body = {status: true, task: TaskService.getInstance().getTask()}
})

router.post("/stop",async ctx => {
    let task = await Task.findOne({});
    if(!task){
        ctx.body = {status: false, error: "no tasks"}
        return;
    }
    await TaskService.getInstance().stop();
    ctx.body = {status: true, task: TaskService.getInstance().getTask()}
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