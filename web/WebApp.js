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
var WRP = require("./WebRequestPreprocess");

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

var APP_SETTING;
var API_SESSION_AUTH_ONLY = false;

var callAPI = function(method, params) {
    var req = this;
    var user = typeof arguments[2] == "function" ? null : arguments[2];
    if (typeof user != "object") user = null;
    var callBack = typeof arguments[2] == "function" ? arguments[2] : arguments[3];
    if (typeof callBack != "function") callBack = null;
    method = method.split(".");

    return new Promise(function (resolve, reject) {

        var service = SERVICE_MAP[method[0]];
        if (!service || !service.hasOwnProperty(method[1])) {
            var err = Error.create(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
            callBack && callBack(err);
            return reject(err);
        }
        req.__callAPI(service[method[1]], params, user, function(err, data) {
            callBack && callBack(err, data);
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
App.use(BODY_PARSER.urlencoded({ extended: true, limit:'5mb' }));
App.use(BODY_PARSER.json({limit:'5mb'}));
App.use(METHOD_OVERRIDE());
App.use(COOKIE());
App.use(EXPRESS.static(PATH.join(global.APP_ROOT, "client/res")));
App.use(function(req, res, next) {
    req.callAPI = callAPI.bind(req);
    next();
});
WRP.register(App, "middle");

App.post("/api", function (req, res) {

    var method = req.body.method;
    if (!method || method == '' || method.indexOf("$") >= 0) {
        res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
        return;
    }

    method = method.split(".");
    var service = SERVICE_MAP[method[0]];
    if (!service || !service.hasOwnProperty(method[1])) {
        res.sayError(CODES.NO_SUCH_METHOD, "NO_SUCH_METHOD");
        return;
    }

    var params = req.body.data;
    if (!params) params = {};
    if (typeof params == "string") {
        try {
            params = JSON.parse(params);
        } catch (err) {
            res.sayError(CODES.REQUEST_PARAMS_INVALID, "JSON.parse(params) error ==> " + err.toString());
            return;
        }
    }

    var auth = req.body.auth;
    if (auth) {
        if (typeof auth == "string") {
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

    method = method[1];

    if (service.config.security && service.config.security[method]) {
        var security = service.config.security[method];

        var val, prop, checkType, result;
        if (security.checkParams) {
            for (prop in security.checkParams) {
                if (!params.hasOwnProperty(prop)) {
                    res.sayError(CODES.REQUEST_PARAMS_INVALID, "[" + prop + "] is required.");
                    return;
                }
                val = params[prop];
                checkType = security.checkParams[prop];
                result = App["checkRequestParam_" + checkType](val);
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
                result = App["checkRequestParam_" + checkType](val, true);
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
                if (security.allowUserType && security.allowUserType != 1 && security.allowUserType.indexOf(user.type) < 0) {
                    res.sayError(CODES.NO_PERMISSION, "NO_PERMISSION");
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

App.checkRequestParam_string = function(val, allowEmpty) {
    if (allowEmpty && (!val || val == "")) return { value:val };
    if (!val || val == "") {
        return { value:null, err:new Error("empty string") };
    }
    return { value:val };
}

App.checkRequestParam_json = function(val) {
    if (typeof val == "object") return { value:val };
    try {
        val = (val == "{}") ? {} : JSON.parse(val);
    } catch (err) {
        console.error('JSON.parse error ----> ' + val);
        return { value:null, err:err };
    }
    return { value:val };
}

App.checkRequestParam_object = function(val) {
    return App.checkRequestParam_json(val);
}

App.checkRequestParam_array = function(val) {
    if (UTIL.isArray(val)) {
        return { value:val };
    } else {
        if (typeof val != "object" && typeof val != "string") return { value:null, err:new Error("invalid Array") };

        try {
            val = (val == "[]") ? [] : JSON.parse(val);
        } catch (err) {
            console.error('JSON.parse error ----> ' + val);
            return { value:null, err:err };
        }
        return { value:val };
    }
}

App.checkRequestParam_email = function(val) {
    if (!Utils.checkEmailFormat(val)) {
        return { value:null, err:new Error("invalid email") };
    }
    return { value:val };
}

App.checkRequestParam_cellphone = function(val) {
    if (!Utils.cnCellPhoneCheck(val)) {
        return { value:null, err:new Error("invalid cellphone") };
    }
    return { value:val };
}

App.checkRequestParam_boolean = function(val) {
    if (String(val) != "true" && String(val) != "false" && String(val) != "1" && String(val) != "0") {
        return { value:null, err:new Error("invalid boolean") };
    }
    var flag = (String(val) == "true" || String(val) == "1") ? true : false;
    return { value:flag };
}

App.checkRequestParam_number = function(val) {
    if (isNaN(Number(val))) {
        return { value:null, err:new Error("NaN number") };
    }
    return { value:Number(val) };
}

App.checkRequestParam_int = function(val) {
    if (isNaN(Number(val))) {
        return { value:null, err:new Error("NaN int") };
    }
    return { value:parseInt(val) };
}

App.checkRequestParam_geo = function(val) {
    if (typeof val == "string") {
        val = val.replace(/\s/g, '')
        if (val.indexOf(",") > 0) {
            val = val.split(",");
        } else {
            try {
                val = JSON.parse(val);
            } catch (err) {
                return { value:null, err:new Error("invalid geo") };
            }
        }
    }
    val = [ Number(val[0]), Number(val[1]) ];
    if (isNaN(Number(val[0])) || isNaN(Number(val[1]))) {
        return { value:null, err:new Error("invalid geo") };
    }
    return { value:val };
}

App.checkRequestParam_qf = function(val) {
    try {
        val = Utils.convertQueryFields(val);
    } catch (err) {
        return { value:null, err:err };
    }
    return { value:val };
}

function redirectToLogin(req, res, loginPage) {
    loginPage = loginPage ? loginPage : "login";
    if (req.originalUrl == "/") {
        res.goPage(loginPage);
    } else {
        res.goPage(loginPage + "?from=" + encodeURIComponent(req.originalUrl));
    }
}

var COMMON_RESPONSE_DATA = {};

function registerRouter(r) {
    App.all(r.url, function (req, res) {

        App.handleUserSession(req, res, function(flag, user) {

            if (flag == false && r.needLogin == true) {
                redirectToLogin(req, res, r.loginPage);
                return;
            }

            if (r.allowUserType && r.allowUserType != 1 && r.allowUserType.indexOf(user.type) < 0) {
                //console.log('no permission ---> ' + r.view + '   ' + r.allowUserType);
                redirectToLogin(req, res, r.loginPage);
                return;
            }

            var now = Date.now();

            var output = function(view, user, data, err) {
                data = data ? data : {};
                if (err) {
                    res.render("error", { setting:COMMON_RESPONSE_DATA, err:err.toString(), user:user, now:now, query:req.query });
                } else {
                    res.render(view, { setting:COMMON_RESPONSE_DATA, data:data, user:user, now:now, query:req.query });
                }
            }.bind(res);

            var r_handle = null;
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

        }, function(err) {
            console.error("handle user session error ==> " + err.toString());
            redirectToLogin(req, res, r.loginPage);
        }, req.cookies, r);
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
            Session.getSharedInstance().check(userid, token, function(flag, sess, err) {
                if (err) {
                    error(err);
                } else {
                    if (flag == 1) {
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

function inject(target) {
    /*
    target.taskPool = {};
    target.addTask = function() {
        var id = "*";
        var task;
        if (typeof arguments[0] == "string") {
            id = arguments[0];
            task = arguments[1];
        } else {
            task = arguments[0];
        }
        var payload = this.taskPool[id];
        if (!payload) {
            payload = {
                tasks:[],
                queue:function(complete) {
                    Utils.runQueueTask(this.tasks, complete);
                }
            };
            this.taskPool[id] = payload;
        };
        this.taskPool[id].tasks.push(task);
    }

    target.queue = function(tasks, complete) {
        Utils.runQueueTask(tasks, complete);
    }
    target.parallel = function(tasks, complete) {
        Utils.runParallelTask(tasks, complete);
    }
     */
}

exports.start = function(setting, callBack) {
    if (isRunning) {
        console.log("ExpressApp is already running.");
        return;
    }

    APP_SETTING = setting;
    API_SESSION_AUTH_ONLY = APP_SETTING.session.apiCheck == 1;

    COMMON_RESPONSE_DATA = {
        "ENV": setting.env,
        "SITE": setting.site,
        "SITE_DOMAIN": setting.site,
        "API_GATEWAY": setting.site + "api",
        "SITE_NAME": setting.siteName,
        "RES_CDN_DOMAIN": setting.cdn.res,
        "FLASH_CDN_DOMAIN": setting.cdn.flash,
        payment: setting.payment,
        geo: setting.geo,
        upload: setting.upload,
        "COOKIE_PATH": setting.session.cookiePath
    };
    WRP.config({ site:setting.site });

    if (global.VARS.debug) {
        App.checkRequestParam_qf = function(val) {
            try {
                if (val == "*") return { value:{ } };
                val = Utils.convertQueryFields(val);
            } catch (err) {
                return { value:null, err:err };
            }
            return { value:val };
        }
    }

    Session.getSharedInstance().init(setting.session);

    var location = setting.location || {};
    var serverPath = location.server || "server";
    var routerPath = location.router || `${serverPath}/router`;
    var servicePath = location.service || `${serverPath}/service`;
    var clientPath = location.client || "client";
    var viewPath = location.view || `${clientPath}/views`;

    var doRegisterRouter = function(path, file) {
        path = path.replace(global.APP_ROOT, "").replace("\\" + serverPath + "\\", "").replace("/" + serverPath + "/", "").replace("\\", "/");
        if (file.indexOf("__") == 0 && !global.VARS.debug) return;
        var router = global.requireModule(path + "/" + file);
        if (router.hasOwnProperty('getRouterMap') && router.getRouterMap) {
            var map = router.getRouterMap();
            inject(router);
            map.forEach(function(r) {
                //if (r.handle) inject(r.handle);
                //if (r.postHandle) inject(r.postHandle);
                registerRouter(r);
            });
        }
    }

    var doRegisterService = function(path, file) {
        path = path.replace(global.APP_ROOT, "").replace("\\" + serverPath + "\\", "").replace("/" + serverPath + "/", "").replace("\\", "/");
        var service = global.requireModule(path + "/" + file);
        inject(service);
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
            if (rf.substr(rf.length - 3, 3) == ".js") {
                handler(path, rf);
            } else {
                checkFolder(PATH.join(path, rf), handler);
            }
        });
    }

    //init routers
    var routerFolder = PATH.join(global.APP_ROOT, routerPath);
    if (FS.existsSync(routerFolder)) {
        var viewEngine;
        var viewCache = String(global.VARS.viewCache) == true;
        viewPath = PATH.join(global.APP_ROOT, viewPath);
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
        }

        App.set('view engine', 'html');
        App.set('views', viewPath);
        App.set('view cache', viewCache);

        require("../utils/ViewEngineFilter").init({ engine:viewEngine, cdnUrl: setting.cdn.res });

        checkFolder(routerFolder, doRegisterRouter);
    }

    //init services
    var serviceFolder = PATH.join(global.APP_ROOT, servicePath);
    if (FS.existsSync(serviceFolder)) {
        checkFolder(PATH.join(global.APP_ROOT, servicePath), doRegisterService);
    }

    var port = setting.port;
    Server.listen(port, function() {
        isRunning = true;
        console.log("Starting WebApp at port: " + port);
        if (callBack) callBack(App);
    });

    return App;
};