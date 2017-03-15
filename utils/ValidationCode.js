/**
 * Created by Jay on 2015/9/16.
 */

var Redis = require("../model/Redis");
var Utils = require("./Utils");
var SMSUtil = require("./SMSUtil");

/*
 setting: {
     prefix:"check_code_",
     len:6,
     expire:5 * 60,
     pattern:[ [0,9],[A,Z] ],
     simulate:true
 }
 */
function ValidationCode(setting) {

    var REDIS_KEY = "validation_code_";
    var DEFAULT_CODE_LEN = 6;
    var DEFAULT_PATTERN = [ [ 48, 57 ] ];   //0-9
    var DEFAULT_EXPIRE = 15 * 60;     //15 min
    var config = ValidationCode.config || {};
    var DEBUG = global.VARS.debug;
    var SIMULATION = false;

    config = setting || config;
    DEFAULT_CODE_LEN = config.len || DEFAULT_CODE_LEN;
    if (config.pattern) {
        DEFAULT_PATTERN.length = 0;
        config.pattern.forEach(function(p) {
            DEFAULT_PATTERN.push([ String(p[0]).charCodeAt(0), String(p[1]).charCodeAt(0) ]);
        });
    }
    DEFAULT_EXPIRE = config.expire || DEFAULT_EXPIRE;
    SIMULATION = config.hasOwnProperty("simulate") ? config.simulate : SIMULATION;
    DEBUG = config.hasOwnProperty("debug") ? config.debug : DEBUG;
    REDIS_KEY = config.prefix || REDIS_KEY;

    this.remove = function(key, callBack) {
        return new Promise(function(resolve, reject) {
            Redis.del(REDIS_KEY + key, function(redisErr) {
                redisErr && console.error("remove validation code error: ", redisErr);
                if (callBack) return callBack(redisErr);
                redisErr ? reject(redisErr) : resolve();
            });
        });
    }

    this.use = function(key, code, callBack) {
        var ins = this;
        return new Promise(function(resolve, reject) {
            if (!code || code == "") {
                if (callBack) return callBack(null, false);
                return resolve(false);
            }

            Redis.get(REDIS_KEY + key, function(redisErr, redisRes) {
                if (redisErr) {
                    if (callBack) return callBack(redisErr);
                    return reject(redisErr);
                }

                if (redisRes && redisRes == code) {
                    ins.remove(key);
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }

                //模拟
                if (SIMULATION && code == "123456") {
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }
                if (callBack) return callBack(null, false);
                return resolve(false);
            });
        });
    }

    this.check = function(key, code, callBack) {
        return new Promise(function(resolve, reject) {
            Redis.get(REDIS_KEY + key, function(redisErr, redisRes) {
                if (redisErr) {
                    if (callBack) return callBack(redisErr);
                    return reject(redisErr);
                }

                if (redisRes && redisRes == code) {
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }
                if (SIMULATION && code == "123456") {
                    if (callBack) return callBack(null, true);
                    return resolve(true);
                }
                if (callBack) return callBack(null, false);
                return resolve(false);
            });
        });
    }

    this.generate = function(key, option, callBack) {
        option = typeof arguments[1] != "function" ? arguments[1] : {};
        option = option || {};
        callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
        if (typeof callBack != "function") callBack = null;

        var code = option.code || generateCode(parseInt(option.len || DEFAULT_CODE_LEN), option.pattern);

        return new Promise(function (resolve, reject) {
            Redis.set(REDIS_KEY + key, code, function (redisErr) {
                if (redisErr) {
                    if (callBack) return callBack(null, redisErr);
                    return reject(redisErr);
                }
                DEBUG && console.log("generate validation code --> " + key + " >>> " + code);
                if (callBack) return callBack(null, code);
                return resolve(code);
            }, option.expire || DEFAULT_EXPIRE);

        });
    }

    function generateCode(len, pattern) {
        var parts = DEFAULT_PATTERN;
        if (pattern) {
            parts.length = 0;
            pattern.forEach(function(p) {
                parts.push([ String(p[0]).charCodeAt(0), String(p[1]).charCodeAt(0) ]);
            });

        }

        var pwd = "";
        for (var i = 0; i < len; i++)
        {
            var part = parts[Math.floor(Math.random() * parts.length)];
            var code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
            var c = String.fromCharCode(code);
            pwd += c;
        }
        return pwd;
    }

    this.test = function() {
        console.log(generateCode.apply(this, Array.prototype.slice.call(arguments, 0)));
    }

    this.DEBUG = DEBUG;
    this.SIMULATION = SIMULATION;
}

ValidationCode.globalConfig = function(option) {
    ValidationCode.config = option || {};
}

module.exports = ValidationCode;