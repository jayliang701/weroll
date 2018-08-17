/**
 * Created by Jay on 3/24/15.
 */
const PATH = require("path");
const FS = require("fs");

const Session = require("./../model/Session");
const Utils = require("./../utils/Utils");
const CODES = require("./../ErrorCodes");
const WRP = require("./WebRequestPreprocess");

const ParamsChecker = require("../utils/ParamsChecker");
const AuthorityChecker = require("../utils/AuthorityChecker");

const EXPRESS  = require('express');
const BODY_PARSER = require('body-parser');
const METHOD_OVERRIDE = require('method-override');
const COOKIE = require("cookie-parser");

let isRunning = false;

const App = EXPRESS();
App.maxSockets = Infinity;
const Server = require('http').createServer(App);
App.$server = Server;

const SERVICE_MAP = { };

const ROUTER_MAP = { };

let APP_SETTING;
let API_SESSION_AUTH_ONLY = false;

const callAPI = function(method, params) {
    let req = this;
    let user = typeof arguments[2] === "function" ? null : arguments[2];
    if (typeof user !== "object") user = null;
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

App.post("/api", async function (req, res) {

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

    let auth = req.headers["authorization"] || params.auth;
    if (!API_SESSION_AUTH_ONLY) {
        auth = auth ? auth : req.cookies["authorization"];
    }
    if (auth) {
        if (auth.startsWith("Bearer ")) {
            auth = auth.substr("Bearer ".length);
        }
    }

    req.$startTime = Date.now();

    method = method[1];

    let doJob = service[method];

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

        App.handleUserSession(req, res, auth).then(async user => {
            try {
                if (user && user.isLogined) {
                    if (security.allow) {
                        try {
                            await AuthorityChecker.check(user, security.allow);
                        } catch (err) {
                            return res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
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

function redirectToLogin(req, res, loginPage) {
    loginPage = loginPage ? loginPage : "login";
    if (req.originalUrl == "/") {
        res.goPage(loginPage);
    } else {
        res.goPage(loginPage + "?from=" + encodeURIComponent(req.originalUrl));
    }
}

App.authFailHandler = function(req, res, router, user) {
    redirectToLogin(req, res, router ? router.loginPage : null);
}

App.COMMON_RESPONSE_DATA = {};

function registerRouter(router) {
    if (!router.url) return;

    App.all(router.url, function (req, res) {

        let r = router;
        if (r.mobile) {
            req.__isMobile = Utils.isFromMobile(req);
            if (req.__isMobile && ROUTER_MAP[r.mobile]) {
                r = ROUTER_MAP[r.mobile];
            }
        }

        let auth =  req.cookies["authorization"] || req.headers["authorization"];
        if (auth) {
            if (auth.startsWith("Bearer ")) {
                auth = auth.substr("Bearer ".length);
            }
        }

        App.handleUserSession(req, res, auth).then(async user => {
            const now = Date.now();

            if (router.needLogin && !(user && user.isLogined)) {
                return App.authFailHandler(req, res, r, user);
            }

            const output = function(view, user, data, err) {
                data = data ? data : {};
                if (err) {
                    res.render("error", { setting:App.COMMON_RESPONSE_DATA, err, user, now, query:req.query });
                } else {
                    res.render(view, { setting:App.COMMON_RESPONSE_DATA, data, user, now, query:req.query });
                }
                res.profile();
            }.bind(res);

            if (router.allow) {
                try {
                    await AuthorityChecker.check(user, router.allow);
                } catch (err) {
                    return App.authFailHandler(req, res, r, user);
                }
            }

            let r_handle = null;

            req.$startTime = now;
            req.$target = r.url + "@" + req.method;

            if (req.method === "POST"){
                if (r.postHandle) r_handle = r.postHandle;
            } else {
                if (r.handle) r_handle = r.handle;
            }

            if (r_handle != null) {
                let func = function(data, err, useView) {
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
                let result = r_handle(req, res, func, user);
                if (result !== undefined && result !== null && (typeof result === "object" || result instanceof Array)) {
                    func(result);
                }
            } else {
                output(r.view, user);
            }
        });
    });
}

App.handleUserSession = function(req, res, auth) {
    return new Promise((resolve) => {
        let user = { isLogined:false };

        if (!auth) return resolve(user);

        Session.getSharedInstance().check(auth, (err, sess) => {
            if (err) return resolve(user);

            user = sess;
            user.isLogined = true;
            user.id = user.userid;
            user.auth = auth;
            
            resolve(user);
        });
    });
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
            res.setHeader("Access-Control-Allow-Headers", setting.cors.allowHeaders || "Authorization,P3P,DNT,X-Mx-ReqToken,X-Requested-With,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type");
            res.setHeader('Access-Control-Allow-Methods', setting.cors.allowMethods || 'PUT, POST, GET, DELETE, OPTIONS');
            next();
        });
    }

    let apiCompress = setting.compress ? setting.compress.api : false;

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

    let location = setting.location || {};
    let serverPath = location.server || "server";
    let routerPath = location.router || `${serverPath}/router`;
    let servicePath = location.service || `${serverPath}/service`;
    let clientPath = location.client || "client";
    let defaultViewPath = PATH.join(global.APP_ROOT, clientPath, "dist/views");
    if (!Utils.fileExistsSync(defaultViewPath)) {
        defaultViewPath = PATH.join(global.APP_ROOT, clientPath, "views");
        if (!Utils.fileExistsSync(defaultViewPath)) {
            defaultViewPath = null;
        }
    }

    let viewPath = location.view || defaultViewPath;

    let defaultStaticResPath = PATH.join(global.APP_ROOT, clientPath, "dist/res");
    if (!Utils.fileExistsSync(defaultStaticResPath)) {
        defaultStaticResPath = PATH.join(global.APP_ROOT, clientPath, "res");
        if (!Utils.fileExistsSync(defaultStaticResPath)) {
            defaultStaticResPath = null;
        }
    }

    let staticResPath = location.res || defaultStaticResPath;
    if (staticResPath) {
        App.use(EXPRESS.static(staticResPath));
    }
    console.log('use view folder: ' + viewPath);
    console.log('use static res folder: ' + staticResPath);

    let doRegisterRouter = function(path, file) {
        path = path.replace(global.APP_ROOT, "").replace("\\" + serverPath + "\\", "").replace("/" + serverPath + "/", "").replace("\\", "/");
        if (file.indexOf("__") === 0 && !global.VARS.debug) return;
        let router = global.requireModule(path + "/" + file);
        if (router.hasOwnProperty('getRouterMap') && router.getRouterMap) {
            let map = router.getRouterMap();
            map.forEach(function(r) {
                //if (r.handle) inject(r.handle);
                //if (r.postHandle) inject(r.postHandle);
                if (r.id) ROUTER_MAP[r.id] = r;
                registerRouter(r);
            });
        }
    }

    let doRegisterService = function(path, file) {
        path = path.replace(global.APP_ROOT, "").replace("\\" + serverPath + "\\", "").replace("/" + serverPath + "/", "").replace("\\", "/");
        let service = global.requireModule(path + "/" + file);
        if (service.config && service.config.name && service.config.enabled == true) {
            SERVICE_MAP[service.config.name] = service;
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

    //init routers
    let routerFolder = PATH.join(global.APP_ROOT, routerPath);
    if (Utils.fileExistsSync(routerFolder)) {
        let viewEngine;
        let viewCache = String(global.VARS.viewCache) === "true";
        if (setting.viewEngine && setting.viewEngine.init) {
            viewEngine = setting.viewEngine.init(App, viewPath, viewCache);
        } else {
            let nunjucks = require("nunjucks");
            let nunjucksEnv = nunjucks.configure(viewPath, {
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
    let serviceFolder = PATH.join(global.APP_ROOT, servicePath);
    if (Utils.fileExistsSync(serviceFolder)) {
        checkFolder(PATH.join(global.APP_ROOT, servicePath), doRegisterService);
    }

    let port = setting.port;
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