'use strict'

import MainService from '../services/MainService'

require('../init')

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
    MainService.getInstance().test = 4;

    // console.log(s1.test, s2.test, MainService.getInstance().test)
    // console.log("workerId",s1.__workerId, s2.__workerId, MainService.getInstance().__workerId)
}

export default main