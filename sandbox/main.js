'use strict'

import Util from "../utils";
import fs from "fs-extra";
import lockFile from "lockfile";
import Task from "../models/Task";

// require('../init')

let instance = null

class TestService {

    static lockFilePath = './lock'

    __workerId = null

    constructor() {
        if (!instance) {
            instance = this;
            instance.__workerId = Util.randomInteger(100, 300)

            const init = () => {
                debug("clean locks...")
                fs.ensureDirSync(MainService.lockFilePath)
                fs.removeSync(MainService.lockFilePath + "/regloop.lock")
                fs.removeSync(MainService.lockFilePath + "/joinloop.lock")
                fs.removeSync(MainService.lockFilePath + "/spamloop.lock")

                debug("init done")
            }
            init();
            setTimeout(instance.loopMain, 5001); // wait other workers
        }
        return instance;
    }

    static getInstance() {
        return new MainService();
    }

    // TODO hack
    pause = async (sec) => {
        for (let i = 0; i < sec; i++) {
            if (!this.__isTaskActive()) return;
            await Util.pause(1)
        }
    }

    __lockFile = (type, block) => new Promise(resolve => {
        if (block) {
            try {
                lockFile.lockSync(MainService.lockFilePath + "/" + type + ".lock", {retries: 0})
                resolve(true)
            } catch (e) {
                debug("%s %o", "lock err", e)
                resolve(false)
            }

        } else {
            try {
                lockFile.unlockSync(MainService.lockFilePath + "/" + type + ".lock")
                resolve(true)
            } catch (e) {
                debug("%s %o", "ulock err", e)
                resolve(false)
            }
        }
    })

    ___isLockFile = (type) => new Promise(resolve => {
        resolve(lockFile.checkSync(MainService.lockFilePath + "/" + type + ".lock"))
    })

    __getTask = async () => {
        let task = await Task.findOne({});
        if (!task) {
            task = new Task({smservice: 'simsms', country: 'ru', count: 10, capacity: 10, active: false})
        }
        return task
    }

    __isTaskActive = async () => {
        return (await this.__getTask()).active;
    }

    loopReg = async () => {
        if (!await this.__lockFile("regloop", true)) return;
        info("%d %s", (new Date()).getTime(), ">reg")

        await this.pause(Util.randomInteger(1,10))

        info("%d %s", (new Date()).getTime(), "<reg")
        this.__lockFile("regloop", false)
    }

    loopJoin = async () => {
        if (!await this.__lockFile("joinloop", true)) return;
        info("%d %s", (new Date()).getTime(), ">join")

        await this.pause(Util.randomInteger(1,10))

        info("%d %s", (new Date()).getTime(), "<join")
        this.__lockFile("joinloop", false)
    }

    loopSpam = async () => {
        if (!await this.__lockFile("spamloop", true)) return;
        info("%d %s", (new Date()).getTime(), ">spam")

        await this.pause(Util.randomInteger(1,10))

        info("%d %s", (new Date()).getTime(), "<spam")
        this.__lockFile("spamloop", false)
    }

    loopMain = async () => {
        if (await this.__isTaskActive()) {
            info("%d %s %d", (new Date()).getTime(), ">mainloop", this.__workerId)
            if (!await this.___isLockFile("regloop")) await this.loopReg()
            if (!await this.___isLockFile("joinloop")) await this.loopJoin()
            if (!await this.___isLockFile("spamloop")) await this.loopSpam()
            info("%d %s %d", (new Date()).getTime(), "<mainloop", this.__workerId)
        } else
            info("%d %s %d", (new Date()).getTime(), "=skip", this.__workerId)
        await Util.pause(500, true)
        this.loopMain();
    }

}

const main = () => {

    // pm2.launchBus((err,bus)=>{
    //     bus.on('process:msg', (p) => {
    //         console.log(MainService.getInstance().__workerId, p)
    //     })
    // })
    // console.log("workerId",MainService.getInstance().__workerId)
    // let s1 = new MainService();
    // let s2 = MainService.getInstance();
    //
    // s1.test = 0;
    // s2.test = 3;
    //
    TestService.getInstance().test = 4;

    // console.log(s1.test, s2.test, MainService.getInstance().test)
    // console.log("workerId",s1.__workerId, s2.__workerId, MainService.getInstance().__workerId)
}

export default main