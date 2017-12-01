'use strict'

import fetch from 'node-fetch'
import moment from 'moment'

import config from '../config'
import log from '../utils/mongo-logger'

export default class SIM5 {

    static URL = "https://5sim.net/v1/";

    isDebug = false;
    state = {
        balance: 0,
        id: null,
        phone: null,
        sms: null,
        status: null,
        released: null,
        error: null
    }

    constructor(isDebug){
        this.isDebug = isDebug || false
    }

    _error(err) {
        switch (err) {
            case "no free phones":
                return "NO_NUMBERS";
                break;
            case "server offline":
                return "SERVER_ERROR";
                break;
            case "not enough product qty":
                return "BAD_SERVICE";
                break;
            case "not enough user balance":
                return "NO_BALANCE";
                break;
            case "not enough rating":
                return "NO_BALANCE";
                break;
            case "order not found":
            case "order expired":
            case "order has sms":
            case "hosting order":
            case "order no sms":
                return "NO_ORDER";
                break;
            default:
                return "UNKNOWN";
        }
    }

    _getCountry(country) {
        switch (country.toLowerCase()) {
            case "ph":
                return "philippines";
                break;
            case "kz":
            case "ua": // hack
                return "kazakhstan";
                break;
            case "ru":
            default:
                return "russia";
                break;
        }
    }

    _timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async _api(method) {
        if(this.isDebug) log("get", method)
        let res = await fetch(
            SIM5.URL + method,
            {
                headers: {
                    'Authorization': 'Bearer ' + config.SMS.SIM5.API_KEY
                }
            });
        if (res.status == 200) {
            res = await res.json();
            if(this.isDebug) log(res)
            return res;
        } else if (res.status == 401) {
            throw new Error("BAD_KEY", res.status);
        } else {
            let text = await res.text();
            this.state.error = this._error(text);
            throw new Error(this._error(text), res.status);
        }
    }

    async _waitNumber(delay) {
        const del = parseInt(delay) || 20
        while (1) {
            await this._timeout(del * 1000+1);
            if (await this.getStatus()) {
                if (this.state.status === "RECEIVED")
                    return true;
                if (this.state.status !== "PENDING") {
                    this.state.error = "WRONG_STATUS";
                    return false
                }
                if(moment().diff(this.state.released)/1000>120) {
                    this.state.error = "TIME_EXPIRED";
                    return false
                }
            } else {
                return false;
            }
        }
    }

    async getBalance() {
        try {
            let res = await this._api('user/profile')
            this.state.balance = parseInt(res.balance)
            return this.state.balance;
        } catch (e) {
            this.state.error = e.message;
            return false;
        }
    }

    async getNumber(country) {
        try {
            let number = await this._api('user/buy/activation/' + this._getCountry(country) + '/any/telegram')
            this.state.id = number.id
            this.state.status = number.status;
            this.state.phone = number.phone.replace(/\D/g, '')
            this.state.released = moment();
            if (this.state.status === "PENDING") {
                await this._waitNumber();
            }
            return this.state;
        } catch (e) {
            this.state.error = e.message;
            return false;
        }
    }

    async getStatus(){
        try {
            let status = await this._api('user/check/' + this.state.id);
            if (status.sms.length > 0)
                this.state.sms = status.sms[0].code.code;
            this.state.status = status.status;
            return this.state;
        } catch (e) {
            this.state.error = e.message;
            return false;
        }
    }

    async waitSMS(){
        if (await this.getStatus()) {
            if (this.state.status !== "RECEIVED") {
                this.state.error = "WRONG_STATUS";
                return false;
            }
            if (this.state.sms) {
                return this.state.sms;
            }
            if(moment().diff(this.state.released)/1000>120) {
                this.state.error = "TIME_EXPIRED";
                return false;
            }
            return 'WAIT_CODE'
        } else {
            return false;
        }
    }

    done() {
        this._api('user/finish/' + this.state.id);
    }

    ban() {
        this._api('user/ban/' + this.state.id);
    }
}