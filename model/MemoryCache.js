/**
 * Created by Jay on 2015/8/24.
 */
var CACHE = require("memory-cache");
var UTIL = require('util');

var EXPIRED_MAP = {};

var SEP = ".";

exports.registerExpiredTime = function(key, expired) {
    if (key instanceof Array) key = key.join(".");
    EXPIRED_MAP[key] = Number(expired);
}

exports.save = function(key, val) {
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;

    var expired = typeof arguments[2] == "number" ? arguments[2] : arguments[3];
    if (typeof expired != "number") expired = null;

    var tempKey = key;
    if (key instanceof Array) {
        tempKey = key[0];
        key = key.join(".");
    }
    if (!expired) expired = EXPIRED_MAP[tempKey];
    CACHE.put(key, val, expired ? (expired * 1000) : undefined);
    //console.log('1 -> cache [' + key + '] saved. expire time: ' + expired);
    callBack && process.nextTick(()=>callBack(null, val));
    return val;
}

exports.read = function(key, callBack) {
    if (key instanceof Array) key = key.join(".");
    var c = CACHE.get(key);
    //console.log('read cache [' + key + '] from 1.');
    callBack && process.nextTick(()=>callBack(null, c));
    return c;
}

exports.remove = function(key, callBack) {
    if (key instanceof Array) key = key.join(".");
    CACHE.del(key);
    //console.log('clear cache [' + key + '] from 1.');
    callBack && process.nextTick(callBack);
}

exports.setExpireTime = function(key, time) {
    if (key instanceof Array) key = key.join(".");
    var val = CACHE.get(key);
    if (val == undefined || val == null) {
        return;
    }
    CACHE.put(key, val, time * 1000);
}

exports.init = function (option, callBack) {
    option = option || {};
    if (option.group_sep) SEP = option.group_sep;
    process.nextTick(function() {
        callBack && callBack();
    });
}