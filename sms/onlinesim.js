'use strict'

import fetch from 'node-fetch'
import moment from 'moment'

import config from '../config'
import log from '../utils/mongo-logger'

export default class SIMOnline {
    static URL = "https://onlinesim.ru/api/";

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

    constructor(isDebug) {
        this.isDebug = isDebug || false
    }

    _country = "all";

    _error(err) {
        switch (err) {
            case "ERROR_SQL":
            case "BAD_ACTION":
                return "SERVER_ERROR";
                break;
            case "NO_ACTIVATION":
                return "NO_ORDER";
                break;
            case "Сервис не определён!":
                return "BAD_SERVICE";
                break;
            default:
                return err;
        }
    }

    _getCountry(country) {
        return country.toLowerCase();
    }

    _timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _toargs(args) {
        let res = "";
        for (let i = 0; i < args.length; i++) {
            if (res.length > 0)
                res += "&";
            let key = Object.keys(args[i])[0];
            res += key + '=' + args[i][key];
        }
        return res;
    }

    async _api(method, args) {
        let opts = [{apikey: config.SMS.SIMOnline.API_KEY}];
        opts = opts.concat(args)
        let url = SIMOnline.URL + method + '.php?' + this._toargs(opts);
        if (this.isDebug) console.log("get", url)
        let res = await fetch(url);
        if (res.status === 200) {
            let r = await res.text();
            try {
                let j = JSON.parse(r)
                if (this.isDebug) log(j)
                let t = Object.prototype.toString.call(j)
                if(t === "[object Array]" && j.length>0)
                    j = j[0]
                return j;
            } catch (e) {
                this.state.error = this._error(r);
                throw new Error(this._error(r), 404);
            }
        } else {
            this.state.error = "SERVER_ERROR";
            throw new Error("SERVER_ERROR", res.status);
        }
    }

    async getBalance() {
        try {
            let res = await this._api('getBalance', [])
            if (res.response === "1") {
                this.state.balance = parseInt(res.balance)
                return this.state.balance;
            } else {
                this.state.error = res.response;
                return false;
            }
        } catch (e) {
            this.state.error = e.message;
            return false;
        }
    }

    async _waitNumber(delay) {
        const del = parseInt(delay) || 5
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

    // TODO add appid
    async getNumber(country) {
        this._country = this._getCountry(country);
        try {
            let res = await this._api('getNum', [
                {service: "telegram"},
            ])
            // if(!res.response) return false;
            if (res.tzid) {
                this.state.id = res.tzid;
                this.state.status = "PENDING";
                this.state.released = moment();
                if(!await this._waitNumber())
                    return false;
                return this.state;
            } else {
                this.state.error = res.response;
                return false;
            }
        } catch (e) {
            this.state.error = e.message;
            return false;
        }
    }

    async getStatus() {
        try {
            let res = await this._api('getState', [
                {tzid: this.state.id}
            ]);
            if(!res.response) return false;
            switch(res.response){
                case 'TZ_NUM_ANSWER':
                    this.state.sms = res.msg
                    return true;
                case 'TZ_INPOOL':
                    this.state.status = "PENDING";
                    return this.state;
                case 'TZ_NUM_WAIT':
                    this.state.phone = res.number.replace(/\D/g, '')
                    this.state.status = "RECEIVED";
                    return this.state;
                case 'TZ_NUM_PREPARE':
                    this.state.status = "TZ_NUM_PREPARE"
                    this.state.phone = res.number;
                    return this.state
                case 'WARNING_NO_NUMS':
                    this.state.error = "NO_NUMBERS"
                    return false;
                default:
                    this.state.status = "WRONG_STATUS";
                    return false;
            }
        } catch (e) {
            this.state.error = e.message;
            return false;
        }
    }

    async waitSMS() {
        if (await this.getStatus()) {
            if (this.state.sms) {
                return this.state.sms;
            }
            if (this.state.status !== "RECEIVED") {
                this.state.error = "WRONG_STATUS";
                return false;
            }
            if (moment().diff(this.state.released) / 1000 > 120) {
                this.state.error = "TIME_EXPIRED";
                return false;
            }
            return 'WAIT_CODE'
        } else {
            return false;
        }
    }

    done() {
        this._api('setOperationOk',[{tzid: this.state.id}]);
    }

    ban() {
        // this._api('setOperationOver', [{tzid: this.state.id}]);
    }

}