/**
 * Created by Jay on 2016/3/4.
 */
var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var PATH = require("path");
var FS = require("fs");

var CODES = require("../ErrorCodes");

var Utils = require("../utils/Utils");
var Model = require("../model/Model");
var Redis = require("../model/Redis");

var mongooseInstance;

var defs = {};

var ignoreFolder = [
    ".git", ".svn", ".idea", ".gitignore", "node_moduels"
];


var doRegisterSchema = function(path, file) {
    var fullPath = PATH.join(path, file);
    var isMongooseSchema = file.indexOf("Schema.js") > 0;
    var name = file.replace("Schema.js", "").replace("DAO.js", "");
    var module = require(fullPath);
    if (isMongooseSchema) {
        defs[name] = module();
    } else {
        defs[name] = {
            name: name,
            ref: module
        };
    }
    defs[name].isNotMongooseSchema = !isMongooseSchema;
}

var checkFolder = function(path, handler) {
    if (path == __filename || path.indexOf(".svn") > 0) return;
    var files = FS.readdirSync(path);
    files.forEach(function(rf) {
        if (ignoreFolder.indexOf(rf) >= 0) return;
        if (rf.indexOf("Schema.js") > 0 || rf.indexOf("DAO.js") > 0) {
            handler(path, rf);
        } else {
            checkFolder(PATH.join(path, rf), handler);
        }
    });
}

exports.Schema = Schema;

exports.init = function(owner) {
    owner = owner || Model.getDBByName();
    mongooseInstance = owner;
    var option = typeof arguments[1] == "function" ? {} : arguments[1];
    var callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
    if (typeof callBack != "function") callBack = null;

    var q = [];

    //init routers
    checkFolder(option.folder || PATH.join(global.APP_ROOT, "server/dao"), doRegisterSchema);

    for (var key in defs) {
        (function(key) {
            q.push(function (cb) {
                exports.registerSchema(defs[key], function (err) {
                    cb(err);
                });
            });
        })(key);
    }

    runAsQueue(q, function(err) {
        callBack && callBack(err);
    });
}

function inject(schema) {
    schema.static("getByID", function(id, fields, callBack) {
        callBack = arguments[arguments.length - 1];
        if (typeof callBack != "function") callBack = null;
        fields = typeof fields == "object" || typeof fields == "string" ? fields : null;

        var ins = this;
        return new Promise(function(resolve, reject) {
            ins.findOne({ _id:id }, fields, function (err, doc) {
                if (callBack) return callBack(err, doc);
                err ? reject(err) : resolve(doc);
            });
        });
    });

    schema.static("updateByID", function(id, ups, callBack) {
        var ins = this;
        return new Promise(function(resolve, reject) {
            ins.update({ _id:id }, ups, function (err, result) {
                if (callBack) return callBack(err, result);
                err ? reject(err) : resolve(result);
            });
        });
    });

    schema.static("exist", function(filter, callBack) {
        var ins = this;
        return new Promise(function(resolve, reject) {
            ins.findOne(filter, "_id", function(err, obj) {
                var exist = obj ? true : false;
                if (callBack) return callBack(err, exist);
                err ? reject(err) : resolve(exist);
            });
        });
    });

    schema.static("findAll", function(filter, fields, callBack) {
        callBack = arguments[arguments.length - 1];
        if (typeof callBack != "function") callBack = null;
        fields = typeof fields == "object" || typeof fields == "string" ? fields : null;

        var ins = this;
        return new Promise(function (resolve, reject) {
            var PAGE_SIZE = 1000;
            var data = [];
            var loop = function(pageIndex) {
                ins.find(filter).select(fields).skip(pageIndex * PAGE_SIZE).limit(PAGE_SIZE)
                    .exec(function(err, doc) {
                        doc = doc || [];
                        if (doc.length > 0) data = data.concat(doc);
                        if (!err && doc.length >= PAGE_SIZE) {
                            loop(pageIndex + 1);
                        } else {
                            if (callBack) return callBack(err, data);
                            err ? reject(err) : resolve(data);
                        }
                    });
            }

            loop(0);
        });
    });

    schema.static("$lock", function(identifyID, callBack) {
        var lockKey = "@common->dblock_" + schema.$CollectionName + "_" + identifyID;
        return Redis.checkLock(lockKey, callBack);
    });

    schema.static("$releaseLock", function(identifyID, callBack) {
        var lockKey = "@common->dblock_" + schema.$CollectionName + "_" + identifyID;
        return Redis.releaseLock(lockKey, callBack);
    });

    schema.static("search", function(filter) {
        var ins = this;
        var query;
        var result = {};
        var option = typeof arguments[1] == "function" ? {} : arguments[1];
        var callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
        if (typeof callBack != "function") callBack = null;

        return new Promise(function (resolve, reject) {
            var q = [];
            if (option.needTotal) {
                q.push(function(cb) {
                    query = ins.count(filter, function(err, total) {
                        if (err) cb(err);
                        else {
                            query = query.find();
                            cb(null, total);
                        }
                    });
                });
            } else {
                q.push(function(cb) {
                    query = ins.find(filter);
                    cb(null, -1);
                });
            }

            q.push(function(total, cb) {
                query.select(option.fields);
                if (option.sort) {
                    query.sort(option.sort);
                }
                if (option.pagination) {
                    var index = Number(option.pagination.index);
                    index = Math.max(index, 0);

                    var num = Number(option.pagination.num);
                    num = Math.min(num, 1000);
                    num = Math.max(num, 0);

                    result.pagination = { index:index, num:num };

                    if (index == 0) {
                        query.limit(num);
                    } else {
                        query.skip(index * num).limit(num);
                    }
                }
                query.exec(function(err, list) {
                    if (err) {
                        cb(err);
                    } else {
                        result.list = list || [];
                        if (option.toObject) {
                            result.list = JSON.parse(JSON.stringify(result.list));
                        }
                        if (total >= 0) result.total = total;
                        cb(null, result);
                    }
                });
            });

            runAsQueue(q, function(err, result) {
                if (err) {
                    err = err.code ? err : Error.create(CODES.DB_ERROR, err);
                    if (callBack) return callBack(err);
                    reject(err);
                } else {
                    if (callBack) return callBack(null, result);
                    resolve(result);
                }
            });
        });
    });
}

