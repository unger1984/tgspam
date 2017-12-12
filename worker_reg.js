'use strict'

import log from "./utils/mongo-logger";
import RegWorker from "./services/RegWorker";

require('./init')

const reg = new RegWorker();

log("Start reg worker... task "+reg.__workerId)
