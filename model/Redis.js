/**
 * Created by Jay on 2015/8/24.
 */

var REDIS = require("redis");
var UTIL = require('util');

var EventEmitter = require("events").EventEmitter;
/*
function RedisClient() {
    EventEmitter.call(this);
    this.client = null;
}
*/

var Dispatcher = new EventEmitter();
var client;
var setting;
var DEBUG = global.VARS ? global.VARS.debug : false;

exports.isConnected = function() {
    return client && client.__working == true;
}

function setExpire(key, val) {
    if (!val || val == - 1) {
        //no expired
    } else {
        client.expire(exports.join(key), val);
    }
}

var EXPIRED_MAP = {};

var CACHE_PREFIX = "CACHE_";

var SEP = ".";

exports.addEventListener = function(type, handler) {
    Dispatcher.addListener(type, handler);
}

exports.removeEventListener = function(type, handler) {
    Dispatcher.removeListener(type, handler);
}

exports.removeAllEventListener = function() {
    Dispatcher.removeAllListeners.apply(Dispatcher, arguments);
}

exports.setExpireTime = function(key, val) {
    if (key instanceof Array) key = key.join(SEP);
    setExpire(key, val);
}

exports.registerExpiredTime = function(key, expired) {
    if (key instanceof Array) key = key.join(SEP);
    EXPIRED_MAP[key] = Number(expired);
}

exports.save = function(key, val) {
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    var expired = typeof arguments[2] == "number" ? arguments[2] : arguments[3];
    if (typeof expired != "number") expired = null;

    return new Promise(function (resolve, reject) {
        var tempKey = key;
        var firstKey = key;
        var originalKey = key;
        var redisKey = key;
        if (key instanceof Array) {
            tempKey = key.join(SEP);
            firstKey = key[0];
        }
        if (tempKey.substr(0, 1) == "@") {
            redisKey = exports.join(tempKey, CACHE_PREFIX);
        } else {
            redisKey = exports.join(CACHE_PREFIX + tempKey);
        }
        //console.log('save ---> ' + tempKey);

        if (!expired) expired = EXPIRED_MAP[firstKey];
        var originalVal = val;
        if (typeof val == "object") {
            val = JSON.stringify(val);
        }

        client.set(redisKey, val, function (redisErr, redisRes) {
            if (!expired || expired == - 1) {
                //no expired
            } else {
                client.expire(redisKey, expired);
            }

            if (redisRes) {
                //console.log('2 -> cache [' + key + '] saved. expired ==> ' + expired);
                Dispatcher.emit("save", tempKey, originalKey, originalVal);
            } else {
                Dispatcher.emit("error", tempKey, originalKey, redisErr);
            }
            if (callBack) return callBack(redisErr, redisRes);
            if (redisErr) {
                reject(redisErr);
            } else {
                resolve(originalVal);
            }
        });
    });
}