exports.releaseDBLocks = function(callBack) {
    console.log("release db locks...");
    var prefix = Redis.join("@common->dblock");
    var key = prefix + "_*";
    return Redis.findKeysAndDel(key, callBack);
}

exports.create = function(name) {
    var ins = new exports[name]();
    var params = arguments[1] ? arguments[1] : null;
    if (params) {
        for (var prop in params) {
            ins[prop] = params[prop];
        }
    }
    return ins;
}

exports.registerSchema = function(defination, callBack) {
    var owner = mongooseInstance;
    var q = [];

    var key = defination.name;

    var list = [];
    if (defination instanceof Array) {
        list = list.concat(defination);
    } else {
        list.push(defination);
    }

    list.forEach(function(def) {
        if (!def.isNotMongooseSchema) {
            inject(def.ref);
            var model = owner.model(def.name, def.ref);
            def.ref.$ModelClass = model;
            def.ref.$Factory = exports;
            def.ref.$CollectionName = def.name;
            exports[def.name] = model;

            global.__defineGetter__(def.name, function() {
                return model;
            });

            if (def.hasOwnProperty("firstUUID") && def.firstUUID > 0) {
                q.push(function(cb) {
                    Redis.getHash("incremental_id", def.name, function(err, currentUUID) {
                        cb(err, currentUUID);
                    });
                });
                q.push(function(current, cb) {
                    //return cb();
                    current = Number(current) || 0;
                    if (current >= def.firstUUID) return cb();
                    var redisTasks = [];
                    redisTasks.push([ "HDEL", Redis.join("incremental_id"), def.name ]);
                    redisTasks.push([ "HINCRBY", Redis.join("incremental_id"), def.name, Number(def.firstUUID) ]);
                    Redis.multi(redisTasks, function(err) {
                        if (err) console.error(`init *${def.name}* incremental id error: ${err}`);
                        cb(err);
                    });
                });
            }

        } else {
            var dao = def.ref;
            global.__defineGetter__(def.name, function() {
                return dao;
            });
        }
    });

    runAsQueue(q, function (err) {
        callBack && callBack(err);
    });
}