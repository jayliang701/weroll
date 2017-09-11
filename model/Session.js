/**
 * Created by Jay on 2015/8/27.
 */
var Memory = require("./MemoryCache");
var Redis = require("./Redis");
var Utils = require("../utils/Utils");

function Session() {
    if (!Session.$instance) Session.$instance = this;
    this.config = {};
}

Session.prototype.init = function(params) {
    this.config = params || {};
    this.config.prefix = this.config.prefix || "";
    var ins = this;
    if (this.config.onePointEnter) {
        this.formatKey = function(id, token) {
            return ins.config.prefix + "user_sess_" + id;
        }
        this.checkSess = function(id, token, sess) {
            return sess.userid == id && sess.token == token;
        }
    } else {
        this.formatKey = function(id, token) {
            return ins.config.prefix + "user_sess_" + id + "_" + token;
        }
        this.checkSess = function(id, token, sess) {
            return true;
        }
    }
}

Session.prototype.save = function(user, callBack) {

    var userID = (user.id ? user.id : user.userid) || user._id;
    var tokentimestamp = Date.now();

    var sess = {};
    sess.userid = userID;
    sess.token = user.token || Utils.randomString(16);
    sess.tokentimestamp = tokentimestamp;
    sess.type = user.type;
    var extra = user.extra;
    if (user.extra) {
        sess.extra = (typeof user.extra == "string") ? user.extra : JSON.stringify(user.extra);
    }

    var key = this.formatKey(sess.userid, sess.token);

    var ins = this;
    return new Promise(function (resolve, reject) {
        Redis.setHashMulti(key, sess, ins.config.tokenExpireTime).then(function() {
            sess.extra = extra;
            Memory.save(key, sess, ins.config.cacheExpireTime, null);
            if (callBack) return callBack(null, sess);
            resolve(sess);
        }).catch(function(redisErr) {
            if (callBack) return callBack(redisErr);
            reject(redisErr);
        });
    });
}

Session.prototype.remove = function(user, callBack) {
    var id = (user.id ? user.id : user.userid) || user._id;
    var key = this.formatKey(id, user.token);
    Memory.remove(key);
    return new Promise(function (resolve, reject) {
        Redis.del(key, function(err) {
            if (callBack) return callBack(err);
            err ? reject(err) : resolve();
        });
    });
}

Session.prototype.removeByID = function(id, callBack) {
    var ins = this;
    var redisKey = Redis.join(ins.config.prefix + "user_sess_" + id);
    var q = [];

    if (!ins.config.onePointEnter) {
        q.push(function(cb) {
            Redis.do("keys", [ Redis.join(ins.config.prefix + "user_sess_" + id + "_*") ], function(err, keys) {
                if (err) return cb(err);
                keys = keys || [];
                redisKey = keys[0];
                cb();
            });
        });
    }
    q.push(function(cb) {
        if (redisKey) {
            Redis.getHashAll("user_sess_" + id, function(err, sess) {
                if (err) return cb(err);

                var token = sess ? sess.token : null;
                if (token) {
                    remove( { id:id, token:token }, function(err) {
                        cb(err);
                    });
                } else {
                    cb();
                }
            });
        } else {
            cb();
        }
    });
    runAsQueue(q, function(err) {
        callBack && callBack(err);
    });
}

Session.prototype.refresh = function(user) {
    var id = (user.id ? user.id : user.userid) || user._id;
    var key = this.formatKey(id, user.token);
    Memory.setExpireTime(key, this.config.tokenExpireTime);
    Redis.setExpireTime(key, this.config.tokenExpireTime);
}

Session.prototype.check = function(id, token, callBack) {
    var ins = this;
    return new Promise(function (resolve, reject) {
        var key = ins.formatKey(id, token);
        var cache = Memory.read(key);
        if (cache) {
            if (ins.checkSess(id, token, cache)) {
                if (callBack) return callBack(null, cache);
                resolve(cache);
            } else {
                if (callBack) return callBack(null, null);
                resolve();
            }
            return;
        }

        Redis.getHashAll(key, function(err, sess) {
            if (err) {
                if (callBack) return callBack(err);
                reject(err);
            } else {
                if (sess) {
                    if (ins.checkSess(id, token, sess)) {
                        if (sess.extra && typeof sess.extra == "string") {
                            try {
                                sess.extra = JSON.parse(sess.extra);
                            } catch (exp) {
                                console.error("JSON.parse session's extra fail --> " + exp.toString());
                            }
                        }
                        if (callBack) return callBack(null, sess);
                        resolve(sess);
                    } else {
                        if (callBack) return callBack(null, null);
                        resolve();
                    }
                } else {
                    if (callBack) return callBack(null, null);
                    resolve();
                }
            }
        });
    });
}

Session.getSharedInstance = function() {
    var ins = Session.$instance;
    if (!ins) {
        ins = new Session();
        Session.$instance = ins;
    }
    return ins;
}

Session.setSharedInstance = function(ins) {
    Session.$instance = ins;
}

module.exports = Session;
