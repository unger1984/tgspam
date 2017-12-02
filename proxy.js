'use strict'

import fetch from 'node-fetch'

fetch("https://awcoding.com/ip.php",{method:"GET",timeout: 5001})
    .then(r => {
        r.text()
            .then(t => {
                console.log(t)
            })
    })
    .catch(e => {
        console.error(e)
    })