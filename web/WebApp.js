/**
 * Created by Jay on 3/24/15.
 */
var PATH = require("path");
var FS = require("fs");
var UTIL = require("util");

var Model = require("./../model/Model");
var Session = require("./../model/Session");
var Utils = require("./../utils/Utils");
var CODES = require("./../ErrorCodes");
var Profiler = require("../utils/Profiler");
var WRP = require("./WebRequestPreprocess");

var ParamsChecker = require("../utils/ParamsChecker");
var AuthorityChecker = require("../utils/AuthorityChecker");

var EXPRESS  = require('express');
var BODY_PARSER = require('body-parser');
var METHOD_OVERRIDE = require('method-override');
var COOKIE = require("cookie-parser");

var isRunning = false;

var App = EXPRESS();
App.maxSockets = Infinity;
var Server = require('http').createServer(App);
App.$server = Server;

var SERVICE_MAP = { };

var ROUTER_MAP = { };

var APP_SETTING;
var API_SESSION_AUTH_ONLY = false;

var callAPI = function(method, params) {
    var req = this;
    var user = typeof arguments[2] === "function" ? null : arguments[2];
    if (typeof user !== "object") user = null;
    var callBack = typeof arguments[2] === "function" ? arguments[2] : arguments[3];
    if (typeof callBack !== "function") callBack = null;
    method = method.split(".");

    return new Promise(function (resolve, reject) {

        var service = SERVICE_MAP[method[0]];
        if (!service || !service.hasOwnProperty(method[1])) {
            var err = Error.create(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
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
/** hack for alipay notification
App.use(function(req, res, next) {
    if (req.url == '/pay_notify/alipay' && req.get('content-type') != 'application/x-www-form-urlencoded') {
        req.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    next();
});
 */
WRP.register(App, "head");
App.use(BODY_PARSER.urlencoded({ extended: true, limit:'99999mb' }));
App.use(BODY_PARSER.json({limit:'99999mb'}));
App.use(METHOD_OVERRIDE());
App.use(COOKIE());

App.use(function(req, res, next) {
    req.callAPI = callAPI.bind(req);
    next();
});
WRP.register(App, "middle");

App.post("/api", function (req, res) {

    let method = req.body.method;
    if (!method || method === '' || method.indexOf("$") >= 0) {
        res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
        return;
    }

    req.$target = method;
    method = method.split(".");
    let service = SERVICE_MAP[method[0]];
    if (!service || !service.hasOwnProperty(method[1])) {
        res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
        return;
    }

    let params = req.body.data;
    if (!params) params = {};
    if (typeof params === "string") {
        try {
            params = JSON.parse(params);
        } catch (err) {
            res.sayError(CODES.REQUEST_PARAMS_INVALID, "JSON.parse(params) error ==> " + err.toString());
            return;
        }
    }

    let auth = req.body.auth;
    if (auth) {
        if (typeof auth === "string") {
            try {
                auth = JSON.parse(auth);
            } catch (err) {
                res.sayError(CODES.REQUEST_PARAMS_INVALID, "JSON.parse(auth) error ==> " + err.toString());
                return;
            }
        }
    } else {
        auth = null;
    }
    if (!API_SESSION_AUTH_ONLY) {
        auth = auth ? auth : req.cookies;
    }

    req.$startTime = Date.now();

    method = method[1];

    if (service.config.security && service.config.security[method]) {
        let security = service.config.security[method];

        let val, prop, checkType, result;
        if (security.checkParams) {
            for (prop in security.checkParams) {
                if (!params.hasOwnProperty(prop)) {
                    res.sayError(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] is required.");
                    return;
                }
                val = params[prop];
                checkType = security.checkParams[prop];
                result = ParamsChecker.check(checkType, val);
                if (result.err) {
                    res.sayError(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] ==> " + result.err.toString());
                    return;
                }
                params[prop] = result.value;
            }
        }

        if (security.optionalParams) {
            for (prop in security.optionalParams) {
                if (!params.hasOwnProperty(prop) || params[prop] == "")  continue;
                val = params[prop];
                checkType = security.optionalParams[prop];
                result = ParamsChecker.check(checkType, val, true);
                if (result.err) {
                    res.sayError(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] ==> " + result.err.toString());
                    return;
                }
                params[prop] = result.value;
            }
        }
        App.handleUserSession(req, res, function(flag, user) {
            if (flag == false) {
                if (security.needLogin != true) {
                    service[method](req, res, params, user);
                } else {
                    res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
                }
            } else {
                if (security.allow) {
                    AuthorityChecker.check(user, security.allow, function(err, checkResult) {
                        if (checkResult) {
                            service[method](req, res, params, user);
                        } else {
                            res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
                        }
                    });
                } else {
                    service[method](req, res, params, user);
                }
            }
        }, function(err) {
            res.sayError(CODES.SERVER_ERROR, err);
        }, auth, security);
    } else {
        service[method](req, res, params);
    }
});

function redirectToLogin(req, res, loginPage) {
    loginPage = loginPage ? loginPage : "login";
    if (req.originalUrl == "/") {
        res.goPage(loginPage);
    } else {
        res.goPage(loginPage + "?from=" + encodeURIComponent(req.originalUrl));
    }
}

App.COMMON_RESPONSE_DATA = {};

function registerRouter(router) {
    if (!router.url) return;

    App.all(router.url, function (req, res) {

        var r = router;
        if (r.mobile) {
            req.__isMobile = Utils.isFromMobile(req);
            if (req.__isMobile && ROUTER_MAP[r.mobile]) {
                r = ROUTER_MAP[r.mobile];
            }
        }

        App.checkPageSessionAndAuthority(r, req, res, function(flag, user, customRedirect) {

            var now = Date.now();

            if (!flag) {
                if (customRedirect) {
                    res.render(customRedirect.view, { setting:App.COMMON_RESPONSE_DATA, user:user, now:now, query:req.query, data:customRedirect.data || {} });
                } else {
                    redirectToLogin(req, res, r.loginPage);
                }
                return;
            }

            var output = function(view, user, data, err) {
                data = data ? data : {};
                if (err) {
                    res.render("error", { setting:App.COMMON_RESPONSE_DATA, err:err.toString(), user:user, now:now, query:req.query });
                } else {
                    res.render(view, { setting:App.COMMON_RESPONSE_DATA, data:data, user:user, now:now, query:req.query, req:req });
                }
                res.profile();
            }.bind(res);

            var r_handle = null;

            req.$startTime = now;
            req.$target = r.url + "@" + req.method;

            if(req.method == "POST"){
                if (r.postHandle) r_handle = r.postHandle;
            }else{
                if (r.handle) r_handle = r.handle;
            }

            if (r_handle != null) {
                var func = function(data, err, useView) {
                    output(useView ? useView : r.view, user, data, err);
                };
                func.status = function(code) {
                    res.status(code);
                    return {
                        call: function(view, user, data, err) {
                            func.apply(res, [ view, user, data, err ]);
                        }
                    };
                };
                r_handle(req, res, func, user);
            } else {
                output(r.view, user);
            }

        });
    });
}

App.handleUserSession = function(req, res, next, error, auth) {

    var user = { isLogined:false };

    var userid = auth ? auth.userid : null;

    if (userid) {
        var token = auth ? auth.token : null;
        var tokentimestamp = Number(auth ? auth.tokentimestamp : 0);
        if (!token || !tokentimestamp || tokentimestamp <= 0) {
            //no cookies...
            next(0, user);
        } else {
            Session.getSharedInstance().check(userid, token, function(err, sess) {
                if (err) {
                    error(err, user);
                } else {
                    if (sess) {
                        //get user info from cache
                        Model.cacheRead(["user_info", userid], function(uc) {
                            if (uc) {
                                user = uc;
                            }
                            user.isLogined = true;
                            user.id = userid;
                            user.userid = userid;
                            user.token = token;
                            user.tokentimestamp = tokentimestamp;
                            user.extra = sess.extra || {};
                            user.type = parseInt(sess.type);
                            next(1, user);
                        });
                    } else {
                        next(0, user);
                    }
                }
            });
        }
    } else {
        next(0, user);
    }
}

App.checkPageSessionAndAuthority = function(router, req, res, callBack) {
    App.handleUserSession(req, res, function(flag, user, customRedirect) {
        if (!flag && router.needLogin == true) {
            if (callBack) return callBack(false, user, customRedirect);
            return;
        }
        if (router.allow) {
            AuthorityChecker.check(user, router.allow, function(err, checkResult) {
                callBack && callBack(checkResult, user, customRedirect);
            });
        } else {
            callBack && callBack(true, user, customRedirect);
        }
    }, function(err, customRedirect) {
        console.error("handle user session error: " + err.toString());
        callBack && callBack(false, customRedirect);
    }, req.cookies, router);
}

exports.start = function(setting, callBack) {
    if (isRunning) {
        console.log("ExpressApp is already running.");
        return;
    }

    APP_SETTING = setting;
    API_SESSION_AUTH_ONLY = APP_SETTING.session && APP_SETTING.session.apiCheck == 1;

    if (setting.cors && String(setting.cors.enable) === "true") {
        console.log('cors: enabled');
        App.use(function(req, res, next) {
            if (setting.cors.origin) {
                if (!new RegExp(setting.cors.origin, "img").test(req.headers.origin)) {
                    //not allow
                    res.writeHead(403);
                    return res.end();
                }
            }
            res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
            res.setHeader("Access-Control-Allow-Credentials", true);
            res.setHeader("Access-Control-Allow-Headers", setting.cors.allowHeaders || "P3P,DNT,X-Mx-ReqToken,X-Requested-With,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type");
            res.setHeader('Access-Control-Allow-Methods', setting.cors.allowMethods || 'PUT, POST, GET, DELETE, OPTIONS');
            next();
        });
    }

    var apiCompress = setting.compress ? setting.compress.api : false;

    App.COMMON_RESPONSE_DATA = {
        "ENV": setting.env,
        "SITE": setting.site,
        "SITE_DOMAIN": setting.site,
        "API_GATEWAY": setting.site + "api",
        "API_COMPRESS": apiCompress,
        "SITE_NAME": setting.siteName,
        "RES_CDN_DOMAIN": setting.cdn.res,
        payment: setting.payment,
        geo: setting.geo,
        upload: setting.upload,
        "COOKIE_PATH": setting.session ? (setting.session.cookiePath || "/") : "/"
    };
    WRP.config({ site:setting.site, compress:apiCompress });

    Session.getSharedInstance().init(setting.session);

    var location = setting.location || {};
    var serverPath = location.server || "server";
    var routerPath = location.router || `${serverPath}/router`;
    var servicePath = location.service || `${serverPath}/service`;
    var clientPath = location.client || "client";
    var defaultViewPath = PATH.join(global.APP_ROOT, "client/dist/views");
    if (!Utils.fileExistsSync(defaultViewPath)) {
        defaultViewPath = PATH.join(global.APP_ROOT, "client/views");
        if (!Utils.fileExistsSync(defaultViewPath)) {
            defaultViewPath = null;
        }
    }

    var viewPath = location.view || defaultViewPath;

    var defaultStaticResPath = PATH.join(global.APP_ROOT, "client/dist/res");
    if (!Utils.fileExistsSync(defaultStaticResPath)) {
        defaultStaticResPath = PATH.join(global.APP_ROOT, "client/res");
        if (!Utils.fileExistsSync(defaultStaticResPath)) {
            defaultStaticResPath = null;
        }
    }

    var staticResPath = location.res || defaultStaticResPath;
    if (staticResPath) {
        App.use(EXPRESS.static(staticResPath));
    }
    console.log('use view folder: ' + viewPath);
    console.log('use static res folder: ' + staticResPath);

    var doRegisterRouter = function(path, file) {
        path = path.replace(global.APP_ROOT, "").replace("\\" + serverPath + "\\", "").replace("/" + serverPath + "/", "").replace("\\", "/");
        if (file.indexOf("__") === 0 && !global.VARS.debug) return;
        var router = global.requireModule(path + "/" + file);
        if (router.hasOwnProperty('getRouterMap') && router.getRouterMap) {
            var map = router.getRouterMap();
            map.forEach(function(r) {
                //if (r.handle) inject(r.handle);
                //if (r.postHandle) inject(r.postHandle);
                if (r.id) ROUTER_MAP[r.id] = r;
                registerRouter(r);
            });
        }
    }

    var doRegisterService = function(path, file) {
        path = path.replace(global.APP_ROOT, "").replace("\\" + serverPath + "\\", "").replace("/" + serverPath + "/", "").replace("\\", "/");
        var service = global.requireModule(path + "/" + file);
        if (service.config && service.config.name && service.config.enabled == true) {
            SERVICE_MAP[service.config.name] = service;
        }
    }

    var checkFolder = function(path, handler) {
        var files = [];
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

    //init routers
    var routerFolder = PATH.join(global.APP_ROOT, routerPath);
    if (Utils.fileExistsSync(routerFolder)) {
        var viewEngine;
        var viewCache = String(global.VARS.viewCache) === "true";
        if (setting.viewEngine && setting.viewEngine.init) {
            viewEngine = setting.viewEngine.init(App, viewPath, viewCache);
        } else {
            var nunjucks = require("nunjucks");
            var nunjucksEnv = nunjucks.configure(viewPath, {
                autoescape: true,
                express: App,
                noCache: !viewCache,
                web: {
                    useCache: viewCache
                }
            });
            nunjucks.$setFilter = function(key, func) {
                nunjucksEnv.addFilter(key, func);
            };
            viewEngine = nunjucks;
            App.set('view engine', 'html');
        }

        App.set('views', viewPath);
        App.set('view cache', viewCache);

        require("../utils/ViewEngineFilter").init({ engine:viewEngine, cdnUrl: setting.cdn.res });

        checkFolder(routerFolder, doRegisterRouter);
    }
    if (global.VARS.debug) {
        require("./__test.js").getRouterMap().forEach(function(r) {
            registerRouter(r);
        });
    }

    //init services
    var serviceFolder = PATH.join(global.APP_ROOT, servicePath);
    if (Utils.fileExistsSync(serviceFolder)) {
        checkFolder(PATH.join(global.APP_ROOT, servicePath), doRegisterService);
    }

    var port = setting.port;
    /**
    if (setting.clusterMode == "inc_port") {
        port = port + (parseInt(global.workerID) || 0);
    }
    */
    Server.listen(port, function() {
        isRunning = true;
        console.log("Starting WebApp at port: " + port);
        if (callBack) callBack(App);
    });

    return App;
};