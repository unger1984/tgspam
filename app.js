'use strict'

import http from 'http'
import Koa from 'koa'
import serve from 'koa-static'
import auth from 'koa-basic-auth'
import Router from 'koa-router'

import config from './config'
import api from './routes'

import MainService from './services/MainService'

require('./init')

const app = new Koa();

const iprouter = new Router({prefix: "/ip"});
iprouter.get("*", async ctx => {
    ctx.body = ctx.request.ip
})
app.use(iprouter.routes())

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        if (401 == err.status) {
            ctx.status = 401;
            ctx.set('WWW-Authenticate', 'Basic');
            ctx.body = 'Access denied';
        } else {
            throw err;
        }
    }
});
app.use(auth({name: config.auth.login, pass: config.auth.password}));
app.use(api.routes())
    .use(api.allowedMethods())
app.use(serve(__dirname + '/public'))

http.createServer(app.callback())
    .listen(config.server.port, (err) => {
        if (err) throw err;
        console.log("Server started");
        setTimeout(() => MainService.getInstance().isStart(), 5001) // start service after 5 sec
    })
    .on('connection', (socket) => {
        socket.setNoDelay(); // Отключаем алгоритм Нагла.
    });