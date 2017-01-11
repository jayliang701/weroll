/**
 * Created by Jay on 2015/8/24.
 */
var CACHE = require("memory-cache");
var UTIL = require('util');

var EXPIRED_MAP = {};

exports.registerExpiredTime = function(key, expired) {
    EXPIRED_MAP[key] = Number(expired);
}

exports.save = function(key, val, expired, callBack) {
    if (UTIL.isArray(key)) {
        if (!expired) expired = EXPIRED_MAP[key[0]];
        key = key.join("->");
    } else {
        if (!expired) expired = EXPIRED_MAP[key];
    }
    CACHE.put(key, val, expired);
    //console.log('1 -> cache [' + key + '] saved.');
    if (callBack) callBack(true);
    return val;
}

exports.read = function(key, callBack) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    var c = CACHE.get(key);
    //console.log('read cache [' + key + '] from 1.');
    if (callBack) callBack(c);
    return c;
}

exports.remove = function(key, callBack) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    CACHE.del(key);
    //console.log('clear cache [' + key + '] from 1.');
    if (callBack) callBack(true);
}

exports.setExpireTime = function(key, time) {
    if (UTIL.isArray(key)) {
        key = key.join("->");
    }
    var val = CACHE.get(key);
    if (val == undefined || val == null) {
        return;
    }
    CACHE.put(key, val, time);
}