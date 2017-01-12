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
var DEBUG = global.VARS.debug;

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
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    setExpire(key, val);
}

exports.registerExpiredTime = function(key, expired) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    EXPIRED_MAP[key] = Number(expired);
}

exports.save = function(key, val) {
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    var expired = typeof arguments[2] == "number" ? arguments[2] : arguments[3];
    if (typeof expired != "number") expired = null;

    return new Promise(function (resolve, reject) {
        var tempKey = key;
        var originalKey = key;
        if (key instanceof Array) {
            tempKey = key[0];
            if (!expired) expired = EXPIRED_MAP[tempKey];
            key = key.join("->");
        } else {
            if (!expired) expired = EXPIRED_MAP[key];
        }
        var originalVal = val;
        if (typeof val == "object") {
            val = JSON.stringify(val);
        }
        if (key.substr(0, 1) == "@") {
            key = exports.join(key, CACHE_PREFIX);
        } else {
            key = exports.join(CACHE_PREFIX + key);
        }
        client.set(key, val, function (redisErr, redisRes) {
            if (!expired || expired == - 1) {
                //no expired
            } else {
                client.expire(key, expired);
            }

            if (redisRes) {
                //console.log('2 -> cache [' + key + '] saved. expired ==> ' + expired);
                Dispatcher.emit("save", tempKey, originalKey, originalVal);
            } else {
                Dispatcher.emit("error", tempKey, originalKey, redisErr);
            }
            callBack && callBack(redisErr, redisRes);
            if (redisErr) {
                reject(redisErr);
            } else {
                resolve(redisRes);
            }
        });
    });
}

exports.read = function(key, callBack) {
    return new Promise(function (resolve, reject) {
        if (key instanceof Array) {
            key = key.join("->");
        }
        if (key.substr(0, 1) == "@") {
            key = exports.join(key, CACHE_PREFIX);
        } else {
            key = exports.join(CACHE_PREFIX + key);
        }
        client.get(key, function(err, res) {
            if (res && typeof res == "string") {
                try {
                    res = JSON.parse(res);
                } catch (exp) { }
            }
            callBack && callBack(err, res);
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
        if (key instanceof Array) {
            key = key.join("->");
        }
        if (key.substr(0, 1) == "@") {
            key = exports.join(key, CACHE_PREFIX);
        } else {
            key = exports.join(CACHE_PREFIX + key);
        }
        client.del(key, function(err) {
            callBack && callBack(err);
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

exports.set = function(key, val) {
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    var expired = typeof arguments[2] == "number" ? arguments[2] : arguments[3];
    if (typeof expired != "number") expired = null;

    return new Promise(function (resolve, reject) {
        client.set(exports.join(key), val, function (err, res) {
            setExpire(key, expired);
            callBack && callBack(err);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.setHash = function(key, field, val, callBack, expired) {
    return new Promise(function (resolve, reject) {
        client.hset(exports.join(key), field, val, function (err, res) {
            setExpire(key, expired);
            callBack && callBack(err, res);
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

exports.setHashMulti = function(key, fieldAndVals, callBack, expired) {
    return new Promise(function (resolve, reject) {
        client.hmset(exports.join(key), fieldAndVals, function (err, res) {
            setExpire(key, expired);
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err, res);
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
                callBack && callBack(err);
                return reject(err);
            } else {
                keys = keys || [];
                if (keys.length <= 0) {
                    callBack && callBack(null, 0);
                    return resolve(0);
                }

                var tasks = [];
                keys.forEach(function(key) {
                    tasks.push([ "del", key ]);
                });
                exports.multi(tasks, function(err) {
                    callBack && callBack(err, tasks.length);
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
            callBack && callBack(err, res);
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
            callBack && callBack(err);
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
            callBack && callBack(err, res);
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
    client.subscribe(channel, callBack);
}

exports.publish = function (channel, message, callBack) {
    client.publish(channel, message, callBack);
}

exports.on = function (event, callBack) {
    client.on(event, callBack);
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
                callBack && callBack(err);
                return reject(err);
            } else {
                var isLocked = res == 0;
                if (isLocked) {
                    DEBUG && console.log(`found lock, wait ---> lock key: ${lockKey}`);
                    if (currentRetry >= maxRetry) {
                        err = new Error("access locked");
                        callBack && callBack(err);
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
                            callBack && callBack();
                            return resolve();
                        });
                    } else {
                        callBack && callBack();
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
            callBack && callBack(err);
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
            callBack && callBack(err, num);
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

exports.createClient = function(config) {
    return REDIS.createClient(config.port, config.host, { auth_pass: config.pass });
}

exports.start = function(option, callBack) {

    setting = option || { };
    var host = setting.host || "localhost";
    var port = setting.port || 6379;
    var pass = setting.pass || "";
    var prefixName = setting.prefix || "weroll_";

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