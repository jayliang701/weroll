/**
 * Created by Jay on 2017/1/19.
 */

var UTIL = require("util");
var Utils = require("./Utils");

var checker = {};

checker["type"] = function(user, allow, callBack) {
    process.nextTick(function () {
        if (allow && allow.indexOf(user.type) < 0) return callBack(false);
        callBack(true);
    });
}

exports.register = function(type, func) {
    checker[type] = func.bind(checker);
}

exports.check = function(user, allow) {
    return new Promise((resolve, reject) => {
        //allow --> [ [ "type", [1,2] ] ]
        var q = [];
        allow.forEach(function(def) {
            q.push(function(cb) {
                checker[def[0]](user, def[1], function (result) {
                    cb(result ? null : new Error("check authority fail: " + def[0]));
                });
            });
        });
        runAsQueue(q, function(err) {
            if (err) return reject(err);
            resolve();
        });
    });
}