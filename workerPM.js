'use strict'

import PMService from './services/PMService'
import log from "./utils/mongo-logger";

require('./init')

log("Start pm worker... task is "+(PMService.getInstance().isStart()?"runing":"stop"))
