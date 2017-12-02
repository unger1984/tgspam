'use strict'

import fetch from 'node-fetch'


const main = () => {
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
}

export default main