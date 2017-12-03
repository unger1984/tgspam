'use strict'

import redis from 'redis'
import Task from '../models/Task'


const clusters = () => {
    const _randomInteger = (min, max) => {
        var rand = min - 0.5 + Math.random() * (max - min + 1)
        rand = Math.round(rand);
        return rand;
    }

    const workerId = _randomInteger(100,900)
    let countData = 0;
    let redisPublisher = null;

    let isBlockRegLoop = false,
        isBlockJoinLoop = false,
        isBlockSpamLoop = false

    const onBlock = (channel, msg) => {
        const oldCount = countData;
        let m = JSON.parse(msg)
        if(workerId === m.worker) return;
        switch (m.type) {
            case 'regloop':
                isBlockRegLoop = m.block
                break;
            case 'joinloop':
                isBlockJoinLoop = m.block
                break;
            case 'spamloop':
                isBlockSpamLoop = m.block
                break;
        }
        console.log(workerId, oldCount, "block", m.block)
    }

    const repairTask = async () => {
        const oldCount = countData;
        require('../init')
        console.log(workerId, oldCount, "Rdis subscribe");
        redisPublisher = redis.createClient()
        redisPublisher.on("message",onBlock)
        redisPublisher.subscribe("block")
        redisPublisher = redis.createClient()

        console.log(workerId, oldCount, "REPAIR TASK")
        const task = await Task.findOne({});
        task.isRegLoop = false;
        task.isJoinLoop = false;
        task.isSpamLoop = false;
        await task.save();
    }

    process.nextTick(() => repairTask());

    const pause = (sec) => {
        return new Promise(resolve => setTimeout(resolve, parseInt(sec) * 1000 + 1));
    }

    const getTask = async () => {
        const task = await Task.findOne({});
        return task
    }

    const isActive = async () => {
        return (await getTask()).active;
    }

    const regloop = async () => {
        const _start = async () => {
            const task = await getTask();
            task.isRegLoop = true;
            await task.save();
        }
        const _stop = async () => {
            const task = await getTask();
            task.isRegLoop = false;
            await task.save();
        }

        if (!isActive()) {
            await _stop();
            return;
        }
        await _start()
        await pause(5)
        await _stop()
    }

    const loop = async () => {
        const oldCount = countData;
        let loopStatus = "skip",
            loopRegStatus = "skip",
            loopJoinStatus = "skip",
            isSpamLoop = "skip"

        if (await isActive()) {
            loopStatus = "work"
            const task = await Task.findOne({});
            if (!isBlockRegLoop && !task.isRegLoop) {
                redisPublisher.publish("block", JSON.stringify({type: "regloop", block: true, worker: workerId}));
                console.log(workerId, oldCount, "call regloop")
                await regloop()
                redisPublisher.publish("block", JSON.stringify({type: "regloop", block: false, worker: workerId}));
                console.log(workerId, oldCount, "done regloop")
                loopRegStatus = "work"
            }
        }
        countData++
        console.log(workerId, oldCount, "loop=" + loopStatus, "reg=" + loopRegStatus, "join=" + loopJoinStatus, "spam=" + isSpamLoop)
    }

    setInterval(() => {
            // Task.findOne({})
            //     .then(t=>{
            //         t.active = !t.active
            //         t.save()
            //     })
            process.nextTick(
                () => loop()
                    // .then(() => console.log(workerId, countData, "done"))
            )
        },
        501
    )
}

export default clusters