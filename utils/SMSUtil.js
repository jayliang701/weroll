/**
 * Created by Jay on 6/6/15.
 */

var TemplateLib = require("./TemplateLib.js");
var Utils = require("./Utils.js");
var Redis = require("../model/Redis.js");
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
}

function logAfterSend(phone, redisObj) {
    var times = 1;
    var now = Date.now();
    var date = Utils.convertTimeToDate(now, false, 'en');
    if (redisObj && redisObj.date == date) {
        date = redisObj.date;
    }
    if (redisObj) {
        times += redisObj.sendTimes;
    }
    Redis.set(PREFIX + phone, JSON.stringify({ date:date, lastSendTime:now, sendTimes:times }), function(err) {
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
                checkIsAllowToSend(phone).then(function(redisLog) {
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
            if (!err && sendLog) logAfterSend(phone, sendLog);
            callBack && callBack(err);
            err ? reject(err) : resolve();
        });

    });
}

function sendWithTemplate(phone, templateKey, params) {
    var option = typeof arguments[3] == "object" ? arguments[3] : {};
    var callBack = typeof arguments[3] == "function" ? arguments[3] : arguments[4];
    if (typeof callBack != "function") callBack = null;

    return new Promise(function(resolve, reject) {
        var tpl = TemplateLib.useTemplate("sms", templateKey, params);
        var msg = tpl.content;
        send(phone, msg, option, function(err) {
            callBack && callBack(err);
            err ? reject(err) : resolve();
        });

    });
};

function checkIsAllowToSend(phone, callBack) {
    return new Promise(function(resolve, reject) {
        Redis.get(PREFIX + phone, function(err, redisRes) {
            if (err) {
                callBack && callBack(err);
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
                        err = new Error("SMS send too fast");
                        callBack && callBack(err);
                        reject(err);
                        return;
                    }
                }
                var sendTimes = parseInt(obj.sendTimes);
                if (sendTimes < 0) sendTimes = 0;
                //console.log(sendTimes, config.limit.maxPerDay);
                if (sendTimes >= config.limit.maxPerDay) {
                    //over max times in a day
                    err = new Error("SMS send over max times");
                    callBack && callBack(err);
                    reject(err);
                    return;
                }
                callBack && callBack(null, obj);
                resolve(obj);
            }
        });
    });
}


proxy = {};
proxy.send = function(phone, msg) {
    var option = typeof arguments[2] == "object" ? arguments[2] : {};
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    var url = config.api;
    url += "&KeyMD5=" + Utils.md5(config.secret).toUpperCase();
    url += "&smsMob=" + phone;
    url += "&smsText=" + msg;

    if (DEBUG) console.log("SMS ready to send ==> " + url);

    Request(url, { method: "POST", body: {} }, function(err, res, body) {
        if (DEBUG) console.log("sent a SMS to phone: " + phone + "    response: " + body);
        if (err) {
            callBack(err);
        } else {
            if (Number(body) > 0) {
                callBack();
            } else {
                callBack(new Error("SMS agent error. " + body));
            }
        }
    });
}

//proxy -> { send:Function }
function setProxy(newProxy) {
    proxy = newProxy;
}

exports.send = send;
exports.sendWithTemplate = sendWithTemplate;

exports.setProxy = setProxy;