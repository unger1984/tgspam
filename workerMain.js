'use strict'

import MainService from './services/MainService'
import log from "./utils/mongo-logger";

require('./init')

log("Start main worker... task is "+(MainService.getInstance().isStart()?"runing":"stop"))
