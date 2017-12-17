'use strict'

import Util from './'

const first_names = require('./first-names')
const last_names = require('./last-names')

export const generateFirstName = () => {
    return first_names[Math.floor(Math.random() * first_names.length)]
}

export const generateLastName = () => {
    return last_names[Math.floor(Math.random() * last_names.length)]
}

export const generateFullName = () => {
    return generateFirstName()+" "+generateLastName()
}

export const generateUserName = () => {
    let name = generateLastName().toLowerCase();
    return (name+Util.randomInteger(1000,9999))
}