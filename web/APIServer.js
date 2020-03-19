/**
 * Created by jay on 8/27/16.
 */
const FS = require("fs");
const PATH = require("path");

const Model = require("../model/Model");
const Redis = require("../model/Redis");
const Session = require("../model/Session");
const Utils = require("../utils/Utils");
const Profiler = require("../utils/Profiler");
const CODES = require("./../ErrorCodes");

const DEBUG = global.VARS && global.VARS.debug;
const PROFILING = global.VARS && global.VARS.profiling;

const PureHttp = require("../net/PureHttp");
const JsonAPIMiddleware = PureHttp.JsonAPIMiddleware;
const DEBUG_SERVICE_LIST = [];

function CustomMiddleware(options) {
    options = options || {};

    let jam = new JsonAPIMiddleware();

    if (options.compress) {
        jam.generateAPIHeader = function() {
            return { "Content-Type": "application/octet-stream" };
        };
        jam.encodeAPIData = function(data) {
            return jsonZip(data);
        };
        jam.getAPIDataLength = function(data) {
            return data.length;
        };
    }

    if (options.cors && String(options.cors.enable) === "true") {
        console.log('cors: enabled');
        jam.processCORS = function(req, res) {
            if (!options.cors.proxy) {
                res.setHeader("Access-Control-Allow-Origin", options.cors.origin || "*");
                res.setHeader("Access-Control-Allow-Credentials", true);
                res.setHeader("Access-Control-Allow-Headers", options.cors.allowHeaders || "Authorization,P3P,DNT,X-Mx-ReqToken,X-Requested-With,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type");
                res.setHeader('Access-Control-Allow-Methods', options.cors.allowMethods || 'PUT, POST, GET, DELETE, OPTIONS');
            }
            return true;
        }
    } else {
        console.log('cors: disabled');
        jam.processCORS = function(req, res) {
            return false;
        }
    }

    function profiling(req) { }
    if (PROFILING) {

        let profiler = new Profiler(options.profiling);
        profiler.start();

        profiling = function(req) {
            profiler.recordRequest(req);
        }
    }

    let setResponseAuth = function(token) {
        let arg = arguments[0];
        if (arg == null || arg === undefined) {
            this.removeHeader("Authorization");
            return;
        }
        if (arg && typeof arg === "object") {
            token = arg.auth || arg.token;
        }
        this.setHeader("Authorization", token || "");
    }

    this.processCORS = function(req, res) {
        return jam.processCORS(req, res);
    }

    this.preprocess = function(req, res) {

        this.processCORS(req, res);

        res.setAuth = setResponseAuth.bind(res);

        req._res = res;
        res._req = req;
        req._clientIP = Utils.parseIP(req);

        jam.preprocess(req, res);

        res.profile = function() {
            profiling(req);
        }
    }

    this.process = function(req, res, data, handler) {
        jam.process(req, res, data, handler);
    }
}

