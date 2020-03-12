/**
 * Created by Jay on 2015/8/27.
 */
const JWT = require('jsonwebtoken');
const CODES = require("../ErrorCodes");
const RedisSessionPayload = require("./adapter/RedisSessionPayload");
const MongoSessionPayload = require("./adapter/MongoSessionPayload");

function Session() {
    if (!Session.$instance) Session.$instance = this;
    this.config = {};
}

Session.prototype.init = function (params) {
    this.config = params || {};
    this.config.prefix = this.config.prefix || "";
    let ins = this;
    if (this.config.onePointEnter) {
        this.formatKey = function (id, token) {
            return ins.config.prefix + "user_sess_" + id + "_0";
        }
        this.checkSess = function (id, token, sess) {
            return sess.userid == id && sess.token == token;
        }
    } else {
        this.formatKey = function (id, token) {
            return ins.config.prefix + "user_sess_" + id + "_" + token;
        }
        this.checkSess = function (id, token, sess) {
            return true;
        }
    }
    if (params.payloadWorker) {
        this.payloadWorker = params.payloadWorker;
    }
    if (!this.payloadWorker) {
        if (this.config.storage === "mongodb") {
            this.payloadWorker = new MongoSessionPayload();
        } else {
            this.payloadWorker = new RedisSessionPayload();
        }
    }
    this.payloadWorker.session = this;
}

Session.prototype.savePayload = function (key, payload, expireTime) {
    return this.payloadWorker.savePayload(key, payload, expireTime);
}

Session.prototype.updateUserAllPayloads = function (userid, extra) {
    return new Promise(async (resolve, reject) => {
        try {
            let keys = await this.findAllPayloadKeys(userid);
            if (keys) {
                let expireTime = this.config.tokenExpireTime;
                for (let i = 0; i < keys.length; i++) {
                    let newExtra;
                    let oldExtra = await this.readPayload(keys[i]);
                    if (oldExtra instanceof Array && extra instanceof Array) {
                        newExtra = [ ...oldExtra, ...extra ];
                    } else {
                        newExtra = { ...oldExtra, ...extra };
                    }
                    await this.savePayload(keys[i], newExtra, expireTime);
                }
            }
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

Session.prototype.readPayload = function (key) {
    return this.payloadWorker.readPayload(key);
}

Session.prototype.removePayload = function (key) {
    return this.payloadWorker.removePayload(key);
}

Session.prototype.findAllPayloadKeys = function (userid) {
    return this.payloadWorker.findAllPayloadKeys(userid);
}

Session.prototype.refreshPayloadExpireTime = function (key, expireTime) {
    return this.payloadWorker.refreshPayloadExpireTime(key, expireTime);
}

Session.prototype.save = function (user, extra, callBack) {

    callBack = arguments[arguments.length - 1];
    if (typeof callBack !== "function") callBack = null;
    extra = typeof extra === "object" ? extra : null;

    let userID = (user.id ? user.id : user.userid) || user._id;

    let loginTime = Date.now();
    let expireTime = this.config.tokenExpireTime;

    let sess = { ...extra };
    sess.userid = userID;
    sess.type = user.type;
    sess.loginTime = loginTime;

    let token = JWT.sign({ id: sess.userid, time: loginTime }, this.config.secret, { expiresIn: expireTime });

    let ins = this;
    return new Promise((resolve, reject) => {
        const key = ins.formatKey(userID, loginTime);
        ins.savePayload(key, sess, expireTime).then(() => {
            if (callBack) return callBack(null, token);
            resolve(token);
        }).catch(err => {
            console.error(err);
            if (callBack) return callBack(err);
            reject(err);
        });
    });
}

Session.prototype.remove = function (user, callBack) {
    let id = (user.id ? user.id : user.userid) || user._id;
    let key = this.formatKey(id, user.loginTime);
    return new Promise((resolve, reject) => {
        this.removePayload(key).then(() => {
            if (callBack) return callBack();
            resolve();
        }).catch(err => {
            console.error(err);
            if (callBack) return callBack(err);
            reject(err);
        });
    });
}

Session.prototype.removeAll = function (userid, callBack) {
    return new Promise(async (resolve, reject) => {
        try {
            let keys = await this.findAllPayloadKeys(userid);
            for (let i = 0; i < keys.length; i++) {
                await this.removePayload(keys[i]);
            }
        } catch (err) {
            console.error(err);
            if (callBack) return callBack(err);
            reject(err);
        }
        resolve();
    });
}

Session.prototype.extendTime = function (auth, callBack) {

    callBack = arguments[arguments.length - 1];
    if (typeof callBack !== "function") callBack = null;

    let expireTime = this.config.tokenExpireTime;

    return new Promise(async (resolve, reject) => {
        try {
            if (!this.config.secret) {
                throw Error.create(CODES.SESSION_ERROR, 'session is not configed correctly');
            }
            let decoded = JWT.verify(auth, this.config.secret);
            let key = this.formatKey(decoded.id, decoded.time);
            await this.refreshPayloadExpireTime(key, expireTime);
            if (callBack) return callBack();
            resolve();
        } catch (err) {
            console.error(err);
            if (callBack) return callBack(err);
            reject(err);
        }
    });
}

Session.prototype.refresh = function (user, extra, callBack) {

    callBack = arguments[arguments.length - 1];
    if (typeof callBack !== "function") callBack = null;
    extra = typeof extra === "object" ? extra : null;

    return new Promise(async (resolve, reject) => {
        try {
            await this.remove(user);
            let token = this.save(user, extra);
            if (callBack) return callBack(null, token);
            resolve(token);
        } catch (err) {
            console.error(err);
            if (callBack) return callBack(err);
            reject(err);
        }
    });
}

Session.prototype.check = function (auth, callBack) {
    return new Promise(async (resolve, reject) => {
        // invalid auth - synchronous
        try {
            if (!this.config.secret) {
                throw Error.create(CODES.SESSION_ERROR, 'session is not configed correctly');
            }

            let decoded = JWT.verify(auth, this.config.secret);
            let key = this.formatKey(decoded.id, decoded.time);
            let payload = await this.readPayload(key);
            if (!payload) {
                throw Error.create(CODES.SESSION_ERROR, 'auth expired or invalid');
            }

            if (callBack) return callBack(null, payload);
            resolve(payload);
        } catch (err) {
            if (err.code !== CODES.SESSION_ERROR) {
                if (err instanceof JWT.JsonWebTokenError) {
                    err.code = CODES.SESSION_ERROR;
                } else {
                    console.error(err);
                }
            }
            if (callBack) return callBack(err);
            reject(err);
        }
    });
}

Session.getSharedInstance = function () {
    let ins = Session.$instance;
    if (!ins) {
        ins = new Session();
        Session.$instance = ins;
    }
    return ins;
}

Session.setSharedInstance = function (ins) {
    Session.$instance = ins;
}

module.exports = Session;
