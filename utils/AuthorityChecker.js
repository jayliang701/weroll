/**
 * Created by Jay on 2017/1/19.
 */

let UTIL = require("util");
let Utils = require("./Utils");

let checker = {};

checker["type"] = {
    check: function(user, allow, callBack) {
        process.nextTick(function () {
            if (allow && allow.indexOf(user.type) < 0) return callBack(false);
            callBack(true);
        });
    },
    fail: null,  //use default fail handler
};

exports.register = function(type, func, failHandler) {
    checker[type] = {
        check: func.bind(checker),
        fail: failHandler,
    };
}

exports.check = function(user, allow, req, res, r) {
    return new Promise((resolve, reject) => {
        //allow --> [ [ "type", [1,2] ] ]
        let q = [];
        allow.forEach((def) =>{
            q.push((cb) => {
                let type = def, args = undefined;
                if (typeof type === "object") {
                    type = def[0];
                    args = def[1];
                }
                let processer = checker[type];
                let p = processer.check(user, args, (result) => {
                    cb(result ? null : { type, args });
                });
                if (p && p instanceof Promise) {
                    p.then(result => {
                        cb(result ? null : { type, args });
                    }).catch(err => {
                        cb(err);
                    });
                }
            });
        });
        runAsQueue(q, (errDef) => {
            if (errDef) { 
                if (errDef instanceof Error) {
                    return reject(err);
                }
                let processer = checker[errDef.type];
                if (processer.fail) {
                    processer.fail(user, errDef, req, res, r);
                    return resolve(-1);
                }
                let err = new Error("check authority fail: " + errDef.type)
                return reject(err);
            }
            resolve(1);
        });
    });
}