'use strict'

import fetch from 'node-fetch'
import moment from 'moment'

import config from '../config'
import log from '../utils/mongo-logger'

export default class SIMSms {
    static URL = "http://simsms.org/priemnik.php";

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
        let opts = [{apikey: config.SMS.SIMSms.API_KEY}, {metod: method}];
        opts = opts.concat(args)
        let url = SIMSms.URL + '?' + this._toargs(opts);
        if(this.isDebug) log("get", url)
        let res = await fetch(url);
        if (res.status === 200) {
            let r = await res.text();
            try {
                let j = JSON.parse(r)
                if(this.isDebug) log(j)
                return j;
            }catch(e){
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
            let res = await this._api('get_balance',[{service: 'opt29'}])
            if(res.response === "1"){
                this.state.balance = parseInt(res.balance)
                return this.state.balance;
            }else{
                this.state.error = res.error_msg;
                return false;
            }
        }catch(e){
            this.state.error = e.message;
            return false;
        }
    }

    async getNumber(country) {
        this._country = this._getCountry(country);
        try {
            let res = await this._api('get_number', [
                {country: this._getCountry(country)},
                {service: "opt29"},
                {id: 1}
            ])
            if(res.response === "2"){
                this.state.error = "NO_NUMBERS";
                return false;
            }else if(res.response === "1" && res.id){
                this.state.id = res.id;
                this.state.phone = (res.CountryCode+res.number).replace(/\D/g, '')
                this.state.status = "RECEIVED";
                this.state.released = moment();
                return this.state;
            }else{
                this.state.error = res.error_msg;
                return false;
            }
        }catch(e){
            this.state.error = e.message;
            return false;
        }
    }

    async getStatus() {
        try {
            let res = await this._api('get_sms',[
                {id: this.state.id},
                {service: "opt29"},
                {country: this._country}
            ]);

            if(res.response === "2"){
                this.state.status = "RECEIVED";
                return this.state;
            }else if(res.response === "1"){
                this.state.sms = res.sms;
                return this.state;
            }else{
                this.state.error = res.error_msg;
                return false;
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
        // this._api('setStatus',[{id: this.state.id},{service: "opt29"}]);
    }

    ban() {
        this._api('ban',[{id: this.state.id},{service: "opt29"}]);
    }

}