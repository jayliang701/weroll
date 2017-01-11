/**
 * Created by Jay on 2015/9/10.
 */

var UTIL = require("util");
var Utils = require("./../utils/Utils");
var CODES = require("./../ErrorCodes");

var options;

var injects = { head:[], middle:[ preprocess ] };

exports.config = function(opt) {
    options = opt;
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

function sayError() {
    var code, msg;
    if (arguments.length == 1 && arguments[0]) {
        if (UTIL.isArray(arguments[0])) {
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
    this.json({code:code, data:{}, msg:msg});
}

function sayOK(data, headers) {
    var responseHeader = { "Content-Type": "application/json" };
    if (headers) {
        for (var key in headers) {
            responseHeader[key] = headers[key];
        }
    }
    if (arguments.length == 0) data = { flag:1 };
    var resBody = JSON.stringify({code: CODES.OK, data:data, msg:"OK"});
    responseHeader['Content-Length'] = Buffer.byteLength(resBody, "utf8");
    this.writeHead(200, responseHeader);
    this.end(resBody);
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
            if (UTIL.isArray(arguments[0])) {
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
}

function goPage(url, code) {
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

    next();
};