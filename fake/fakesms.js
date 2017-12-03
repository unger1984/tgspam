'use strict'

import moment from 'moment'

export default class FakeSMS {
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

    _timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _randomInteger(min, max) {
        var rand = min - 0.5 + Math.random() * (max - min + 1)
        rand = Math.round(rand);
        return rand;
    }

    async getBalance(delay) {
        const del = parseInt(delay) || 1
        await this._timeout(del)
        return this._randomInteger(1,100);
    }

    async getNumber(country,delay) {
        const del = parseInt(delay) || 1
        await this._timeout(del)
        const status = 2 //this._randomInteger(0,1)
        if(status === 1){
            this.state.error = "NO_NUMBERS";
            return false
        }else{
            this.state.id = this._randomInteger(1,2342342344);
            this.state.phone = this._randomInteger(79000000001,79999999999);
            this.state.status = "RECEIVED";
            this.state.released = moment();
            return this.state;
        }
    }

    async getStatus(delay) {
        const del = parseInt(delay) || 1
        await this._timeout(del)
        const status = this._randomInteger(0,1)
        if(status === 1){
            this.state.status = "RECEIVED";
            return this.state;
        }else{
            this.state.sms = this._randomInteger(100000,999999);
            return this.state;
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

    done() {}
    ban() {}
}