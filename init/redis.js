'use strict'

import redis from 'redis'

const RedisClient = redis.createClient()
RedisClient.on("error", (e) => {
    console.error("Redis ERROR", e)
    process.exit(2)
})
RedisClient.on("connect",()=>{
    console.log("Redis started")
})
