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
    this.config = params;
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
    if (user.extra) sess.extra = user.extra;

    var key = this.formatKey(sess.userid, sess.token);

    var ins = this;
    return new Promise(function (resolve, reject) {
        Redis.setHashMulti(key, sess, function(redisErr, redisRes) {
            if (redisRes) {
                Memory.save(key, sess, ins.config.cacheExpireTime, null);
                callBack && callBack(null, sess);
                resolve(sess);
            } else {
                callBack && callBack(redisErr);
                reject(redisErr);
            }
        }, ins.config.tokenExpireTime);
    });
}

Session.prototype.remove = function(user, callBack) {
    var id = (user.id ? user.id : user.userid) || user._id;
    var key = this.formatKey(id, user.token);
    Memory.remove(key);
    return new Promise(function (resolve, reject) {
        Redis.del(key, function(err) {
            callBack && callBack(err);
            err ? reject(err) : resolve();
        });
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
                callBack && callBack(null, cache);
                resolve(cache);
            } else {
                callBack && callBack(null, null);
                resolve();
            }
            return;
        }

        return Redis.getHashAll(key, function(sess, err) {
            if (err) {
                callBack && callBack(err);
                reject(err);
            } else {
                if (sess) {
                    if (ins.checkSess(id, token, sess)) {
                        callBack && callBack(null, sess);
                        resolve(sess);
                    } else {
                        callBack && callBack(null, null);
                        resolve();
                    }
                } else {
                    callBack && callBack(null, null);
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
