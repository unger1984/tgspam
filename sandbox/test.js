'use strict'

import Phone from '../models/Phone'
import Task from "../models/Task";

const test = async () => {
    const task = await await Task.findOne({});
    const phone = await Phone.find({'joinedchat': {$size: task.capacity}})
        // .where('active').equals(true)
        //.where('seen').lte(new Date((new Date()).getTime() - 1 * 60 * 1000))
        //.where('sent').lt(task.capacity)
        //.limit(1)
        //.exec()

    console.log(phone)
}

export default test