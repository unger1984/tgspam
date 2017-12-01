'use strict'

import SIM5 from './sms/5sim'
import SMSActivate from './sms/sms-activate'
import SIMSms from './sms/simsms'

import Telegram from './telegram'

require('./init')

import Phone from './models/Phone'


let test = new Phone({number: "380955131786"})
test.save();
Phone.find({})

const smsService = new SIMSms();

const read = (msg) => {
    return new Promise((resolve, reject) => {
        console.log(msg)
        let input = ''
        process.stdin.resume()
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', data => {
            input += data;

            if (data.indexOf('\n') != -1) {
                input = input.replace('\n', '');
                process.stdin.pause();
                resolve(input);
            }
        });
    });
}

const testReal = async (phone) => {
    try {
        let phone_hash = await tg.sendCode(phone)
        let sms = await read("SMS Code?")
        let auth = null;
        if (await tg.checkPhone(phone)) {
            tg.pause(1)
            auth = await tg.signIn(phone, phone_hash, sms)
        } else {
            tg.pause(1)
            auth = await tg.signUp(phone, phone_hash, sms, "TestName", "TestSecond")
        }
        let user_id = auth.user.id;
        console.log("user", user_id);
        tg.setUserAuth(2, {id: user_id});
        tg.pause(1)
        tg.done()
    } catch (e) {
        console.dir(e);
        tg.done()
    }
}

const testGetNumber = async (country) => {
    let isBalance = await smsService.getBalance()
    if (!isBalance) {
        console.log("error", smsService.state.error);
        process.exit(1);
    }
    console.log("balance", smsService.state.balance)
    if (!await smsService.getNumber(country)) {
        console.log("error", smsService.state.error);
        process.exit(1);
    }
    const tg = new Telegram(__dirname + "/auth/" + smsService.state.phone + ".auth");
    try {
        let {phone_registered, phone_code_hash} = await tg.sendCode(smsService.state.phone);
        console.log("phone_hash", smsService.state.phone, phone_code_hash);
        if (!await smsService.waitSMS()) {
            console.log("error", smsService.state.error);
            smsService.ban();
            await tg.remove();
            process.exit(1);
        }
        let auth = null
        tg.pause(1)
        console.log("go to register " + phone_registered)
        if (phone_registered) {
            auth = await tg.signIn(smsService.state.phone, phone_code_hash, smsService.state.sms)
        } else {
            auth = await tg.signUp(smsService.state.phone, phone_code_hash, smsService.state.sms, "Author", "Autorovich")
        }
        console.log(auth);
        smsService.done()

        let user_id = auth.user.id;
        console.log(user_id)

    } catch (e) {
        console.log(e);
        smsService.ban();
        await tg.remove();
    }
}

const leaveAllChats = async (phone) => {

    let tg = null;
    try {
        tg = new Telegram(__dirname + "/auth/" + phone + ".auth");
    } catch (e) {
    }
    try {
        let {chats} = await tg.api("messages.getDialogs", {limit: 200});
        // console.log(chats)
        for (let i = 0; i < chats.length; i++) {
            console.log("Chat", chats[i])
            await tg.pause(1);
            if (!chats[i].left) {

            }
        }
        await tg.done();
    } catch (e) {
        // tg._client.mtproto.emitter.emit("deactivate")
        if (tg) {
            await tg.done();
        }
        console.error(e)
    }
}



const hash = "http://telegram.me/testaw"
// const hash = "Aqg220hdLUyGM-PpOIBFSg";
// const hash = "Aqg22xLgmEpaue870CUYNA";
// testGetNumber("ua")
// const phone = "380687177499"
const phone = "380955131786"
// const tg = new Telegram(__dirname + "/auth/" + phone + ".auth");
// tg.messageToChat("Мое сообщение",1214065996,"4925609632888323487")
//     .then((chat) => {
//         console.log("done", chat)
//         tg.done()
//     })
//     .catch((e) => {
//         console.log("error", e);
//         tg.done()
//     })

