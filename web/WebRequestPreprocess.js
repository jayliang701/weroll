/**
 * Created by Jay on 2015/9/10.
 */

var UTIL = require("util");
var Utils = require("./../utils/Utils");
var Profiler = require("../utils/Profiler");
var CODES = require("./../ErrorCodes");

var PROFILING = global.VARS && global.VARS.profiling;

var options;

var injects = { head:[], middle:[ preprocess ] };

var generateAPIHeader = function() {
    return { "Content-Type": "application/json" };
};
var encodeAPIData = function(data) {
    return JSON.stringify(data);
};
var getAPIDataLength = function(data) {
    return Buffer.byteLength(data, "utf8");
};

var profile = function() { }

exports.config = function(opt) {
    options = opt;
    if (options.compress) {
        generateAPIHeader = function() {
            return { "Content-Type": "application/octet-stream" };
        };
        encodeAPIData = function(data) {
            return jsonZip(data);
        };
        getAPIDataLength = function(data) {
            return data.length;
        };
    }
    if (PROFILING) {
        var profiler = new Profiler(options.profiling);
        profiler.start();

        profile = function() {
            profiler.recordRequest(this._req);
        }
    }
}

exports.inject = function(type, handler) {
    injects[type].push(handler);
}

exports.register = function(app, type) {
    var handlers = injects[type];
    if (handlers && handlers.length > 0) {
        handlers.forEach(function(handler) {
            app.use(handler);
        });
    }
}

function exec(q, success) {
    var res = this;
    runAsQueue(q, function(err, result) {
        if (err) {
            res.sayError(err);
        } else {
            if (arguments.length == 0 || (arguments.length == 1 && (arguments[0] == null || arguments[1] == undefined))) {
                res.sayOK();
            } else {
                res.sayOK(result);
            }
            if (success) success(result);
        }
    });
}

function outputData(data, headers) {
    var responseHeader = generateAPIHeader();
    if (headers) {
        for (var key in headers) {
            responseHeader[key] = headers[key];
        }
    }

    data = encodeAPIData(data);
    responseHeader['Content-Length'] = getAPIDataLength(data);
    this.writeHead(200, responseHeader);
    this.end(data);
    this.profile();
}

function sayError() {
    var code, msg;
    if (arguments.length == 1 && arguments[0]) {
        if (arguments[0] instanceof Array) {
            code = arguments[0][0];
            msg = arguments[0][1];
        } else if (arguments[0].code && arguments[0].msg) {
            code = arguments[0].code;
            msg = arguments[0].msg;
        } else {
            code = CODES.SERVER_ERROR;
            msg = arguments[0].message || arguments[0].toString();
        }
    } else {
        code = arguments[0] == undefined ? CODES.SERVER_ERROR : arguments[0];
        msg = arguments[1];
    }
    if (!msg) {
        msg = "unknown";
    } else if (typeof msg == 'object') {
        msg = msg.message || msg.toString();
    }
    console.error(this._req.body.method + " > ", "code: " + code, "msg: " + msg);
    outputData.apply(this, [ {code:code, data:{}, msg:msg} ]);
}

function sayOK(data, headers) {
    if (arguments.length == 0) data = { flag:1 };
    data = {code: CODES.OK, data:data, msg:"OK"};
    outputData.apply(this, [ data, headers ])
}

function __callAPI(func, params, user, callBack) {
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
                code = CODES.SERVER_ERROR;
                msg = arguments[0].toString();
            }
        } else {
            code = arguments[0] == undefined ? CODES.SERVER_ERROR : arguments[0];
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

    func(req, res, params, user);
}

function sendBinary(data, mime, headers) {
    var responseHeader = {
        "Content-Type": mime,
        "Cache-Control":"no-cache",
        "Content-Length":data.length
    };
    if (headers) {
        for (var key in headers) {
            responseHeader[key] = headers[key];
        }
    }
    this.writeHead(200, responseHeader);
    this.end(data);
    this.profile();
}

function goPage(url, code) {
    if (url.charAt(0) == "/") url = url.substring(1);
    if (url.indexOf("http") != 0) {
        url = options.site + url;
    }
    code = code ? code : 303;
    this.profile();
    this.redirect(code, url);
}

function getHeader(url, code) {
    if (url.charAt(0) == "/") url = url.substring(1);
    if (url.indexOf("http") != 0) {
        url = options.site + url;
    }
    code = code ? code : 303;
    this.redirect(code, url);
}

function preprocess(req, res, next) {
    req._res = res;
    res._req = req;
    req._clientIP = Utils.parseIP(req);

    req.__callAPI = __callAPI.bind(req);

    var identifyid = req.cookies.identifyid;
    if (!identifyid) {
        identifyid = Utils.md5(req.headers["user-agent"] + req._clientIP + Date.now());
        res.cookie("identifyid", identifyid);
    }
    req._identifyID = identifyid;

    res.exec = exec.bind(res);
    res.sayError = sayError.bind(res);
    res.sayOK = sayOK.bind(res);
    res.sendBinary = sendBinary.bind(res);
    res.goPage = goPage.bind(res);
    res.profile = profile.bind(res);

    next();
};