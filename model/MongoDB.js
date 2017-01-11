/**
 * Created by Jay on 2015/8/24.
 */

var dbOption = {
    w:-1,
    logger:{
        doDebug:true,
        debug:function(msg,obj){
            console.log('[debug]',msg);
        },
        log:function(msg,obj){
            console.log('[log]',msg);
        },
        error:function(msg,obj){
            console.log('[error]',msg);
        }
    }
};


var dbMap = {};

var defaultDB;

function open(host, port, name, option, callBack, asDefault) {
    var auth = option ? option.auth : null;

    var driver = option && option.driver ? option.driver : "native";
    var poolSize = option && option.server && option.server.poolSize ? option.server.poolSize : 'default';

    var newDB;
    var done = function(err) {
        if (newDB) {
            dbMap[name] = newDB;
            if (asDefault) defaultDB = newDB;
            console.log("Database connection[" + name + "] init completed.   [default:" + asDefault + ", driver: " + driver + ", poolSize: " + poolSize + "]");
        }

        if (callBack) {
            callBack(err, newDB);
        }
    }

    if (option && option.driver == "mongoose") {
        var mongoose = require("mongoose");
        newDB = mongoose.createConnection("mongodb://" + host + ":" + port + "/" + name, option);
        process.nextTick(done);
    } else {
        var MongoClient = require("mongodb").MongoClient;
        MongoClient.connect("mongodb://" + host + ":" + port + "/" + name, option, function(err, db) {
            if (db) newDB = db;
            done(err);
        });
        /*
        newDB = new mongodb.Db(name, new mongodb.Server(host, port, option), dbOption);
        newDB.open(function(err, db){
            if (err) {
                console.error(err);
                delete dbMap[name];
                if (callBack) {
                    callBack(false, err);
                }
            } else {

                if (auth) {
                    db.authenticate(auth[0], auth[1], function(err, res) {
                        console.log("db.authenticate ----> ");
                        console.log(arguments);
                        done();
                    });
                } else {
                    done();
                }
            }
        });
        */
    }
    //return newDB;
}

function getDBByName(dbName) {
    return dbName ? dbMap[dbName] : defaultDB;
}

function insert(dbName, target, data, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, createNotOpenErr(dbName));
        }
        return;
    }

    db.collection(target).save(data, {upsert:true}, function(err, res){
        if (err) console.error(err);
        if (callBack) {
            callBack(res ? res : {}, err);
        }
    });
}

function insertList(dbName, target, list, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, createNotOpenErr(dbName));
        }
        return;
    }

    db.collection(target).insert(list, function(err, res){
        if (err) {
            console.error(err);
        }
        if (callBack) {
            callBack(res ? res : [], err);
        }
    });
}

function find(dbName, target, callBack, filter, fields, sort, pagination) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    var args = [];
    args.push(filter ? filter : {});
    var opt = {};
    if (fields) opt.fields = fields;
    if (sort) opt.sort = sort;
    if (pagination)  {
        opt.limit = pagination.num;
        if (pagination.index > 0) opt.skip = pagination.index * opt.limit;
    }
    args.push(opt);
    args.push(function(err1, cursor) {
        if (err1) {
            console.error(target + ".find failed ==> " + err1);
            if (callBack) {
                callBack(null, err1);
            }
            return;
        }
        cursor.toArray(function(err2, items) {
            if (err2) console.error(target + ".find.toArray failed ==> " + err2);
            //console.log(target + ".find complete ==> items.length: " + (items ? items.length : 0));
            if (callBack) {
                callBack(items, err2);
            }
        });
    });
    targetCol.find.apply(targetCol, args);
}

function findOne(dbName, target, callBack, filter, fields) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    var args = [];
    args.push(filter ? filter : {});
    if (fields) args.push(fields);
    args.push(function(err, obj) {
        if (err) console.error(target + ".findOne failed ==> " + err);
        if (callBack) {
            callBack(obj, err);
        }
    });
    targetCol.findOne.apply(targetCol, args);
}

function findPage(dbName, target, startIndex, pageNum, callBack, filter, fields, sort) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, -1, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);

    filter = filter ? filter : {};

    var cursor = targetCol.find(filter, {fields:fields});
    cursor.count(function(err, totalNum) {
        if (err) {
            if (callBack) {
                callBack(null, -1, err);
            }
        } else {
            if (sort) {
                cursor = cursor.sort(sort);
            }
            cursor.skip(parseInt(startIndex) * parseInt(pageNum)).limit(parseInt(pageNum)).toArray(function(err, items) {
                if (err) console.error(target + ".find.sort.skip.limit.toArray failed ==> " + err);
                if (callBack) {
                    callBack(items, totalNum, err);
                }
            });
        }
    });
}

function count(dbName, target, callBack, filter) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(0, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    targetCol.count(filter ? filter : {},
        function(err, count) {
            if (err) console.error(target + ".count failed ==> " + err);
            if (callBack) {
                callBack(err ? 0 : count, err);
            }
        });
}

function custom(dbName, func, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, createNotOpenErr(dbName));
        }
        return;
    }
    func(db, function() {
        if (callBack) callBack.apply(this, arguments);
    });
}

/*
*
* db.Test.aggregate
 ([
 {$unwind:'$list'},
 {$match:{ 'list.id':1 }},
 {$group:{_id:'$_id', score:{$push:'$list'}}}
 ])
*
* */

