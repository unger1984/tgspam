'use strict'

import util from 'util'

import Log from '../models/Log'
import config from '../config'

// TODO it's very bad experience :(
function l(obj) {
    switch (Object.prototype.toString.call(obj)){
        case '[object String]':
        case '[object Number]':
            return obj
        case '[object Function]':
        case '[object Object]':
        default:
            return JSON.stringify(obj, null, "\t")
    }
}

async function log() {
    let res = "";
    for (let i = 0; i < arguments.length; i++) {
        if (res !== "")
            res += ", "
        res += l(arguments[i]);
    }
    if(config.log.console)
        console.log(res)

    if(config.log.mongo) {
        let m = new Log({message: res})
        await m.save();
    }
}

export default log