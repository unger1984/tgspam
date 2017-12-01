'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'

import Log from '../models/Log'

const router = new Router({prefix: "/logs"});

router.use(body());
router.get("/",async ctx => {
    let list = await Log.find({});
    ctx.body = {status: true, list: list}
})

router.get("/:timestamp",async ctx => {
    let list = await Log.find({'created': {$gt: ((new Date()).setTime(ctx.params.timestamp))}});
    ctx.body = {status: true, list: list}
})

router.delete("/",async ctx => {
    await Log.remove({})
    ctx.body = {status: true}
})

export default router