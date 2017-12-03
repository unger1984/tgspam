'use strict'

import proxy from './proxy'
import clusters from './clusters'
import main from './main'

if(process.argv.length!==3){
    console.log("Usage: node sandbox command")
    process.exit(1)
}

switch (process.argv[2]){
    case 'proxy':
        proxy();
        break;
    case 'clusters':
        clusters();
        break;
    case 'main':
        main();
        break;
    default:
        console.log("Unknown command");
        break;
}