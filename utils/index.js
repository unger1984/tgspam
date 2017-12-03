'use strict'

export default class Util {

    static randomInteger(min, max) {
        var rand = min - 0.5 + Math.random() * (max - min + 1)
        rand = Math.round(rand);
        return rand;
    }

    static pause(sec,inms) {
        let inMs = inms || false
        let delay = parseInt(sec)
        if(!inMs)
            delay = delay*1000
        return new Promise(resolve => setTimeout(resolve, delay + 1));
    }
}