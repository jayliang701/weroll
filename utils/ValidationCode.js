/**
 * Created by Jay on 2015/9/16.
 */

const Redis = require("../model/Redis");
const Model = require("../model/Model");
const Utils = require("./Utils");
const SMSUtil = require("./SMSUtil");

/*
 setting: {
     storage: {
         "type": "redis"  //or mongodb, default is redis
         ...   //other config
     },
     prefix:"check_code_",
     len:6,
     expire:5 * 60,
     pattern:[ [0,9],[A,Z] ],
     simulate:true
 }
 */

class MongoDBAgent {
    
    MongoDBAgent() {
        this.table = undefined
        this.DB = undefined
    }

    async init(option, callBack) {
        option = option || {};

        this.table = option.table || "checkcode";
        this.DB = option.db ? Model.getDBByName(option.db) : Model.DB;
        //build indexes
        try {
            this.DB.cr
            let result;
            try {
                result = await this.DB.getIndexes(this.table);
            } catch (err) {
                if (err.name === "MongoError" && err.code === 26) {
                    //no such table, need to create
                    console.warn("no such table, need to create");
                } else {
                    throw err;
                }
            }
            if (!result || !result["code_1"]) this.DB.ensureIndex(this.table, "code");
            if (!result || !result["expireAt_1"]) this.DB.ensureIndex(this.table, "expireAt", { expireAfterSeconds:0 });
        } catch (err) {
            if (callBack) return callBack(err);
            throw err;
        }
    }
    async del(key, callBack) {
        try {
            await this.DB.remove(this.table, { _id: key });
        } catch (err) {
            if (callBack) return callBack(err);
            throw err;
        }
        if (callBack) return callBack();
    }
    async get(key, callBack) {
        let doc;
        try {
            doc = await this.DB.findOne(this.table, { _id: key });
        } catch (err) {
            if (callBack) return callBack(err);
            throw err;
        }
        if (callBack) return callBack(null, doc.code);
        return doc.code;
    }
    async set(key, code, expireTime, callBack) {
        // expireTime --> seconds
        try {
            let date = new Date();
            date.setTime(Date.now() + expireTime * 1000);

            await this.DB.update(this.table, { _id: key }, { _id: key, code, expireAt: date }, { upsert:true });
        } catch (err) {
            if (callBack) return callBack(err);
            throw err;
        }
        if (callBack) return callBack();
    }
}
class RedisAgent {
    
    RedisAgent() {
        this.REDIS_KEY = undefined
    }

    async init(option, callBack) {
        option = option || {};

        this.REDIS_KEY = option.prefix || "validation_code_";

        if (callBack) return callBack();
    }
    async del(key, callBack) {
        try {
            await Redis.del(this.REDIS_KEY + key);
        } catch (err) {
            if (callBack) return callBack(err);
            throw err;
        }
        if (callBack) return callBack();
    }
    async get(key, callBack) {
        let code;
        try {
            code = await Redis.get(this.REDIS_KEY + key);
        } catch (err) {
            if (callBack) return callBack(err);
            throw err;
        }
        if (callBack) return callBack(null, code);
        return code;
    }
    async set(key, code, expireTime, callBack) {
        // expireTime --> seconds
        try {
            await Redis.set(this.REDIS_KEY + key, code, expireTime);
        } catch (err) {
            if (callBack) return callBack(err);
            throw err;
        }
        if (callBack) return callBack();
    }
}

function ValidationCode(setting) {
    
    let DEFAULT_CODE_LEN = 6;
    let DEFAULT_PATTERN = [ [ 48, 57 ] ];   //0-9
    let DEFAULT_EXPIRE = 15 * 60;     //15 min
    let config = ValidationCode.config || {};
    let DEBUG = global.VARS.debug;
    let SIMULATION = false;

    config = setting || config;
    DEFAULT_CODE_LEN = config.len || DEFAULT_CODE_LEN;
    if (config.pattern) {
        DEFAULT_PATTERN.length = 0;
        config.pattern.forEach(function(p) {
            DEFAULT_PATTERN.push([ String(p[0]).charCodeAt(0), String(p[1]).charCodeAt(0) ]);
        });
    }
    DEFAULT_EXPIRE = config.expire || DEFAULT_EXPIRE;
    SIMULATION = config.hasOwnProperty("simulate") ? config.simulate : SIMULATION;
    DEBUG = config.hasOwnProperty("debug") ? config.debug : DEBUG;
    
    let agent;
    if (config.storage && config.storage.type === "mongodb") {
        agent = new MongoDBAgent();
    } else {
        agent = new RedisAgent();
    }

    agent.init({
        ...config.storage,
    }, (err) => {
        if (err) console.error("ValidationCode init failed. ", err.messge);
    });


    this.remove = function(key, callBack) {
        return agent.del(key, callBack);
    }

    this.use = function(key, code, callBack) {
        let ins = this;
        return new Promise(function(resolve, reject) {
            if (!code || code == "") {
                if (callBack) return callBack(null, false);
                return resolve(false);
            }

            agent.get(key, function(err, savedCode) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(err);
                }

                if (savedCode && savedCode == code) {
                    ins.remove(key);
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }

                //模拟
                if (SIMULATION && code == "123456") {
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }
                if (callBack) return callBack(null, false);
                return resolve(false);
            });
        });
    }

    this.check = function(key, code, callBack) {
        return new Promise(function(resolve, reject) {
            agent.get(key, function(err, savedCode) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(redisErr);
                }

                if (savedCode && savedCode == code) {
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }
                if (SIMULATION && code == "123456") {
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }
                if (callBack) return callBack(null, false);
                return resolve(false);
            });
        });
    }

    this.generate = function(key, option, callBack) {
        option = typeof arguments[1] != "function" ? arguments[1] : {};
        option = option || {};
        callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
        if (typeof callBack != "function") callBack = null;

        let code = option.code || generateCode(parseInt(option.len || DEFAULT_CODE_LEN), option.pattern);

        return new Promise(function (resolve, reject) {
            agent.set(key, code, option.expire || DEFAULT_EXPIRE, function (err) {
                if (err) {
                    if (callBack) return callBack(err);
                    reject(err);
                    return;
                }
                DEBUG && console.log("generate validation code --> " + key + " >>> " + code);
                if (callBack) return callBack(null, code);
                resolve(code);
            });

        });
    }

    function generateCode(len, pattern) {
        let parts = DEFAULT_PATTERN;
        if (pattern) {
            parts.length = 0;
            pattern.forEach(function(p) {
                parts.push([ String(p[0]).charCodeAt(0), String(p[1]).charCodeAt(0) ]);
            });

        }

        let pwd = "";
        for (let i = 0; i < len; i++)
        {
            let part = parts[Math.floor(Math.random() * parts.length)];
            let code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
            let c = String.fromCharCode(code);
            pwd += c;
        }
        return pwd;
    }

    this.test = function() {
        console.log(generateCode.apply(this, Array.prototype.slice.call(arguments, 0)));
    }

    this.DEBUG = DEBUG;
    this.SIMULATION = SIMULATION;
}

ValidationCode.globalConfig = function(option) {
    ValidationCode.config = option || {};
}

module.exports = ValidationCode;