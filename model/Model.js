/**
 * Created by Jay on 2015/8/24.
 */
var FS = require("fs");

var db = require("./MongoDB");
var memory = require("./MemoryCache");
var redis = require("./Redis");
var Utils = require("../utils/Utils");

var CACHE_CONFIG;

var SYNC_UP_LEVEL_CACHE = {};
var READ_LEVEL_MAPPING = {};
var SAVE_LEVEL_MAPPING = {};

var CACHE_POOL = {
    "1" : memory,
    "2" : redis
    //"3" : fs
};

exports.init = function(option, callBack) {

    CACHE_CONFIG = FS.readFileSync(global.getConfigPath("cache.config"));
    CACHE_CONFIG = JSON.parse(CACHE_CONFIG.toString("utf8"));

    var q = [];

    q.push(function(cb) {

        for (var group in CACHE_CONFIG) {
            var defs = CACHE_CONFIG[group];
            if (group == "*" || group == "general") {
                group = null;
            }
            for (var key in defs) {
                var fullKey = group ? (group + "." + key) : key;
                var def = defs[key];
                if (def.level == 0) {
                    SYNC_UP_LEVEL_CACHE[fullKey] = true;
                }
                if (def.hasOwnProperty("expired.1")) {
                    CACHE_POOL["1"].registerExpiredTime(fullKey, def["expired.1"]);
                }
                if (def.hasOwnProperty("expired.2")) {
                    CACHE_POOL["2"].registerExpiredTime(fullKey, def["expired.2"]);
                }
                if (def.level > 2) {
                    SAVE_LEVEL_MAPPING[fullKey] = String(def.level);
                    READ_LEVEL_MAPPING[fullKey] = String(def.level);
                } else {
                    if (def.level == 1) {
                        SAVE_LEVEL_MAPPING[fullKey] = "1";
                    } else {
                        SAVE_LEVEL_MAPPING[fullKey] = "2";
                    }

                    if (def.level == 2) {
                        READ_LEVEL_MAPPING[fullKey] = "2";
                    } else {
                        READ_LEVEL_MAPPING[fullKey] = "1";
                    }
                }
            }
        }

        cb();
    });
    if (option.db) {
        q.push(function(cb) {
            exports.openDB(option.db, true, function(err) {
                cb(err);
            });
        });
    }
    if (option.redis) {
        q.push(function(cb) {
            if (option.cache) option.redis.cache = option.cache;
            redis.start(option.redis, function(err) {
                cb(err);
            });
        });
    }
    q.push(function(cb) {
        memory.init(option.cache || {}, cb);
    });
    Utils.runQueueTask(q, function(err) {
        callBack && callBack(err);
    });

    CACHE_POOL[2].addEventListener("save", syncUpLevelCacheHandler);
}

exports.registerCacheSystem = function(level, system) {
    CACHE_POOL[level] = system;
}

function syncUpLevelCacheHandler(event) {
    var key = arguments[0];
    var originalKey = arguments[1];
    var val = arguments[2];

    //console.log("sync cache event ---> " + key, "    originalKey --> ", originalKey);
    var tempKey = originalKey;
    if (originalKey instanceof Array) tempKey = originalKey[0];
    if (!SYNC_UP_LEVEL_CACHE[tempKey]) return;

    CACHE_POOL[1].save(originalKey, val);
}

exports.generateIncrementalID = function(group, callBack) {
    var key = redis.join("incremental_id");
    return redis.do("HINCRBY", [ key, group, 1 ], callBack);
}

exports.registerCacheExpiredTime = function(key, expired, level) {
    CACHE_POOL[level].registerExpiredTime(key, expired);
}

exports.cacheRead = function(key) {
    var level = arguments[1] && !isNaN(Number(arguments[1])) ? arguments[1] : undefined;
    var callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
    if (typeof callBack != "function") callBack = undefined;

    var fullKey = key;
    var originalKey = key;
    var tempKey = key;
    if (key instanceof Array) {
        tempKey = key[0];
    }

    if (isNaN(level) || level === 0) {
        level = READ_LEVEL_MAPPING[tempKey];
    }

    if (isNaN(level)) level = 1;

    if (level == 1 && SYNC_UP_LEVEL_CACHE[tempKey]) {
        var c = CACHE_POOL[1].read(originalKey);
        if (c) {
            return new Promise(function (resolve) {
                if (callBack) return callBack(null, c);
                resolve(c);
            });
        } else {
            //console.log("read from deeper cache...");
            return new Promise(function(resolve, reject) {
                CACHE_POOL[2].read(originalKey, function(err, c2) {
                    if (err) {
                        if (callBack) return callBack(err);
                        reject(err);
                    } else {
                        //console.log("update level 1 cache...");
                        CACHE_POOL[1].save(originalKey, c2);
                        if (callBack) return callBack(null, c2);
                        resolve(c2);
                    }
                });
            });
        }
    } else {
        return CACHE_POOL[level].read(originalKey, callBack);
    }
}

