/**
 * Created by Jay on 2015/9/16.
 */

var Redis = require("../model/Redis");
var Utils = require("./Utils");
var VCode = require("./ValidationCode");
var SMSUtil = require("./SMSUtil");

var config;
var vcode;
var DEBUG = global.VARS.debug;
var SIMULATION = false;

exports.init = function(setting) {
    config = setting || {};
    vcode = new VCode(config);
    DEBUG = vcode.DEBUG;
    SIMULATION = vcode.SIMULATION;
}

exports.remove = function(phone, type, callBack) {
    return vcode.remove(phone + "_" + type, callBack);
}

exports.use = function(phone, type, code, callBack) {
    return vcode.use(phone + "_" + type, code, callBack);
}

exports.check = function(phone, type, code, callBack) {
    return vcode.check(phone + "_" + type, code, callBack);
}

exports.send = function(phone, type, option, callBack) {

    option = typeof arguments[2] != "function" ? arguments[2] : {};
    option = option || {};
    callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    return new Promise(function(resolve, reject) {
        vcode.generate(phone + "_" + type, option, function(err, code) {
            if (err) {
                if (callBack) return callBack(err);
                return reject(err);
            }

            var params = option.params || {};
            params.code = code;
            SMSUtil.sendWithTemplate(phone, option.template || "validation", params, option, function(err) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(err);
                }
                if (callBack) return callBack(null, code);
                resolve(code);
            });
        });
    });
}