function aggregate(dbName, target, operation, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, createNotOpenErr(dbName));
        }
        return;
    }
    var targetCol = db.collection(target);
    targetCol.aggregate(operation, function(err, res) {
        if (err) console.error(target + ".aggregate failed ==> err: " + err + "      args: " + operation ? JSON.stringify(operation) : "null");
        if (callBack) callBack(res, err);
    });
}

function processUpdateParams(params) {
    var changes = {};
    var hasSets = false;
    var sets;
    if (params["$set"]) {
        sets = params["$set"];
        hasSets = true;
    } else {
        sets = {};
    }

    for (var key in params) {
        if (key == "$set") continue;

        if (key.charAt(0) == "$") {
            changes[key] = params[key];
        } else {
            sets[key] = params[key];
            hasSets = true;
        }
    }
    if (hasSets) {
        changes["$set"] = sets;
    }
    return changes;
}

function update(dbName, target, filter, params, callBack, upsert, justOne) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(0, createNotOpenErr(dbName));
        }
        return;
    }
    var targetCol = db.collection(target);

    var changes = processUpdateParams(params);

    targetCol.update(filter,
        changes,
        {upsert:upsert ? true : false, multi:justOne ? false : true, w:1},
        function(err, result) {
            if (err) console.error(target + ".update failed ==> " + err);
            var numUp = 0;
            try {
                if (typeof result == "object") {
                    numUp = result && result.result && result.result.n ? parseInt(result.result.n) : 0;
                } else {
                    numUp = parseInt(result);
                }
            } catch (exp) {
                numUp = 0;
            }
            if (callBack) {
                callBack(numUp, err);
            }
        });
}

function updateOne(dbName, target, filter, params, callBack, upsert) {
    update(dbName, target, filter, params, callBack, upsert, true);
}

function findAndModify(dbName, target, filter, params, callBack, options) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(0, createNotOpenErr(dbName));
        }
        return;
    }
    var targetCol = db.collection(target);

    var changes = processUpdateParams(params);

    options = options || { upsert:false, multi:false, w:1 };
    var sort = options.sort || null;
    delete options["sort"];

    targetCol.findAndModify(filter, sort, changes, options,
        function(err, result) {
            if (err) console.error(target + ".update failed ==> " + err);
            var doc = null;
            try {
                if (typeof result == "object") {
                    doc = result.value;
                }
            } catch (exp) {
                doc = null;
            }
            if (callBack) {
                callBack(doc, err);
            }
        });
}

function ensureIndex(dbName, target, key, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);

    var indexes;
    if (typeof key == 'object') {
        indexes = key;
    } else {
        indexes = {};
        indexes[key] = 1;
    }
    targetCol.ensureIndex(indexes, function() {
        if (callBack) callBack.apply(targetCol, arguments);
    });
}

function remove(dbName, target, filters, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(0, createNotOpenErr(dbName));
        }
        return;
    }

    var targetCol = db.collection(target);
    targetCol.remove.apply(targetCol, filters.concat([{w:1},
        function(err, result) {
            var removedNum = 0;
            if (err) {
                console.error(target + ".remove failed ==> " + err);
            } else {
                if (typeof result == "object") {
                    removedNum = result && result.result && result.result.n ? parseInt(result.result.n) : 0;
                } else {
                    removedNum = parseInt(result);
                }
                //console.log(target + ".remove " + removedNum + " docs from " + target + ".");
            }

            if (callBack) {
                callBack(removedNum, err);
            }
        }]));
}

function listAllCollections(dbName, callBack) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(null, createNotOpenErr(dbName));
        }
        return;
    }

    db.collections(function() {
        if (callBack) callBack(arguments[1]);
    });
}

function close(dbName, callBack, delay) {
    var db = getDBByName(dbName);

    if (!db) {
        if (callBack) {
            callBack(false, createNotOpenErr(dbName));
        }
        return;
    }

    delay = delay >= 0 ? delay : 500;

    db.close(function(err) {
        setTimeout(function() {
            if (err) {
                console.error(err);
                if (callBack) {
                    callBack(false, err);
                }
            } else {

                delete dbMap[dbName];

                console.log("DBModel connection[" + dbName + "] has been closed.");
                if (callBack) {
                    callBack(true);
                }
            }
        }, delay);
    });
}

function closeAll(callBack) {
    var dbs = [];
    for (var dbName in dbMap) {
        dbs.push(dbName);
    }

    var closed = 0;
    dbs.forEach(function(dbName) {
        close(dbName, function() {
            closed ++;
            if (closed >= dbs.length) {
                if (callBack) callBack();
            }
        }, 0);
    });

    if (dbs.length <= 0) {
        process.nextTick(function() {
            if (callBack) callBack();
        });
    }
}

function isOpen(dbName) {
    return dbMap[dbName] ? true : false;
}

function createNotOpenErr(dbName) {
    return new Error("DBModel connection[" + dbName + "] is not opened.");
}


exports.getDBByName = getDBByName;
exports.open = open;
exports.close = close;
exports.closeAll = closeAll;
exports.isOpen = isOpen;
exports.insert = insert;
exports.insertList = insertList;
exports.find = find;
exports.findOne = findOne;
exports.findPage = findPage;
exports.custom = custom;
exports.aggregate = aggregate;
exports.ensureIndex = ensureIndex;
exports.listAllCollections = listAllCollections;
exports.count = count;
exports.update = update;
exports.updateOne = updateOne;
exports.findAndModify = findAndModify;
exports.remove = remove;

