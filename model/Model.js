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
            for (var key in defs) {
                var def = defs[key];
                if (def.hasOwnProperty("expired.1")) {
                    CACHE_POOL["1"].registerExpiredTime(key, def["expired.1"] * 1000);
                    if (def.level == 0) {
                        SYNC_UP_LEVEL_CACHE[key] = true;
                    }
                }
                if (def.hasOwnProperty("expired.2")) {
                    CACHE_POOL["2"].registerExpiredTime(key, def["expired.2"]);
                }
                if (def.level > 2) {
                    SAVE_LEVEL_MAPPING[key] = String(def.level);
                    READ_LEVEL_MAPPING[key] = String(def.level);
                } else {
                    if (def.level == 1) {
                        SAVE_LEVEL_MAPPING[key] = "1";
                    } else {
                        SAVE_LEVEL_MAPPING[key] = "2";
                    }

                    if (def.level == 2) {
                        READ_LEVEL_MAPPING[key] = "2";
                    } else {
                        READ_LEVEL_MAPPING[key] = "1";
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
            redis.start(option.redis, function(err) {
                cb(err);
            });
        });
    }
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
    if (!SYNC_UP_LEVEL_CACHE[key]) return;

    var originalKey = arguments[1];
    var val = arguments[2];

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

    var tempKey = key;
    var originalKey = key;
    if (isNaN(level)) {
        if (typeof key == "string") {
            level = READ_LEVEL_MAPPING[key];
        } else {
            tempKey = key[0];
            level = READ_LEVEL_MAPPING[tempKey];
        }
    }
    if (isNaN(level)) level = 1;

    if (level == 1 && SYNC_UP_LEVEL_CACHE[tempKey]) {
        var c = CACHE_POOL[1].read(key);
        if (c) {
            return new Promise(function (resolve) {
                callBack && callBack(c);
                resolve(c);
            });
        } else {
            //console.log("read from deeper cache...");
            return CACHE_POOL[2].read(key, function(c2, err) {
                if (err) {
                    if (callBack) callBack(null, err);
                } else {
                    //console.log("update level 1 cache...");
                    CACHE_POOL[1].save(originalKey, c2);
                    if (callBack) callBack(c2);
                }
            });
        }
    } else {
        return CACHE_POOL[level].read(key, callBack);
    }
}

exports.cacheSave = function(key, val) {
    var expired = isNaN(Number(arguments[2])) ? undefined : arguments[2];
    var level = isNaN(Number(arguments[3])) ? undefined : arguments[3];
    var callBack = arguments.length  > 2 ? arguments[arguments.length - 1] : undefined;
    if (typeof callBack != "function") callBack = undefined;

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

exports.cacheRemove = function(key, callBack, level) {
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
                callBack(err, db);
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

// If the Node process ends, close all db connections
process.on('SIGINT', function() {
    if (db) {
        db.closeAll(function () {
            process.exit(0);
        });
    }
});
