'use strict'

import Router from 'koa-router'

import ChatRouter from './ChatRouter'
import PhoneRouter from './PhoneRouter'
import PmPhoneRouter from './PmPhoneRouter'
import TaskRouter from './TaskRouter'
import LogRouter from './LogRouter'
import SettingsRouter from './SettingsRouter'
import UserRouter from './UserRouter'

const router = new Router({prefix: "/api"});

router.use(ChatRouter.routes())
    .use(ChatRouter.allowedMethods())
    .use(PhoneRouter.routes())
    .use(PhoneRouter.allowedMethods())
    .use(TaskRouter.routes())
    .use(TaskRouter.allowedMethods())
    .use(LogRouter.routes())
    .use(LogRouter.allowedMethods())
    .use(SettingsRouter.routes())
    .use(SettingsRouter.allowedMethods())
    .use(PmPhoneRouter.routes())
    .use(PmPhoneRouter.allowedMethods())
    .use(UserRouter.routes())
    .use(UserRouter.allowedMethods())

// router.get('/api', ctx => {
//     ctx.body = JSON.stringify({test: true});
// })

export default router