'use strict'

import proxy from './proxy'
import test from './test'

if(process.argv.length!==3){
    console.log("Usage: node sandbox command")
    process.exit(1)
}

switch (process.argv[2]){
    case 'proxy':
        proxy();
        break;
    case 'test':
        test();
        break;
    default:
        console.log("Unknown command");
        break;
}