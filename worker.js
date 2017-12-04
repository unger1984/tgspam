'use strict'

import MainService from './services/MainService'
import log from "./utils/mongo-logger";

require('./init')

log("Start worker... task is "+(MainService.getInstance().isStart()?"runing":"stop"))
