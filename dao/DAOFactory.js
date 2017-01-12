/**
 * Created by Jay on 2016/3/4.
 */
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;

var Schema = mongoose.Schema;

var PATH = require("path");
var FS = require("fs");

var CODES = require("../ErrorCodes");

var Utils = require("../utils/Utils");
var Redis = require("../model/Redis");

var defs = {};

var doRegisterSchema = function(path, file) {
    var fullPath = PATH.join(path, file);
    var isMongooseSchema = file.indexOf("Schema.js") > 0;
    var name = file.replace("Schema.js", "").replace("DAO.js", "");
    defs[name] = { isMongooseSchema:isMongooseSchema, ref:require(fullPath) };
}

var checkFolder = function(path, handler) {
    if (path == __filename || path.indexOf(".svn") > 0) return;
    var files = FS.readdirSync(path);
    files.forEach(function(rf) {
        if (rf.indexOf("Schema.js") > 0 || rf.indexOf("DAO.js") > 0) {
            handler(path, rf);
        } else {
            checkFolder(PATH.join(path, rf), handler);
        }
    });
}

//init routers
checkFolder(PATH.dirname(module.filename), doRegisterSchema);

exports.init = function(owner) {
    for (var key in defs) {
        if (defs[key].isMongooseSchema) {
            var scDef = defs[key].ref();
            var list = [];
            if (!scDef.hasOwnProperty("length")) {
                list.push(scDef);
            } else {
                list = list.concat(scDef);
            }
            list.forEach(function(def) {
                inject(def.ref);
                var model = owner.model(def.name, def.ref);
                def.ref.$ModelClass = model;
                def.ref.$Factory = exports;
                def.ref.$CollectionName = def.name;
                exports[def.name] = model;

                global.__defineGetter__(def.name, function() {
                    return model;
                });
            });
        } else {
            (function(prop) {
                var dao = defs[prop].ref;
                global.__defineGetter__(prop, function() {
                    return dao;
                });
            })(key);
        }
    }
}

function inject(schema) {
    schema.static("getByID", function(id, fields, callBack) {
        this.findOne({ _id:id }, fields, callBack);
    });

    schema.static("updateByID", function(id, ups, callBack) {
        this.update({ _id:id }, ups, callBack);
    });

    schema.static("exist", function(filter, callBack) {
        this.findOne(filter, "_id", function(err, obj) {
            if (err) callBack(err);
            else callBack(null, obj ? true : false);
        });
    });

    schema.static("findAll", function(filter, fields, callBack) {
        var ins = this;
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
                        callBack(err, data);
                    }
                });
        }

        loop(0);
    });

    schema.static("$lock", function(identifyID, callBack) {
        Redis.do("SETNX", [ Redis.join("@common->dblock_" + schema.$CollectionName + "_" + identifyID), Date.now() ], function(res, err) {
            if (err) {
                if (callBack) callBack(Error.create(CODES.REDIS_ERROR, err.toString()));
            } else {
                var isLocked = res == 0;
                //if (isLocked) console.log("db *" + schema.$CollectionName + "* is locked...");
                if (callBack) callBack(null, isLocked);
            }
        });
    });

    schema.static("$releaseLock", function(identifyID, callBack) {
        Redis.del("@common->dblock_" + schema.$CollectionName + "_" + identifyID, function(flag, redisErr, removedNum) {
            if (redisErr) console.error("release db *" + schema.$CollectionName + "* lock error ---> " + redisErr.toString());
            //else console.log("db *" + schema.$CollectionName + "* is released lock...");
            if (callBack) callBack();
        });
    });

    schema.static("$doLater", function(trigger, payload) {
        setTimeout(function() {
            payload.callee.apply(trigger, Array.prototype.slice.call(payload, 0));
        }, 10);
    });

    schema.static("search", function(filter) {
        var query;
        var ins = this;
        var result = {};
        var option = arguments[1] && typeof arguments[1] == "object" ? arguments[1] : { };
        var callBack;
        if (arguments[1] && typeof arguments[1] == "function") {
            callBack = arguments[1];
        } else if (arguments[2] && typeof arguments[2] == "function") {
            callBack = arguments[2];
        } else {
            throw Error("search method should have callback argument.");
        }

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
                    if (total >= 0) result.total = total;
                    cb(null, result);
                }
            });
        });

        Utils.runQueueTask(q, function(err, result) {
            if (err) {
                callBack(err.code ? err : Error.create(CODES.DB_ERROR, err));
            } else {
                callBack(null, result);
            }
        });
    });
}

exports.releaseDBLocks = function(callBack) {
    console.log("release db locks...");
    var prefix = Redis.join("@common->dblock");
    var key = prefix + "_*";
    Redis.do("keys", [ key ], function(res, err) {
        if (res) {
            var keys = res || [];
            if (keys.length <= 0) {
                callBack();
                return;
            }
            var count = 0;
            keys.forEach(function(key) {
                console.log('release db lock ---> ' + key.replace(prefix, ""));
                Redis.do('del', [ key ], function(reply0, err0) {
                    count ++;
                    if (err0) console.error('redis del key error ==> ' + err0);
                    if (count >= keys.length) {
                        callBack();
                    }
                });
            });
        } else {
            callBack(err);
        }
    });
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