'use strict'

import fetch from 'node-fetch'
import moment from 'moment'

import config from '../config'
import log from '../utils/mongo-logger'

export default class SMSka {
    static URL = "https://smska.net/stubs/handler_api.php";

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

    _country = "en";

    _error(err){
        switch (err){
            case "ERROR_SQL":
            case "BAD_ACTION":
                return "SERVER_ERROR";
                break;
            case "NO_ACTIVATION":
                return "NO_ORDER";
                break;
            case "BAD_SERVICE":
            case "NO_BALANCE":
            case "NO_NUMBERS":
            case "BAD_KEY":
                return err;
                break;
            default:
                return "UNKNOWN";
        }
    }

    _getCountry(country) {
        switch (country.toLowerCase()) {
            case "ua":
                return 1;
                break;
            case "ru":
            default:
                return 0;
                break;
        }
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
        let opts = [{api_key: config.SMS.SMSka.API_KEY}, {action: method}];
        opts = opts.concat(args)
        let url = SMSka.URL + '?' + this._toargs(opts);
        if(this.isDebug) log("get", url)
        try {
            let res = await fetch(url);
            if (res.status == 200) {
                res = await res.text();
                if (this.isDebug) log(res)
                return res;
            } else {
                this.state.error = "SERVER_ERROR";
                throw new Error("SERVER_ERROR", res.status);
            }
        }catch(ex){
            this.state.error = "SERVER_ERROR";
            throw new Error("SERVER_ERROR", res.status);
        }
    }

    async getBalance() {
        try {
            let res = await this._api('getBalance',[])
            let s = res.split(':');
            if(s.length>1){
                this.state.balance = parseInt(s[1])
                return this.state.balance;
            }else{
                this.state.error = res;
                return false;
            }
        }catch(e){
            this.state.error = e.message;
            return false;
        }
    }

    async getNumber(country) {
        try {
            let number = await this._api('getNumber', [
                {country: this._getCountry(country)},
                {service: "te"},
                {operator: "any"}
            ])
            let s = number.split(':');
            if(s.length>1){
                this.state.id = s[1];
                this.state.phone = s[2].replace(/\D/g, '')
                this.state.status = "RECEIVED";
                this.state.released = moment();
                return this.state;
            }else{
                this.state.error = number;
                return false;
            }
        }catch(e){
            this.state.error = e.message;
            return false;
        }
    }

    async getStatus() {
        try {
            let res = await this._api('getStatus',[{id: this.state.id}]);
            let s = res.split(':');
            if(s.length>1){
                this.state.sms = s[1];
                return this.state;
            }else{
                switch(res){
                    case "STATUS_WAIT_CODE":
                        this.state.status = "RECEIVED";
                        return this.state;
                    case "STATUS_CANCEL":
                    default:
                        this.state.status = "CANCELED";
                        return this.state;
                        break;
                }
            }
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
        // this._api('setStatus',[{id: this.state.id},{status: -1}]);
    }

    ban() {
        this._api('setStatus',[{id: this.state.id},{status: -1}]);
    }

}