exports.read = function(key, callBack) {
    return new Promise(function (resolve, reject) {
        var tempKey = key;
        var redisKey = key;
        if (key instanceof Array) tempKey = key.join(SEP);
        if (tempKey.substr(0, 1) == "@") {
            redisKey = exports.join(tempKey, CACHE_PREFIX);
        } else {
            redisKey = exports.join(CACHE_PREFIX + tempKey);
        }
        //console.log('read ---> ' + tempKey);
        client.get(redisKey, function(err, res) {
            if (res && typeof res == "string") {
                try {
                    res = JSON.parse(res);
                } catch (exp) { }
            }
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.remove = function(key, callBack) {
    return new Promise(function (resolve, reject) {
        var tempKey = key;
        var redisKey = key;
        if (key instanceof Array) tempKey = key.join(SEP);
        if (tempKey.substr(0, 1) == "@") {
            redisKey = exports.join(tempKey, CACHE_PREFIX);
        } else {
            redisKey = exports.join(CACHE_PREFIX + tempKey);
        }
        //console.log('remove ---> ' + tempKey);
        client.del(redisKey, function(err) {
            if (callBack) return callBack(err);
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

exports.set = function(key, val) {
    var callBack = arguments[arguments.length - 1];
    if (typeof callBack != "function") callBack = null;
    var expired = typeof arguments[2] == "number" ? arguments[2] : null;
    if (typeof expired != "number") expired = null;

    return new Promise(function (resolve, reject) {
        client.set(exports.join(key), val, function (err, res) {
            setExpire(key, expired);
            if (callBack) return callBack(err);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.setHash = function(key, field, val) {
    var callBack = arguments[arguments.length - 1];
    if (typeof callBack != "function") callBack = null;
    var expired = typeof arguments[3] == "number" ? arguments[3] : null;
    if (typeof expired != "number") expired = null;

    return new Promise(function (resolve, reject) {
        client.hset(exports.join(key), field, val, function (err, res) {
            setExpire(key, expired);
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.setHashMulti = function(key, fieldAndVals) {
    var callBack = arguments[arguments.length - 1];
    if (typeof callBack != "function") callBack = null;
    var expired = typeof arguments[2] == "number" ? arguments[2] : null;
    if (typeof expired != "number") expired = null;

    return new Promise(function (resolve, reject) {
        client.hmset(exports.join(key), fieldAndVals, function (err, res) {
            setExpire(key, expired);
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.pushIntoList = function(key, value, callBack) {
    return new Promise(function (resolve, reject) {
        var args = [ exports.join(key) ];
        args = args.concat(value);
        args.push(function(err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        })
        client.lpush.apply(client, args);
    });
}

exports.getFromList = function(key, fromIndex, toIndex, callBack) {
    return new Promise(function (resolve, reject) {
        client.lrange(exports.join(key), fromIndex, toIndex, function(err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.getWholeList = function(key, callBack) {
    return exports.getFromList(key, 0, -1, callBack);
}

exports.setToList = function(key, index, value, callBack) {
    return new Promise(function (resolve, reject) {
        client.lset(exports.join(key), index, value, function(err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.get = function(key, callBack) {
    return new Promise(function (resolve, reject) {
        client.get(exports.join(key), function(err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.getHash = function(key, field, callBack) {
    return new Promise(function (resolve, reject) {
        client.hget(exports.join(key), field, function (err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.getHashMulti = function(key, field, callBack) {
    return new Promise(function (resolve, reject) {
        client.hmget(exports.join(key), field, function (err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.getHashAll = function(key, callBack) {
    return new Promise(function (resolve, reject) {
        client.hgetall(exports.join(key), function (err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.getHashKeys = function(key, callBack) {
    return new Promise(function (resolve, reject) {
        client.hkeys(exports.join(key), function (err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.delHashField = function(key, fields, callBack) {
    return new Promise(function (resolve, reject) {
        client.hdel.apply(client, [ exports.join(key) ].concat(fields).concat(function(err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        }));
    });
}

exports.findKeysAndDel = function(keyword, callBack) {
    return new Promise(function (resolve, reject) {
        client.keys(keyword, function(err, keys) {
            if (err) {
                if (callBack) return callBack(err);
                return reject(err);
            } else {
                keys = keys || [];
                if (keys.length <= 0) {
                    if (callBack) return callBack(null, 0);
                    return resolve(0);
                }

                var tasks = [];
                keys.forEach(function(key) {
                    tasks.push([ "del", key ]);
                });
                exports.multi(tasks, function(err) {
                    if (callBack) return callBack(err, tasks.length);
                    if (err) {
                        reject(err);
                    } else {
                        resolve(tasks.length);
                    }
                });
            }
        });
    });
}

exports.del = function(key, callBack) {
    return new Promise(function (resolve, reject) {
        client.del(exports.join(key), function(err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.multi = function(tasks, callBack) {
    return new Promise(function (resolve, reject) {
        client.multi(tasks).exec(function (err) {
            if (callBack) return callBack(err);
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

exports.multiTask = function() {
    return client.multi();
}

exports.do = function (cmd, args, callBack) {
    return new Promise(function (resolve, reject) {
        var done = function(err, res) {
            if (callBack) return callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        }
        client[cmd].apply(client, args.concat([ done ]));
    });
}

exports.subscribe = function (channel, callBack) {
    return new Promise(function (resolve, reject) {
        client.subscribe(channel, function(err) {
            if (callBack) return callBack(err);
            err ? reject(err) : resolve();
        });
    });
}

exports.publish = function (channel, message, callBack) {
    return new Promise(function (resolve, reject) {
        client.publish(channel, message, function(err) {
            if (callBack) return callBack(err);
            err ? reject(err) : resolve();
        });
    });
}

exports.on = function (event, handler) {
    client.on(event, handler);
}

exports.join = function(key, preKey) {
    var redisKey = KEY_CACHE[key];
    if (redisKey) return redisKey;

    var group = "*";
    if (key.charAt(0) == "@" && GROUP_REG.test(key)) {
        var g = key.match(GROUP_REG);
        if (g && g.length > 0) {
            redisKey = key;
            group = g[0].substr(1, g[0].length - 3);
            key = key.substring(group.length + 3);
        }
        else return null;
    }

    var prefix = groups[group];
    KEY_CACHE[redisKey] = prefix + (preKey || "") + key;
    return KEY_CACHE[redisKey];
}

exports.checkLock = function(lockKey, callBack, checkDelay, timeout, currentRetry, p) {
    var promise = new Promise(function (resolve, reject) {
        var pins = this;
        if (p) {
            resolve = p.resolve;
            reject = p.reject;
        }
        timeout = timeout || 10;
        currentRetry = currentRetry || 0;
        checkDelay = checkDelay || 20;
        var maxRetry = Math.ceil((timeout * 1000) / checkDelay);
        var fullLockKey = exports.join(lockKey + "_redisLock");
        exports.do("SETNX", [ fullLockKey, Date.now() ], function(err, res) {
            if (err) {
                console.error(`check lock *${lockKey}* error ---> ${err}`);
                if (callBack) return callBack(err);
                return reject(err);
            } else {
                var isLocked = res == 0;
                if (isLocked) {
                    DEBUG && console.log(`found lock, wait ---> lock key: ${lockKey}`);
                    if (currentRetry >= maxRetry) {
                        err = new Error("access locked");
                        if (callBack) return callBack(err);
                        return reject(err);
                    }
                    currentRetry ++;
                    setTimeout(function() {
                        DEBUG && console.log("check lock retry ---> " + currentRetry);
                        exports.checkLock(lockKey, callBack, checkDelay, timeout, currentRetry, { resolve:resolve.bind(pins), reject:reject.bind(pins) });
                    }, checkDelay == undefined ? 10 : Number(checkDelay));
                } else {
                    if (setting && setting.maxLockTime) {
                        client.expire(fullLockKey, setting.maxLockTime, function() {
                            if (callBack) return callBack();
                            return resolve();
                        });
                    } else {
                        if (callBack) return callBack();
                        return resolve();
                    }
                }
            }
        });
    });
    return promise;
}

exports.releaseLock = function(lockKey, callBack) {
    return new Promise(function (resolve, reject) {
        exports.do("DEL", [ exports.join(lockKey + "_redisLock") ], function(err, res) {
            if (err) console.error(`release lock *${lockKey}* error ---> ${err}`);
            if (callBack) return callBack(err);
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

exports.releaseAllLocks = function(callBack) {
    return new Promise(function (resolve, reject) {
        exports.findKeysAndDel("*_redisLock", function(err, num) {
            if (callBack) return callBack(err, num);
            if (err) {
                reject(err);
            } else {
                resolve(num);
            }
        });
    });
}

var groups = {};

var KEY_CACHE = {};
var GROUP_REG = /@[a-zA-Z0-9]+->/;

exports.createClient = function(config, connectCallback) {
    config = config || setting;
    var ins = REDIS.createClient(config.port, config.host, { auth_pass: config.pass });
    if (connectCallback) {
        ins.on("connect", function() {
            ins.removeListener("connect", arguments.callee);
            connectCallback(ins);
        });
    }
    return ins;
}

exports.start = function(option, callBack) {

    setting = option || { };
    var host = setting.host || "localhost";
    var port = setting.port || 6379;
    var pass = setting.pass || "";
    var prefixName = setting.prefix || "weroll_";

    if (setting.cache && setting.cache.group_sep) SEP = setting.cache.group_sep;

    if (typeof prefixName == "object") {
        for (var key in prefixName) {
            groups[key] = prefixName[key];
        }
    } else {
        groups["*"] = prefixName;
    }

    client = REDIS.createClient(port, host, { auth_pass: pass });
    client.__working = false;
    client.__startCallBack = callBack;

    client.on("error", function(err) {
        client.__working = false;
        console.error(err);
        if (client.__startCallBack) {
            client.__startCallBack(err);
            client.__startCallBack = null;
        }
    });
    client.on("connect", function() {
        console.log("Redis Server<" + host + ":" + port + "> is connected.");
        client.__working = true;
        if (setting && setting.releaseLockWhenStart) {
            exports.releaseAllLocks(function() {
                if (client.__startCallBack) {
                    client.__startCallBack();
                    client.__startCallBack = null;
                }
            });
        } else {
            if (client.__startCallBack) {
                client.__startCallBack();
                client.__startCallBack = null;
            }
        }
    });
}

exports.close = function (callBack) {
    if (!client) {
        return callBack && callBack();
    }

    client.end(true);
    client.quit(function () {
        callBack && callBack();
    });
}