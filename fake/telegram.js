'use strict'

export default class FakeTelegram {

    _randomInteger(min, max) {
        var rand = min - 0.5 + Math.random() * (max - min + 1)
        rand = Math.round(rand);
        return rand;
    }

    static pause = (sec) => {
        return new Promise(resolve => setTimeout(resolve, parseInt(sec) * 1000 + 1));
    }

    api = async (method, params) => {
        // return this._client(method, params)
    }

    constructor(filePath) {}

    sendCode = async (number, delay) => {
        const del = parseInt(delay) || 1
        await FakeTelegram.pause(del)
        const res = this._randomInteger(0,1);
        switch (res){
            case 0:
                throw new Error("PHONE_NUMBER_BANED",1)
                break;
            case 1:
                return {
                    phone_registered: (this._randomInteger(0,1)===0?false:true),
                    phone_code_hash: this._randomInteger(500000000,900000000)
                }
                break;
        }
    }

    signIn = async (number, hash, sms,delay) => {
        const del = parseInt(delay) || 1
        await FakeTelegram.pause(del)
        const res = this._randomInteger(0,1);
        switch (res){
            case 0:
                throw new Error("PHONE_NUMBER_BANED",1)
                break;
            case 1:
                return {
                    user: {
                        id: this._randomInteger(500000000,900000000)
                    }
                }
                break;
        }
    }

    signUp = async (number, hash, sms, first_name, last_name,delay) => {
        const del = parseInt(delay) || 1
        await FakeTelegram.pause(del)
        const res = this._randomInteger(0,1);
        switch (res){
            case 0:
                throw new Error("PHONE_NUMBER_BANED",1)
                break;
            case 1:
                return {
                    user: {
                        id: this._randomInteger(500000000,900000000)
                    }
                }
                break;
        }
    }

    static parseLink = (link) => {
        let match = link.match(/^(http|https):\/\/(t|telegram)\.me\/(joinchat\/)?(.*)\/?/i);
        if (match) {
            if (match[3] === "joinchat/") {
                return {type: "hash", link: match[4]}
            } else {
                return {type: "channel", link: match[4]}
            }
        }
    }

    joinChat = async (parsed_link,delay) => {
        const del = parseInt(delay) || 1
        await FakeTelegram.pause(del)
        const res = this._randomInteger(0,4);
        switch (res){
            case 0:
                throw new Error("INVITE_HASH_EXPIRED",1)
                break;
            case 1:
                throw new Error("USERNAME_NOT_OCCUPIED",2)
                break;
            case 2:
                throw new Error("USERNAME_INVALID",3)
                break;
            case 3:
                throw new Error("NO_CHANNEL",4)
                break;
            case 4:
                return {
                    _ : 'channel',
                    channel_id: this._randomInteger(500000000,900000000),
                    access_hash: this._randomInteger(500000000,900000000),
                }
                break;
        }
    }

    messageToChat = async (text, chat_id, access_hash, delay) => {
        const del = parseInt(delay) || 1
        await FakeTelegram.pause(del)
        const res = this._randomInteger(0,3);
        switch (res){
            case 0:
                throw new Error("CHAT_ADMIN_REQUIRED",1)
            case 1:
                throw new Error("USER_BANNED_IN_CHANNEL",2)
            case 2:
                throw new Error("CHAT_WRITE_FORBIDDEN",3)
            case 3:
                return {
                    _ : 'message',
                    id: this._randomInteger(500000000,900000000)
                }
                break;
        }
    }

    remove = async () => {
        await this.done()
    }

    done = async () => {}
}
