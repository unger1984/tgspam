'use strict'

import Router from 'koa-router'

import ChatRouter from './ChatRouter'
import PhoneRouter from './PhoneRouter'
import TaskRouter from './TaskRouter'
import LogRouter from './LogRouter'

const router = new Router({prefix: "/api"});

router.use(ChatRouter.routes())
    .use(ChatRouter.allowedMethods())
    .use(PhoneRouter.routes())
    .use(PhoneRouter.allowedMethods())
    .use(TaskRouter.routes())
    .use(TaskRouter.allowedMethods())
    .use(LogRouter.routes())
    .use(LogRouter.allowedMethods())

// router.get('/api', ctx => {
//     ctx.body = JSON.stringify({test: true});
// })

export default router