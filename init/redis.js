'use strict'

import redis from 'redis'

const RedisClient = redis.createClient()
RedisClient.on("error", (e) => {
    console.error("MongoDB ERROR", e)
    process.exit(2)
})
console.log("Redis started")
