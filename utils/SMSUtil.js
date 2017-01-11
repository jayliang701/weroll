/**
 * Created by Jay on 6/6/15.
 */

var TemplateLib = require("./TemplateLib.js");
var Utils = require("./Utils.js");
var Redis = require("../model/Redis.js");
var Request = require("min-request");

var config;
var DEBUG = true;
var SIMULATION = false;

exports.init = function(setting) {
    config = setting;
    DEBUG = global.VARS.debug;
    SIMULATION = global.VARS.debug;
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
    Redis.set("sms_log_" + phone, JSON.stringify({ date:date, lastSendTime:now, sendTimes:times }), function(redisRes, err) {
        if (err) {
            console.error("log sending sms error in redis error ==> " + err.toString());
        }
    }, 24 * 60 * 60);
}

function checkIsAllowToSend(phone, callBack) {
    Redis.get("sms_log_" + phone, function(redisRes, err) {
        if (err) {
            callBack(null, err);
        } else {
            if (redisRes) {
                try {
                    var obj = JSON.parse(redisRes);
                    if (Number(obj.lastSendTime) > 0) {
                        var passedTime = Date.now() - Number(obj.lastSendTime);
                        if (passedTime < config.limit.duration) {
                            //too fast
                            callBack(null, new Error("SMS_SEND_TOO_FAST"));
                            return;
                        }
                    }
                    var sendTimes = parseInt(obj.sendTimes);
                    if (sendTimes < 0) sendTimes = 0;
                    if (sendTimes > config.limit.maxPerDay) {
                        //over max times in a day
                        callBack(null, new Error("SMS_SEND_OVER_MAX_TIMES"));
                        return;
                    }
                    callBack(obj);
                } catch (exp) {
                    callBack(null, exp);
                }
            } else {
                callBack();
            }
        }
    });
}

function sendMessage(phone, templateKey, params, callBack, enforce) {
    if (!String(phone).hasValue() || !Utils.cnCellPhoneCheck(phone)) {
        var err = new Error("invalid cn cell phone");
        if (callBack) callBack(false, err);
        return;
    }

    if (enforce) {
        send(phone, templateKey, params, callBack);
    } else {
        checkIsAllowToSend(phone, function(redisLog, err) {
            if (err) {
                if (callBack) callBack(false, err);
            } else {
                if (SIMULATION) {
                    setTimeout(function() {
                        console.log("Simulate SMS send ----> ");
                        var tpl = TemplateLib.useTemplate("sms", templateKey, params);
                        console.log(tpl.content);

                        logAfterSend(phone, redisLog);
                        if (callBack) callBack(true);
                    }, 50);
                    return;
                }

                send(phone, templateKey, params, function(flag, err) {
                    if (flag) logAfterSend(phone, redisLog);
                    if (callBack) callBack(flag, err);
                });
            }
        });
    }
}

function send(phone, templateKey, params, callBack) {
    var tpl = TemplateLib.useTemplate("sms", templateKey, params);
    var msg = tpl.content;
    var url = config.api;
    url += "&KeyMD5=" + Utils.md5(config.secret).toUpperCase();
    url += "&smsMob=" + phone;
    url += "&smsText=" + msg;

    if (DEBUG) console.log("SMS ready to send ==> " + url);

    Request(url, { method: "POST", body: {} },
        function(err, res, body) {
            if (DEBUG) console.log("sent a message to phone: " + phone + "    response: " + body);
            if (err) {
                if (callBack) callBack(false, err);
            } else {
                if (Number(body) > 0) {
                    if (callBack) callBack(true);
                } else {
                    if (callBack) callBack(false, new Error("sms agent error ==> " + body));
                }
            }
        });
}

exports.sendMessage = sendMessage;