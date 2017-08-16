/**
 * Created by Jay on 6/6/15.
 */

var TemplateLib = require("./TemplateLib.js");
var Utils = require("./Utils.js");
var Redis = require("../model/Redis.js");
var CODES = require("../ErrorCodes");
var Request = require("min-request");

var proxy;
var config;
var PREFIX;
var DEBUG = global.VARS.debug;
var SIMULATION = false;

exports.init = function(setting) {
    config = setting;
    PREFIX = setting.prefix || "sms_log_";
    SIMULATION = config.simulate;
    if (config.hasOwnProperty("debug")) DEBUG = config.debug;
}

function logAfterSend(phone, redisObj, option) {
    var times = 1;
    var now = Date.now();
    var date = Utils.convertTimeToDate(now, false, 'en');
    if (redisObj && redisObj.date == date) {
        date = redisObj.date;
    }
    if (redisObj) {
        times += redisObj.sendTimes;
    }
    var key = PREFIX + phone;
    if (option && option.__sendType) key += "_" + option.__sendType;
    Redis.set(key, JSON.stringify({ date:date, lastSendTime:now, sendTimes:times }), function(err) {
        if (err) {
            console.error("log sending sms error in redis error ==> " + err.toString());
        }
    }, 24 * 60 * 60);
}

function send(phone, msg) {
    var option = typeof arguments[2] == "object" ? arguments[2] : {};
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    return new Promise(function(resolve, reject) {
        var sendLog;
        var q = [];
        if (!option.enforce) {
            q.push(function(cb) {
                checkIsAllowToSend(phone, option).then(function(redisLog) {
                    sendLog = redisLog;
                    cb();
                }).catch(function (err) {
                    cb(err);
                });
            });
        }
        if (option.hasOwnProperty("simulate") && option.simulate == false) {
            q.push(function(cb) {
                proxy.send(phone, msg, option, function(err) {
                    cb(err);
                });
            });
        } else {
            if (SIMULATION || option.simulate) {
                q.push(function(cb) {
                    setTimeout(function() {
                        console.log("Simulate SMS send ----> ");
                        console.log(msg);
                        cb();
                    }, 20);
                });
            } else {
                q.push(function(cb) {
                    proxy.send(phone, msg, option, function(err) {
                        cb(err);
                    });
                });
            }
        }
        runAsQueue(q, function(err) {
            if (!err && sendLog) logAfterSend(phone, sendLog, option);
            if (callBack) return callBack(err);
            err ? reject(err) : resolve();
        });

    });
}

function sendWithTemplate(phone, templateKey, params) {
    var option = typeof arguments[3] == "object" ? arguments[3] : {};
    var callBack = typeof arguments[3] == "function" ? arguments[3] : arguments[4];
    if (typeof callBack != "function") callBack = null;

    var tpl = TemplateLib.useTemplate("sms", templateKey, params);
    var msg = tpl.content;

    return send(phone, msg, option, callBack);
};

function checkIsAllowToSend(phone, option, callBack) {
    option = option || {};

    return new Promise(function(resolve, reject) {
        var key = PREFIX + phone;
        if (option.__sendType) key += "_" + option.__sendType;
        Redis.get(key, function(err, redisRes) {
            if (err) {
                if (callBack) return callBack(err);
                reject(err);
            } else {
                var obj;
                try {
                    obj = JSON.parse(redisRes);
                } catch (exp) {
                    obj = null;
                }
                obj = obj || {};
                obj.lastSendTime = obj.lastSendTime || 0;
                obj.sendTimes = obj.sendTimes || 0;

                if (Number(obj.lastSendTime) > 0) {
                    var passedTime = Date.now() - Number(obj.lastSendTime);
                    if (passedTime < config.limit.duration) {
                        //too fast
                        err = Error.create(CODES.SMS_SEND_TOO_FAST, "SMS send too fast");
                        if (callBack) return callBack(err);
                        reject(err);
                        return;
                    }
                }
                var sendTimes = parseInt(obj.sendTimes);
                if (sendTimes < 0) sendTimes = 0;
                //console.log(sendTimes, config.limit.maxPerDay);
                if (sendTimes >= config.limit.maxPerDay) {
                    //over max times in a day
                    err = Error.create(CODES.SMS_SEND_OVER_MAX_TIMES, "SMS send over max times");
                    if (callBack) return callBack(err);
                    reject(err);
                    return;
                }
                if (callBack) return callBack(null, obj);
                resolve(obj);
            }
        });
    });
}


proxy = {};
proxy.send = function(phone, msg) {
    var option = typeof arguments[2] == "object" ? arguments[2] : {};
    option = option || {};
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    var url = config.api;
    url += "&KeyMD5=" + Utils.md5(config.secret).toUpperCase();
    url += "&smsMob=" + phone;
    url += "&smsText=" + msg;

    if (DEBUG) console.log("SMS ready to send ==> " + url);

    return new Promise(function (resolve, reject) {
        Request(url, { method: "POST", body: {} }, function(err, res, body) {
            if (DEBUG) console.log("sent a SMS to phone: " + phone + "    response: " + body);
            if (err) {
                if (callBack) return callBack(err);
                reject(err);
            } else {
                if (Number(body) > 0) {
                    if (callBack) return callBack();
                    resolve();
                } else {
                    err = new Error("SMS agent error. " + body);
                    if (callBack) return callBack(err);
                    reject(err);
                }
            }
        });
    });
}

//proxy -> { send:Function }
function setProxy(newProxy) {
    proxy = newProxy;
}

exports.send = send;
exports.sendWithTemplate = sendWithTemplate;

exports.setProxy = setProxy;