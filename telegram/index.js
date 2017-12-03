'use strict'

import MTProto from 'telegram-mtproto'
import JsonStorage from './JsonStorage'

const api = {
    layer: 57,
    api_id: 2899,
    app_version: '1.4.1',
    lang_code: 'en'
}

export default class Telegram {

    _client = null;
    _storage = null;

    timeout = 20;
    runtimer = 0
    __timeoutIdle = null;

    __checkTimeout = async () => {
        this.runtimer++;
        if (this.runtimer >= this.timeout) {
            // kill process
            await this.done();
            throw new Error("TELEGRAM_TIMEOUT")
        } else
            this.__timeoutIdle = setTimeout(this.__checkTimeout, 1001)
    }

    __runIt = async () => {
        this.runtimer = 0
        this.__timeoutIdle = setTimeout(this.__checkTimeout, 1001)
    }

    static pause = (sec) => {
        return new Promise(resolve => setTimeout(resolve, parseInt(sec) * 1000 + 1));
    }

    api = async (method, params) => {
        return this._client(method, params)
    }

    constructor(filePath, timeout) {
        this.timeout = timeout || 300
        this._storage = new JsonStorage(filePath);
        this._client = new MTProto({
            api: api,
            server: {dev: false, webogram: false},
            app: {storage: this._storage}
        });
    }

    getConfig = async () => {
        this.__runIt();
        const res = await this.api("help.getConfig");
        if (this.__timeoutIdle !== null)
            this.__timeoutIdle.unref();
        return res
    }

    sendCode = async (number) => {
        const {phone_registered, phone_code_hash} = await this.api("auth.sendCode", {
            phone_number: number,
            current_number: false,
            api_id: api.api_id,
            api_hash: "36722c72256a24c1225de00eb6a1ca74"
        });

        return {phone_registered, phone_code_hash};
    }

    checkPhone = async (number) => {
        const {phone_registered, phone_invited} = await this.api("auth.checkPhone", {
            phone_number: number
        });
        return phone_registered;
    }

    signIn = async (number, hash, sms) => {
        const user = await this.api("auth.signIn", {
            phone_number: number,
            phone_code_hash: hash,
            phone_code: sms
        });
        return user;
    }

    signUp = async (number, hash, sms, first_name, last_name) => {
        const user = await this.api("auth.signUp", {
            phone_number: number,
            phone_code_hash: hash,
            phone_code: sms,
            first_name: first_name,
            last_name: last_name
        });
        return user;
    }

    exportAuthorization = async () => {
        const ex = await this.api("auth.exportAuthorization", {dc_id: 2})
        return ex
    }


    importAuthorization = async (id, auth_key) => {
        const user = await this.api("auth.importAuthorization", {
            id,
            bytes: auth_key
        });
        return user;
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

    joinChat = async (parsed_link) => {
        let invite = null
        switch (parsed_link.type) {
            case "hash":
                invite = await this.api("messages.checkChatInvite", {hash: parsed_link.link})
                await Telegram.pause(1);
                let chat = null;
                if (invite._ === "chatInviteAlready")
                    chat = invite.chat;
                else if (invite._ === "chatInvite") { // need Join
                    chat = await this.api("messages.importChatInvite", {hash: parsed_link.link})
                    chat = chat.chats[0];
                }
                return chat;
            case "channel":
            default:
                invite = await this.api("contacts.resolveUsername", {username: parsed_link.link})
                if (invite && invite.chats && invite.chats.length > 0 && invite.chats[0]._ === "channel") {
                    await Telegram.pause(1);
                    let chat = await this.api("channels.joinChannel",
                        {
                            channel: {
                                _: 'inputPeerChannel',
                                channel_id: invite.chats[0].id,
                                access_hash: invite.chats[0].access_hash
                            }
                        })
                    chat = chat.chats[0];
                    return chat;
                } else {
                    throw new Error("NO_CHANNEL", 400)
                }
                return false;
        }
        return false
    }

    joinChatByLink = async (link) => {
        let parse = Telegram.parseLink(link);
        if (parse) {
            return this.joinChat(parse)
        }
        return false;
    }

    leavChat = async (chat_id, access_hash) => {
        if (access_hash)
            await this.api("channels.leaveChannel",
                {
                    channel: {
                        _: 'inputPeerChannel',
                        channel_id: chat_id,
                        access_hash: access_hash
                    }
                }
            )
        else
            await this.api("messages.deleteChatUser",
                {
                    chat_id: chat_id,
                    user_id: {
                        _: 'inputUserSelf'
                    }
                }
            )
    }

    messageToChat = async (text, chat_id, access_hash) => {
        let message = null
        if (access_hash) {
            message = await this.api("messages.sendMessage",
                {
                    peer: {
                        _: 'inputPeerChannel',
                        channel_id: chat_id,
                        access_hash: access_hash
                    },
                    message: text,
                    random_id: (Math.floor(Math.random() * 100000) + 2)
                })
        } else {
            message = await this.api("messages.sendMessage",
                {
                    peer: {
                        _: 'inputPeerChat',
                        chat_id: chat_id
                    },
                    message: text,
                    random_id: (Math.floor(Math.random() * 100000) + 3)
                })
        }
        return message
    }

    remove = async () => {
        await this.done();
        this._storage.delfile();
        return true;
    }

    done = async () => {
        // Black Magic !!!
        let handlers = process._getActiveHandles();
        for (let i = 0; i < handlers.length; i++) {
            let handle = handlers[i]
            if (Object.prototype.toString.call(handle) === '[object Timer]') {
                if (handle._list.msecs % 10 == 0 && handle._list.msecs != 5000) {
                    handle.unref();
                }
            }
        }
        return true;
    }
}