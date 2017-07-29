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
        var handler;
        if (!handlerMap || !handlerMap[url]) {
            handlerMap = instance.__handlers["ALL"];
            if (!handlerMap || !handlerMap[url]) {
                res.writeHead(404);
                res.end();
                return;
            }
        }
        handler = handlerMap[url];

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
            if (callBack) callBack(instance, instance.__worker);
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
        return true;
    }

    this.preprocess = function(req, res) {

    }

    this.process = function(req, res, data, handler) {
        handler(req, res, data);
    }
}

function JsonAPIMiddleware() {

    var instance = this;

    this.generateAPIHeader = function() {
        return { "Content-Type": "application/json" };
    };
    this.encodeAPIData = function(data) {
        return JSON.stringify(data);
    };
    this.getAPIDataLength = function(data) {
        return Buffer.byteLength(data, "utf8");
    };

    this.outputData = function(res, data, headers) {
        var responseHeader = instance.generateAPIHeader();
        if (headers) {
            for (var key in headers) {
                responseHeader[key] = headers[key];
            }
        }

        data = instance.encodeAPIData(data);
        responseHeader['Content-Length'] = instance.getAPIDataLength(data);
        res.writeHead(200, responseHeader);
        res.end(data);
    }

    this.preprocess = function(req, res) {
        var success = function (data, headers) {
            if (arguments.length == 0) data = { flag:1 };
            data = {code: 1, data:data, msg:"OK"};

            instance.outputData(res, data, headers);

            this.profile();
        };

        var fail = function () {
            var err = arguments[0];
            var code = 101;
            var msg = "error";
            if (arguments.length > 1) {
                code = Number(err);
                msg = arguments[1] ? arguments[1].toString() : "unknown";
            } else {
                if (err instanceof Array) {
                    code = err[0];
                    msg = err[1];
                } else if (typeof err == "object" || err instanceof Error) {
                    code = err.code || 101;
                    msg = err.message || err.toString();
                } else {
                    msg = err.toString();
                }
            }

            instance.outputData(res, {code: code, msg:msg});

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

        var __callAPI = function(func, params, user, callBack) {
            var req = this;
            var res = {};
            res.sayError = function() {
                var code, msg;
                if (arguments[0].constructor == Error && arguments[0].hasOwnProperty("code")) {
                    callBack && callBack(arguments[0]);
                    return;
                }
                if (arguments.length == 1 && arguments[0]) {
                    if (arguments[0] instanceof Array) {
                        code = arguments[0][0];
                        msg = arguments[0][1];
                    } else {
                        code = 101;
                        msg = arguments[0].toString();
                    }
                } else {
                    code = arguments[0] == undefined ? 101 : arguments[0];
                    msg = arguments[1];
                }
                if (!msg) {
                    msg = "unknown";
                } else if (typeof msg == 'object') {
                    msg = msg.toString();
                }
                callBack && callBack(Error.create(code, msg));
            };
            res.sayOK = function(data) {
                callBack && callBack(null, data);
            }
            res.exec = exec.bind(res);
            res.done = done.bind(res);

            func(req, res, params, user);
        }

        req.__callAPI = __callAPI.bind(req);
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

        req.body = params;
        handler(req, res, params);
    }
}

exports.JsonAPIMiddleware = JsonAPIMiddleware;