function APIServer() {

    let instance = this;

    let server = PureHttp.createServer();

    this.server = server;

    this.ParamsChecker = require("../utils/ParamsChecker");
    this.AuthorityChecker = require("../utils/AuthorityChecker");

    if (DEBUG) {
        //show api debug page
        server.get("/__apidoc", function(req, res, params) {
            let callback = require("url").parse(req.url, true).query.callback;
            res.writeHead(200, {
                "Content-Type":"text/plain; charset=utf-8"
            });
            res.end(callback + "(" + JSON.stringify(DEBUG_SERVICE_LIST) + ")");
        });

        server.get("/__test", function(req, res, params) {
            let html = "";
            let compress = instance.APP_SETTING.compress ? instance.APP_SETTING.compress.api : false;
            try {
                html = FS.readFileSync(PATH.join(__dirname, "./__test.html"), {encoding:"utf8"});
                html = html.replace('<head>', `<head><script>window.API_COMPRESS = ${compress}</script>`);
            } catch (exp) {
                console.error(exp);
                res.writeHead(404);
                res.end();
                return;
            }
            res.end(html);
        });
    }

    let SERVICE_MAP = {};
    instance.APP_SETTING = null;

    let callAPI = function(method, params) {
        let req = this;
        let user = typeof arguments[2] === "function" ? null : arguments[2];
        if (typeof user !== "object") user = { isLogined:false };
        let callBack = typeof arguments[2] === "function" ? arguments[2] : arguments[3];
        if (typeof callBack !== "function") callBack = null;
        method = method.split(".");

        return new Promise(function (resolve, reject) {

            let service = SERVICE_MAP[method[0]];
            if (!service || !service.hasOwnProperty(method[1])) {
                let err = Error.create(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
                if (callBack) return callBack(err);
                return reject(err);
            }
            req.__callAPI(service[method[1]], params, user, function(err, data) {
                if (callBack) return callBack(err, data);
                if (err) reject(err);
                else resolve(data);
            });
        });
    };

    server.post("/api", async function(req, res, params) {
        let method = params.method;
        if (!method || method === '' || method.indexOf("$") >= 0) {
            res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
            return;
        }

        req.$target = method;
        req.$startTime = Date.now();

        method = method.split(".");
        let service = SERVICE_MAP[method[0]];
        if (!service || !service.hasOwnProperty(method[1])) {
            res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
            return;
        }

        let auth = (req.headers["authorization"] || req.headers["Authorization"]) || params.auth;
        if (auth) {
            if (auth.startsWith("Bearer ")) {
                auth = auth.substr("Bearer ".length);
            }
        }

        params = params.data;
        if (!params) params = {};
        if (typeof params === "string") {
            try {
                params = JSON.parse(params);
            } catch (err) {
                res.sayError(CODES.REQUEST_PARAMS_INVALID, "JSON.parse(params) error ==> " + err.toString());
                return;
            }
        }

        method = method[1];

        instance.preprocess(req, res, auth, params);

        let doJob = service[method];

        if (service.config.security && service.config.security[method]) {
            let security = service.config.security[method];

            let err = instance.checkParams(params, security.checkParams, security.optionalParams);
            if (err) {
                res.sayError(err);
                return;
            }

            req.callAPI = callAPI.bind(req);

            instance.handleUserSession(req, res, auth, security).then(async user => {
                try {
                    if (user && user.isLogined) {
                        if (security.allow) {
                            let flag;
                            try {
                                flag = await instance.AuthorityChecker.check(user, security.allow, req, res, security);
                            } catch (err) {
                                return res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
                            }
                            if (flag === -1) {
                                //use custom fail handler
                                //interrupt
                                return;
                            }
                        }
                    } else if (security.needLogin) {
                        return res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
                    }
                    let ret = await doJob(params, user, req, res);
                    res.sayOK(ret);
                } catch (err) {
                    res.sayError(err);
                }
            }).catch(err => {
                res.sayError(CODES.SERVER_ERROR, err);
            });
        } else {
            try {
                let ret = await doJob(params, {}, req, res);
                res.sayOK(ret);
            } catch (err) {
                res.sayError(err);
            }
        }
    });

    this.preprocess = function (req, res, auth, params) {

    }

    this.checkParams = function(params, checkParams, optionalParams) {
        let val, prop, checkType, result;
        if (checkParams) {
            for (prop in checkParams) {
                if (!params.hasOwnProperty(prop)) {
                    return Error.create(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] is required.");
                }
                val = params[prop];
                checkType = checkParams[prop];
                result = instance.ParamsChecker.check(checkType, val);
                if (result.err) {
                    return Error.create(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] ==> " + result.err.toString());
                }
                params[prop] = result.value;
            }
        }

        if (optionalParams) {
            for (prop in optionalParams) {
                if (!params.hasOwnProperty(prop) || params[prop] == "")  continue;
                val = params[prop];
                checkType = optionalParams[prop];
                result = instance.ParamsChecker.check(checkType, val, true);
                if (result.err) {
                    return Error.create(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] ==> " + result.err.toString());
                }
                params[prop] = result.value;
            }
        }
    }

    this.handleUserSession = function(req, res, auth) {
        return new Promise((resolve) => {
            let user = { isLogined:false };

            if (!String(auth).hasValue()) return resolve(user);

            this.Session.check(auth, (err, sess) => {
                if (err) return resolve(user);

                user = sess;
                user.isLogined = true;
                user.id = user.userid;
                user.auth = auth;
                
                resolve(user);
            });
        });
    }

    this.start = function(setting, callBack) {
        this.APP_SETTING = setting;

        server.middleware(new CustomMiddleware({
            compress:setting.compress ? setting.compress.api : false,
            profiling:setting.profiling,
            cors:setting.cors || { enable:false }
        }));

        if (setting.session && typeof setting.session == "object") {
            if (setting.session.constructor == Object) {
                this.Session = new Session();
                this.Session.init(setting.session);
            } else if (setting.session.constructor == Session) {
                this.Session = setting.session;
            }
        } else {
            this.handleUserSession = function(req, res, next, error, auth) {
                next(0, { isLogined:false });
            }
        }

        let doRegisterService = function(path, file) {
            path = path.replace(global.APP_ROOT, "").replace("\\server\\", "").replace("/server/", "").replace("\\", "/");
            let service = global.requireModule(path + "/" + file);

            if (service.config && service.config.name && service.config.enabled == true) {
                SERVICE_MAP[service.config.name] = service;

                if (DEBUG_SERVICE_LIST) {

                    let scripts = FS.readFileSync(PATH.join(global.APP_ROOT, "server/service/" + file), { encoding:"utf-8" });

                    let methods = [];
                    for (let key in service) {
                        let val = service[key];
                        if (typeof val != "function" || key.indexOf("$") == 0) continue;
                        let security = service.config.security && service.config.security[key] ? service.config.security[key] : {};
                        let def = { name: service.config.name + "." + key, security:security, index:methods.length, desc:"", paramsDesc:{} };
                        methods.push(def);

                        //parse comments
                        let comment = scripts.match(new RegExp("//@" + key + "( )+.*[\r\n]+"));
                        if (comment && comment[0]) {
                            comment = comment[0].trim();
                            let args = comment.match(new RegExp("@[a-zA-Z0-9]+( )+[^@\r\n]+", "g"));
                            if (args && args.length > 0) {
                                def.desc = args[0].substring(args[0].indexOf(" ")).trim();
                                if (args.length > 1) {
                                    for (let i = 1; i < args.length; i++) {
                                        let argName = args[i].substring(1, args[i].indexOf(" ")).trim();
                                        let argDesc = args[i].substring(args[i].indexOf(" ")).trim();
                                        def.paramsDesc[argName] = argDesc;
                                    }
                                }
                            }
                        }
                    }
                    DEBUG_SERVICE_LIST.push({ index:DEBUG_SERVICE_LIST.length, group:file.replace("Service.js", ""), methods:methods });
                }
            }
        }

        let checkFolder = function(path, handler) {
            let files = [];
            try {
                files = FS.readdirSync(path);
            } catch (exp) {
                return;
            }
            files.forEach(function(rf) {
                if (rf.substr(rf.length - 3, 3) === ".js") {
                    handler(path, rf);
                } else {
                    checkFolder(PATH.join(path, rf), handler);
                }
            });
        }

        //init services
        let serviceFolder = PATH.join(global.APP_ROOT, "server/service");
        if (FS.existsSync(serviceFolder)) {
            checkFolder(PATH.join(global.APP_ROOT, "server/service"), doRegisterService);
        }

        let port = setting.port;
        server.start({ port:port, ip:setting.host }, function() {
            console.log("Starting APIServer at port: " + port);
            if (callBack) callBack(instance, server);
        });

        return server;
    };
}

require("util").inherits(APIServer, require('events'));

exports.createServer = function() {
    let server = new APIServer();
    return server;
}

