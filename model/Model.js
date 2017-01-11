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
            db.open(option.db.host,
                option.db.port,
                option.db.name,
                option.db.option,
                function(err) {
                    cb(err);
                }, true);
        });
    }
    if (option.redis) {
        q.push(function(cb) {
            redis.start(option.redis.host,
                option.redis.port,
                option.redis.pass,
                option.redis.prefix,
                function(err) {
                    cb(err);
                });
        });
    }
    Utils.runQueueTask(q, function(err) {
        callBack(err);
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
    redis.do("HINCRBY", [ key, group, 1 ], callBack);
}

exports.registerCacheExpiredTime = function(key, expired, level) {
    CACHE_POOL[level].registerExpiredTime(key, expired);
}

exports.cacheRead = function(key, callBack, level) {
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
            if (callBack) callBack(c);
            return c;
        }
        else {
            //console.log("read from deeper cache...");
            CACHE_POOL[2].read(key, function(c2, err) {
                if (err) {
                    if (callBack) callBack(null, err);
                } else {
                    //console.log("update level 1 cache...");
                    CACHE_POOL[1].save(originalKey, c2);
                    if (callBack) callBack(c2);
                }
            });
            return null;
        }
    } else {
        return CACHE_POOL[level].read(key, callBack);
    }
}

exports.cacheSave = function(key, val, expired, callBack, level) {
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
    CACHE_POOL[level ? level : 1].remove(key, callBack);
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

  exports.insert = function() {
    db.insert.apply(db, arguments);
}
exports.insertList = function() {
    db.insertList.apply(db, arguments);
}
exports.find = function() {
    db.find.apply(db, arguments);
}
exports.findOne = function() {
    db.findOne.apply(db, arguments);
}
exports.findPage = function() {
    db.findPage.apply(db, arguments);
}
exports.custom = function() {
    db.custom.apply(db, arguments);
}
exports.aggregate = function() {
    db.aggregate.apply(db, arguments);
}
exports.findAndModify = function() {
    db.findAndModify.apply(db, arguments);
}
exports.ensureIndex = function() {
    db.ensureIndex.apply(db, arguments);
}
exports.listAllCollections = function() {
    db.listAllCollections.apply(db, arguments);
}
exports.count = function() {
    db.count.apply(db, arguments);
}
exports.update = function() {
    db.update.apply(db, arguments);
}
exports.remove = function() {
    db.remove.apply(db, arguments);
}

exports.openDB = function(config, callBack, asDefault) {
    db.open(config.host,
            config.port,
            config.name,
            config.option,
            function(err, db) {
                callBack(err, db);
            }, asDefault ? true : false);
}

exports.closeDB = function(name, callBack) {
    if (!db) {
        if (callBack) callBack();
        return;
    }
    db.close(name, function(err) {
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
