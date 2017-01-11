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

    var tokentimestamp = Date.now();

    var sess = {};
    sess.userid = user.id;
    sess.token = user.token || Utils.randomString(16);
    sess.tokentimestamp = tokentimestamp;
    sess.type = user.type;
    sess.extra = user.extra;

    var key = this.formatKey(sess.userid, sess.token);

    var ins = this;
    Redis.setHashMulti(key, sess, function(redisRes, redisErr) {
        if (redisRes) {
            Memory.save(key, sess, ins.config.cacheExpireTime, null);
            if (callBack) callBack(sess);
        } else {
            if (callBack) callBack(null, redisErr);
        }
    }, ins.config.tokenExpireTime);
}

Session.prototype.remove = function(user, callBack) {
    var id = user.id ? user.id : user.userid;
    var key = this.formatKey(id, user.token);
    Memory.remove(key);
    Redis.del(key, function(redisRes, redisErr) {
        if (redisRes) {
            if (callBack) callBack(true);
        } else {
            if (callBack) callBack(false, redisErr);
        }
    });
}

Session.prototype.refresh = function(user) {
    var id = user.id ? user.id : user.userid;
    var key = this.formatKey(id, user.token);
    Memory.setExpireTime(key, this.config.tokenExpireTime);
    Redis.setExpireTime(key, this.config.tokenExpireTime);
}

Session.prototype.check = function(id, token, callBack) {

    var key = this.formatKey(id, token);
    var cache = Memory.read(key);
    if (cache) {
        if (this.checkSess(id, token, cache)) {
            callBack(1, cache);
        } else {
            callBack(0);
        }
        return;
    }

    var ins = this;
    Redis.getHashAll(key, function(sess, err) {
        if (err) {
            callBack(-1, null, err);
        } else {
            if (sess) {
                if (ins.checkSess(id, token, sess)) {
                    callBack(1, sess);
                } else {
                    callBack(0);
                }
            } else {
                callBack(0);
            }
        }
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
