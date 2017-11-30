'use strict'

import Bluebird from 'bluebird';
import { parse, format } from 'path';
import { readJsonSync, outputJsonSync, pathExistsSync, removeSync} from 'fs-extra';

export class JsonStorage {
    constructor(file, data) {
        this.file = normalizePath(file);
        if (!pathExistsSync(this.file)) outputJsonSync(this.file, data || {});
    }
    get(key) {
        return Bluebird.resolve(readJsonSync(this.file)[key]);
    }

    set(key, val) {
        const data = readJsonSync(this.file);
        data[key] = val;
        outputJsonSync(this.file, data);
        return Bluebird.resolve();
    }

    has(key) {
        return Bluebird.resolve(!!readJsonSync(this.file)[key]);
    }

    remove(...keys) {
        const data = readJsonSync(this.file);
        for (const key of keys) {
            delete data[key];
        }
        outputJsonSync(this.file, data);
        return Bluebird.resolve();
    }
    clear() {
        outputJsonSync(this.file, {});
        return Bluebird.resolve();
    }
    delfile() {
        removeSync(this.file)
    }
}

function normalizePath(filepath) {
    const parsed = parse(filepath);
    if (parsed.ext !== '.json') return format(Object.assign({}, parsed, { ext: '.json' }));
    return filepath;
}

export { JsonStorage as Storage };

export default JsonStorage;