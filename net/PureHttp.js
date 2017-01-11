/**
 * Created by Jay on 2016/8/25.
 */


var URL = require("url");
var HTTP = require('http');
HTTP.globalAgent.maxSockets = Infinity;

//var ICONV = require('iconv-lite');
//var Crypto = require("crypto");
//var BufferHelper = require('bufferhelper');

var DEBUG = global.VARS && global.VARS.debug;
var PROFILING = global.VARS && global.VARS.profiling;

function Server() {

    var instance = this;

    this.__middleware = new DefaultMiddleware();

    this.__handlers = {
        "POST": {},
        "GET": {},
        "ALL": {}
    };

    this.__options = {};

    this.__worker = HTTP.createServer(function (req, res) {

        if (req.method == "OPTIONS") {
            if (instance.__middleware.processCORS(req, res)) {
                res.writeHead(200);
            } else {
                res.writeHead(404);
            }
            res.end();
            return;
        }

        if (req.method == "GET") req.query = URL.parse(req.url, true).query;

        var url = req.url;
        var index = url.indexOf("?");
        if (index > 0) url = url.substring(0, index);

        var handlerMap = instance.__handlers[req.method];
        var handler = handlerMap[url];
        if (!handlerMap || !handler) {
            res.writeHead(404);
            res.end();
            return;
        }

        instance.__middleware.preprocess(req, res);

        var data = [];
        req.on("data", function (chunk) {
            data.push(chunk);
        });
        req.on("end", function () {

            if (req.method == "GET") {
                data = req.query;
            } else {
                data = Buffer.concat(data).toString('utf8');
            }

            //if (DEBUG) console.log("incoming request ---> [" + url + "] " + req.method + " > ", data);

            instance.__middleware.process(req, res, data, handler);
        });
    });

    this.$server = this.__worker;

    this.start = function(options, callBack) {
        options = options || {};
        this.__options = options;
        var port = options.port || 8888;
        var ip = options.ip || "127.0.0.1";

        this.__worker.listen(port, ip, function() {
            if (callBack) callBack(instance, this.__worker);
        });

        if (DEBUG) console.log("http server is running on port: " + port);
    }

    this.post = function(path, handler) {
        //if (DEBUG) console.log("*POST* in --> " + );
        var handlers = this.__handlers["POST"];
        handlers[path] = handler;
    }

    this.get = function(path, handler) {
        //if (DEBUG) console.log("*GET* in --> " + );
        var handlers = this.__handlers["GET"];
        handlers[path] = handler;
    }

    this.all = function(path, handler) {
        //if (DEBUG) console.log("*ALL* in --> " + );
        var handlers = this.__handlers["ALL"];
        handlers[path] = handler;
    }

    this.middleware = function(middleware) {
        this.__middleware = middleware;
    }
}

require("util").inherits(Server, require('events'));

exports.createServer = function() {
    var server = new Server();
    return server;
}

function DefaultMiddleware() {
    this.processCORS = function(req, res) {
        return false;
    }

    this.preprocess = function(req, res) {

    }

    this.process = function(req, res, data, handler) {
        handler(req, res, data);
    }
}

function JsonAPIMiddleware() {

    this.preprocess = function(req, res) {
        var success = function (data, headers) {
            var responseHeader = { "Content-Type": "application/json" };
            if (headers) {
                for (var key in headers) {
                    responseHeader[key] = headers[key];
                }
            }
            if (arguments.length == 0) data = { flag:1 };
            var resBody = JSON.stringify({code: 1, data:data, msg:"OK"});
            //if (req.query.callback) resBody = req.query.callback + "(" + resBody + ")";
            responseHeader['Content-Length'] = Buffer.byteLength(resBody, "utf8");
            this.writeHead(200, responseHeader);
            this.end(resBody);

            this.profile();
        };

        var fail = function () {
            var err = arguments[0];
            var code = 0;
            var msg = "error";
            if (arguments.length > 1) {
                code = Number(arguments[0]);
                msg = arguments[1] ? arguments[1].toString() : "unknown";
            } else {
                if (err.hasOwnProperty("code")) {
                    code = err.code;
                    msg = err.msg;
                } else {
                    msg = err.toString();
                }
            }
            var responseHeader = { "Content-Type": "application/json" };
            var resBody = JSON.stringify({code: code, msg:msg});
            //if (req.query.callback) resBody = req.query.callback + "(" + resBody + ")";
            responseHeader['Content-Length'] = Buffer.byteLength(resBody, "utf8");
            this.writeHead(200, responseHeader);
            this.end(resBody);

            this.profile();
        };

        var done = function(err, result) {
            var res = this;
            if (err == -1) {
                res.sayOK();
                return;
            }

            if (err) {
                res.sayError(err);
            } else {
                if (arguments.length == 0 || (arguments.length == 1 && (arguments[0] == null || arguments[1] == undefined))) {
                    res.sayOK();
                } else {
                    res.sayOK(result);
                }
            }
        }

        var exec = function(q, done) {
            var res = this;
            runAsQueue(q, function(err, result) {
                if (err == -1) {
                    res.sayOK();
                    return;
                }

                if (err) {
                    res.sayError(err);
                } else {
                    if (arguments.length == 0 || (arguments.length == 1 && (arguments[0] == null || arguments[1] == undefined))) {
                        res.sayOK();
                    } else {
                        res.sayOK(result);
                    }
                    if (done) done(result);
                }
            });
        }

        res.profile = function() {};
        res.done = done.bind(res);
        res.exec = exec.bind(res);
        res.sayError = fail.bind(res);
        res.sayOK = success.bind(res);
    }

    this.process = function(req, res, data, handler) {
        var params = null;
        try {
            params = typeof data == "string" ? JSON.parse(data) : data;
        } catch (exp) {
            res.sayError(exp);
            return;
        }

        handler(req, res, params);
    }
}

exports.JsonAPIMiddleware = JsonAPIMiddleware;
