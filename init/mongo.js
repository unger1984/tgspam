'use strict'

import Bluebird from 'bluebird';
import mongoose from 'mongoose'

import config from '../config'

mongoose.Promise = Bluebird
mongoose.connect("mongodb://" + config.mongo.host + "/" + config.mongo.db, config.mongo.options)
    .then(() => {
        console.log("MongoDB started")
    })
    .catch(err => {
        console.error("MongoDB ERROR", err)
        process.exit(2)
    })
