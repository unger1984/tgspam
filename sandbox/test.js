'use strict'

// import Phone from '../models/Phone'
// import Task from "../models/Task";

import SMSReg from '../sms/sms-reg'
import SMSka from '../sms/smska'

const test = async () => {

    const smsservice = new SMSReg(true);

    let balance = await smsservice.getBalance();
    console.log("BALANCE",balance);
    let status = await smsservice.getNumber("all");
    if(!status) console.log(smsservice.state)
    else console.log(status)
}

export default test