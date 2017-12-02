'use strict'

import Router from 'koa-router'
import body from 'koa-json-body'
import fetch from 'node-fetch'
import {outputFileSync} from 'fs-extra'
import {execSync} from 'child_process'

const router = new Router({prefix: "/settings"});

router.use(body());
router.get("/proxy",async ctx => {
    try{
        let res = await fetch("http://"+ctx.hostname+"/ip.php",{method:"GET",timeout: 5001})
        let ip = await res.text();
        ctx.body = {status: true, ip: ip}
    }catch(e){
        ctx.body = {status: false, error: e.message}
    }
})

router.put("/proxy",async ctx => {
    let proxy = ctx.request.body;
    let config = "base {\n\tlog_debug = on;\n\tlog_info = on;\n\tlog = \"file:/var/log/redsocks.log\";\n\tdaemon = on;\n\tuser = redsocks;\n\tgroup = redsocks;\n\tredirector = iptables;\n}\n\n"
    config += "redsocks {\n\tlocal_ip = 127.0.0.1;\n\tlocal_port = 12345;\n\n\ttype = socks5;\n\t"
    config += "ip = "+proxy.ip+";\n\t"
    config += "port = "+proxy.port+";\n\t"
    if(proxy.login.length>0) config += "login = \""+proxy.login+"\";\n\t"
    if(proxy.password.length>0) config += "password = \""+proxy.password+"\";\n\t"
    config += "disclose_src = false;\n"
    config += "}\n";
    outputFileSync('/etc/redsocks.conf',config)
    execSync('service redsocks restart')
    ctx.body = {status: true, config: config}
})

export default router