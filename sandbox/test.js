'use strict'

// import Phone from '../models/Phone'
// import Task from "../models/Task";

// import SMSOnline from '../sms/onlinesim'
// import SMSReg from '../sms/sms-reg'
// import SMSka from '../sms/smska'

import {generateFullName} from '../utils/profile-util'

const test = async () => {

    // const smsservice = new SMSReg(true);
    //
    // let balance = await smsservice.getBalance();
    // console.log("BALANCE",balance);
    // let status = await smsservice.getNumber("all");
    // if(!status) console.log(smsservice.state)
    // else console.log(status)
    console.log(generateFullName())
}

export default test