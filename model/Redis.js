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

exports.save = function(key, val, expired, callBack) {
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
        if (callBack) callBack(redisRes, redisErr);
    });

    return val;
}

exports.read = function(key, callBack) {
    if (key instanceof Array) {
        key = key.join("->");
    }
    if (key.substr(0, 1) == "@") {
        key = exports.join(key, CACHE_PREFIX);
    } else {
        key = exports.join(CACHE_PREFIX + key);
    }
    client.get(key, function(err, res) {
        if (err) {
            if (callBack) callBack(null, err);
        } else {
            if (res && typeof res == "string") {
                try {
                    res = JSON.parse(res);
                } catch (exp) {
                    //res is not a json string
                }
            }
            //console.log('read cache [' + key + '] from 2.');
            if (callBack) callBack(res);
        }
    });
}

exports.remove = function(key, callBack) {
    if (key instanceof Array) {
        key = key.join("->");
    }
    if (key.substr(0, 1) == "@") {
        key = exports.join(key, CACHE_PREFIX);
    } else {
        key = exports.join(CACHE_PREFIX + key);
    }
    client.del(key, function(err, removedNum) {
        if (callBack) {
            callBack(err ? false : true, err, removedNum);
        }
    });
}

exports.set = function(key, val, callBack, expired) {
    client.set(exports.join(key), val, function (err, res) {
        setExpire(key, expired);
        if (err) console.error("Redis.set(" + key + ") ==> " + err);
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.setHash = function(key, field, val, callBack, expired) {
    client.hset(exports.join(key), field, val, function (err, reply) {
        setExpire(key, expired);
        if (err) console.error("Redis.setHash(" + key + ", " + field + ") ==> " + err);
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.setHashMulti = function(key, fieldAndVals, callBack, expired) {
    client.hmset(exports.join(key), fieldAndVals, function (err, reply) {
        setExpire(key, expired);
        if (err) {
            var temp = (typeof fieldAndVals == "string") ? fieldAndVals : JSON.stringify(fieldAndVals);
            console.error("Redis.setHashMulti(" + key + ", " + (temp ? temp.substr(0, 16) : "null") + "..." + ") ==> " + err);
        }
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.pushIntoList = function(key, value, callBack) {
    var args = [ exports.join(key) ];
    args = args.concat(value);
    args.push(function(err, replay) {
        if (err) console.error("Redis.pushIntoList(" + key + ") ==> " + err);
        if (callBack) {
            callBack(replay, err);
        }
    })
    client.lpush.apply(client, args);   
}

exports.getFromList = function(key, fromIndex, toIndex, callBack) {
    client.lrange(exports.join(key), fromIndex, toIndex, function(err, replay) {
        if (err) console.error("Redis.getFromList(" + key + ") ==> " + err);
        if (callBack) {
            callBack(replay, err);
        }
    });
}

exports.getWholeList = function(key, callBack) {
    exports.getFromList(key, 0, -1, callBack);
}

exports.setToList = function(key, index, value, callBack) {
    client.lset(exports.join(key), index, value, function(err, replay) {
        if (err) console.error("Redis.setToList(" + key + ") ==> " + err);
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.get = function(key, callBack) {
    client.get(exports.join(key), function(err, reply) {
        // reply is null when the key is missing
        if (err) console.error("Redis.get(" + key + ") ==> " + err);
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHash = function(key, field, callBack) {
    client.hget(exports.join(key), field, function (err, reply) {
        if (err) {
            console.error("Redis.getHash(" + key + ", " + field + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashMulti = function(key, field, callBack) {
    client.hmget(exports.join(key), field, function (err, reply) {
        if (err) {
            console.error("Redis.getHashMulti(" + key + ", " + field + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashAll = function(key, callBack) {
    client.hgetall(exports.join(key), function (err, reply) {
        if (err) {
            console.error("Redis.getHashAll(" + key + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashKeys = function(key, callBack) {
    client.hkeys(exports.join(key), function (err, reply) {
        if (err) {
            console.error("Redis.getHashKeys(" + key + ") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    });
}

exports.getHashToObj = function(key, callBack) {
    exports.getHashKeys(key, function (keys) {
        var count = keys.length;
        var index = 0;

        var obj = { keyNum:count, valNum:0, map:{} };

        if (count == 0) {
            if (callBack) {
                callBack(obj);
            }
            return;
        }

        for (var i = 0; i < count; i++) {
            (function(idx) {
                exports.getHash(key, keys[idx], function (vals) {
                    index ++;
                    obj.valNum += vals.length;
                    obj.map[keys[idx]] = vals;

                    if (index == count) {
                        if (callBack) {
                            callBack(obj);
                        }
                    }
                });
            })(i);
        }
    });
}

exports.delHashField = function(key, fields, callBack) {
    client.hdel.apply(client, [ exports.join(key) ].concat(fields).concat(function(err) {
        if (callBack) {
            callBack(err ? false : true, err);
        }
    }));
}

exports.findKeysAndDel = function(keyword, callBack) {
    client.keys(keyword, function(err, keys) {
        if (err) {
            if (callBack) callBack(err, 0);
        } else {
            keys = keys || [];
            if (keys.length <= 0) {
                if (callBack) callBack(null, 0);
                return;
            }

            var tasks = [];
            keys.forEach(function(key) {
                tasks.push([ "del", key ]);
            });
            exports.multi(tasks, function(flag, err) {
                if (err) {
                    if (callBack) callBack(err, 0);
                } else {
                    if (callBack) callBack(null, tasks.length);
                }
            });
        }
    });
}

exports.del = function(key, callBack) {
    client.del(exports.join(key), function(err, removedNum) {
        if (callBack) {
            callBack(err ? false : true, err, removedNum);
        }
    });
}

exports.multi = function(tasks, callBack) {
    client.multi(tasks).exec(function (err, replies) {
        if (callBack) {
            callBack(err ? false : true, err);
        }
    });
}

exports.multiTask = function() {
    return client.multi();
}

exports.do = function (cmd, args, callBack) {
    var done = function(err, reply) {
        if (err) {
            console.error("Redis.do(" + cmd +") ==> " + err);
        }
        if (callBack) {
            callBack(reply, err);
        }
    }
    var func = client[cmd];
    func.apply(client, args.concat([ done ]));
}

exports.exec = function (method) {
    if (method == "exec") throw new Error("illegal method to be executed");
    var func = exports[method];
    var args = Array.prototype.slice.call(arguments, 0);
    args.shift();
    func.apply(exports, args);
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

exports.checkLock = function(lockKey, callBack, checkDelay, timeout, currentRetry) {
    timeout = timeout || 30;
    currentRetry = currentRetry || 0;
    var maxRetry = Math.ceil((timeout * 1000) / checkDelay);
    exports.do("SETNX", [ exports.join(lockKey + "_redisLock"), Date.now() ], function(res, err) {
        if (err) {
            callBack(err);
        } else {
            var isLocked = res == 0;
            if (isLocked) {
                console.log(`found lock, wait ---> lock key: ${lockKey}`);
                if (currentRetry >= maxRetry) {
                    callBack(new Error("access locked"));
                    return;
                }
                currentRetry ++;
                setTimeout(function() {
                    console.log("check lock retry ---> " + currentRetry);
                    exports.checkLock(lockKey, callBack, checkDelay, timeout, currentRetry);
                }, checkDelay == undefined ? 10 : Number(checkDelay));
            } else {
                callBack();
            }
        }
    });
}

exports.releaseLock = function(lockKey, callBack) {
    exports.do("DEL", [ exports.join(lockKey + "_redisLock") ], function(res, err) {
        if (err) console.error(`release lock *${lockKey}* error ---> ${err}`);
        callBack && callBack(err);
    });
}

exports.releaseAllLocks = function(callBack) {
    exports.findKeysAndDel("*_redisLock", function(err, num) {
        callBack && callBack(err, num);
    });
}

var groups = {};

var KEY_CACHE = {};
var GROUP_REG = /@[a-zA-Z0-9]+->/;

exports.createClient = function(config) {
    return REDIS.createClient(config.port, config.host, { auth_pass: config.pass });
}

exports.start = function(host, port, pass, prefixName, callBack) {

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
        exports.releaseAllLocks(function() {
            if (client.__startCallBack) {
                client.__startCallBack();
                client.__startCallBack = null;
            }
        });
    });
}