exports.cacheSave = function(key, val) {
    var expired = isNaN(Number(arguments[2])) ? undefined : arguments[2];
    var level = isNaN(Number(arguments[3])) ? undefined : arguments[3];
    var callBack = arguments.length  > 2 ? arguments[arguments.length - 1] : undefined;
    if (typeof callBack != "function") callBack = undefined;

    if (level === 0) {
        SYNC_UP_LEVEL_CACHE[key instanceof Array ? key[0] : key] = true;
        level = 2;
    }

    if (isNaN(level)) {
        if (typeof key == "string") {
            level = SAVE_LEVEL_MAPPING[key];
        } else {
            level = SAVE_LEVEL_MAPPING[key[0]];
        }
    }
    if (isNaN(level)) level = 1;
    return CACHE_POOL[level].save(key, val, expired, callBack);
}

exports.cacheRemove = function(key) {
    var level = arguments[1] && !isNaN(Number(arguments[1])) ? arguments[1] : undefined;
    var callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
    if (typeof callBack != "function") callBack = undefined;

    var tempKey = key;
    if (key instanceof Array) tempKey = key[0];
    if (SYNC_UP_LEVEL_CACHE[tempKey]) {
        CACHE_POOL[1].remove(key);
        return CACHE_POOL[2].remove(key, callBack);
    }

    return CACHE_POOL[level ? level : 1].remove(key, callBack);
}

exports.setExpireTime = function(key, time, level) {
    CACHE_POOL[level ? level : 1].setExpireTime(key, time);
}

exports.refreshExpireTime = function(key, level) {
    var tempKey;
    if (typeof key == "object") {
        tempKey = key[0];
    }
    var def = CACHE_CONFIG.general[tempKey];
    if (!def) return;

    if (isNaN(level)) {
        if (def.level == 2 || def.level == 0) {
            level = 2;
        }
    }
    if (isNaN(level)) level = 1;
    var time = def["expired." + level];
    if (!time) return;
    //console.log("cache expire time refresh --> " + time);
    CACHE_POOL[level].setExpireTime(key, time);
}

var DBInstance = function(name) {
    this.name = name;

    this.insert = function() {
        return db.insert.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.insertList = function() {
        return db.insertList.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.find = function() {
        return db.find.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.findOne = function() {
        return db.findOne.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.findPage = function() {
        return db.findPage.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.aggregate = function() {
        return db.aggregate.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.findOneAndUpdate = function() {
        return db.findOneAndUpdate.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.findOneAndDelete = function() {
        return db.findOneAndDelete.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.ensureIndex = function() {
        return db.ensureIndex.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.listAllCollections = function() {
        return db.listAllCollections.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.count = function() {
        return db.count.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.update = function() {
        return db.update.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
    this.remove = function() {
        return db.remove.apply(db, [ this.name ].concat(Array.prototype.slice.call(arguments)));
    }
};

exports.DB = { __dbs:{} };

exports.openDB = function(config, asDefault, callBack) {
    return new Promise(function (resolve, reject) {
        db.open(config.host,
            config.port,
            config.name,
            config.option,
            function(err, db) {
                if (db) {
                    var ins = new DBInstance(asDefault ? null : config.name);
                    if (asDefault) {
                        ins.__dbs = exports.DB.__dbs;
                        exports.DB = ins;
                    } else {
                        exports.DB.__dbs[config.name] = ins;
                        exports.DB[config.name] = ins;
                    }
                }
                if (callBack) return callBack(err, db);
                if (err) {
                    reject(err);
                } else {
                    resolve(db);
                }
            }, asDefault ? true : false);
    });
}

exports.closeDB = function(name, callBack) {
    if (!db) {
        if (callBack) callBack();
        return;
    }
    db.close(name, function(err) {
        if (name) {
            delete exports.DB.__dbs[name];
            delete exports.DB[name];
        } else {
            var removes = [];
            for (var prop in exports.DB) {
                if (prop != "__dbs") {
                    removes.push(prop);
                }
            }
            removes.forEach(function (prop) {
                delete exports.DB[prop];
            });
        }
        if (callBack) callBack(err);
    });
}

exports.getDBByName = function(name) {
    return db.getDBByName(name);
}

// If the Node process ends, close all db connections
process.on('SIGINT', function() {
    if (db) {
        db.closeAll(function () {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});
