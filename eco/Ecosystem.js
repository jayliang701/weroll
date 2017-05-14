/**
 * Created by Jay on 2016/5/10.
 */

var Utils = require("./../utils/Utils");
var CODES = require("./../ErrorCodes");
var Redis = require("../model/Redis");
var request = require("min-request");

var agent;

var Setting = global.SETTING;
var DEBUG = global.VARS.debug;

var server;
var redisSub, redisPub;
var server_notifyHandlers = {};
var client_registerHandler = {};

exports.getSetting = function() {
    return Setting.ecosystem;
}

exports.onServeReady = function(target, handler) {
    if (exports[target]) {
        handler && handler();
        return;
    }
    if (!client_registerHandler[target]) client_registerHandler[target] = [];
    client_registerHandler[target].push(handler);
}

exports.__register = function(target, client) {
    var Payload = function(name, client) {
        var ins = this;
        this.client = client;
        this.name = name;
        this.callAPI = function(method, params, callBack) {
            return exports.__callAPI(ins.name, method, params, callBack);
        }
        this.fire = ins.client.fire;
        this.listen = ins.client.listen;
        this.unListen = ins.client.unListen;
    }
    if (DEBUG) console.log("[Ecosystem] register *" + target + "*");
    exports[target] = new Payload(target, client);

    if (client_registerHandler && client_registerHandler[target]) {
        client_registerHandler[target].forEach(function(handler) {
            if (handler) handler();
        });
        delete client_registerHandler[target];
    }
}

exports.callAPI = function() {
    if (typeof arguments[0] == "string" && typeof arguments[1] == "string") {
        return exports.__callAPI.apply(this, [ arguments[0], arguments[1], arguments[2], arguments[3] ]);
    } else {
        return exports.__callAPI.apply(this, [ "core", arguments[0], arguments[1], arguments[2] ]);
    }
}

exports.__callAPI = function(target, method, params, callBack) {
    return new Promise(function (resolve, reject) {
        //if (DEBUG) console.log("[Ecosystem] call *" + target + "* api --> " + method);
        var URL = Setting.ecosystem.servers[target].api;
        var postData = {};
        if (params) {
            postData = params;
        }
        request(URL,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                method: "POST",
                body: { method:method, data:postData }
            },
            function(err, res, body) {
                //if (DEBUG) console.log("[Ecosystem] *" + target + "* response --> ");
                if (err) {
                    console.error(err);
                    err = Error.create(CODES.ECOSYSTEM_ERROR, err.message || err.toString());
                    if (callBack) return callBack(err);
                    reject(err);
                } else {
                    //if (DEBUG) console.log(body);

                    if (typeof body == "string") {
                        try {
                            body = JSON.parse(body);
                        } catch (exp) {
                            err = Error.create(CODES.ECOSYSTEM_ERROR, exp.toString());
                            body = null;
                        }
                    }

                    if (!err && body.code > 1) {
                        //error response
                        err = Error.create(body.code, body.msg);
                        body = null;
                    } else {
                        body = body ? body.data : null;
                    }

                    if (callBack) return callBack(err, body);
                    err ? reject(err) : resolve(body);
                }
            });
    });
}

global.__defineGetter__('Ecosystem', function() {
    return exports;
});

var Client = function(name) {
    var ins = this;
    this.name = name;

    this.connect = function(serverName, host) {
        ins.serverName = serverName;
        ins.serverHost = host;
        Client.clients[serverName] = ins;
        Ecosystem.__register(serverName, ins);
    }

    this.fire = function(event, data, callBack) {
        return exports.fire(ins.serverName, event, data, callBack);
    }

    this.listen = function(event, handler) {
        exports.listen(ins.serverName, event, handler);
    }

    this.unListen = function(event, handler) {
        exports.unListen(ins.serverName, event, handler);
    }
}

Client.clients = {};

exports.init = function(config, customSetting, callBack) {

    callBack = arguments[arguments.length - 1];
    if (typeof callBack != "function") callBack = null;

    Setting = customSetting || Setting;
    config = config || {};
    agent = config.agent;

    /* setup server */
    var options = {
        env:global.VARS.env,
        host:Setting.ecosystem.host || "localhost",
        port:Setting.ecosystem.port
    };
    server = require("../web/APIServer").createServer();
    server.start(options, function(app) {

        app.server.post("/message", function (req, res, params) {
            var client = params.client;
            var event = params.event;
            var data = params.data;

            //if (DEBUG) console.log("receive message from *" + client + "* ---> [" + event + "]");

            res.end("{}");

            var list = server_notifyHandlers[client + "@" + event];
            if (list && list.length > 0) {
                list.forEach(function(handler) {
                    if (handler) handler(data, client);
                });
            }

            list = server_notifyHandlers[event];
            if (list && list.length > 0) {
                list.forEach(function(handler) {
                    if (handler) handler(data, client);
                });
            }
        });

        app.handleUserSession = function(req, res, next, error, auth) {
            var user = { isLogined:false };
            next(0, user);
        }
    });

    /* setup client */
    var servers = Setting.ecosystem.servers;
    if (servers) {
        for (var name in servers) {
            var client = new Client(Setting.ecosystem.name);
            var def = servers[name];
            client.connect(name, def.message);
        }
    }

    /* setup redis */
    var redisReady = function () {
        //Todo: some works after redisSub/redisPub are ready
        if (!redisSub.__ready || !redisPub.__ready) return;
        callBack && callBack();
    };

    var redisConfig = Setting.ecosystem.redis || global.SETTING.model.redis;
    redisSub = Redis.createClient(redisConfig);
    redisPub = Redis.createClient(redisConfig);
    redisSub.on("message", function(channel, message) {
        if (channel == "notify") {
            try {
                message = JSON.parse(message);
            } catch (err) {
                return console.error("parse redis notify error:", err);
            }

            var client = message[0];
            var event = message[1];
            var data = message[2];
            var onlyTargets = message[3];

            if (onlyTargets != null && onlyTargets != undefined && onlyTargets != "") {
                if (typeof onlyTargets == "string") onlyTargets = [ onlyTargets ];
                if (onlyTargets.indexOf(Setting.ecosystem.name) < 0) {
                    //ignore
                    return;
                }
            }

            var list = server_notifyHandlers[client + "@" + event];
            if (list && list.length > 0) {
                list.forEach(function(handler) {
                    if (handler) handler(data);
                });
            }

            list = server_notifyHandlers[event];
            if (list && list.length > 0) {
                list.forEach(function(handler) {
                    if (handler) handler(data);
                });
            }
        }
    });
    redisSub.on("connect", function() {
        redisSub.subscribe("notify", function() {
            redisSub.__ready = true;
            redisReady();
        });
    });
    redisPub.on("connect", function() {
        redisPub.__ready = true;
        redisReady();
    });
}

exports.broadcast = function(event, data, onlyTargets, callBack) {

    callBack = arguments[arguments.length - 1];
    if (typeof callBack != "function") callBack = null;

    onlyTargets = typeof onlyTargets == "function" ? "" : onlyTargets;
    if (!onlyTargets) onlyTargets = "";

    if (event.indexOf("@") > 0) {
        event = event.split("@");
        event = event[1];
    }
    return exports.__fireToAll(event, data, onlyTargets, callBack);
}

exports.fire = function(target, event, data, callBack) {
    var address = Setting.ecosystem.servers[target]["message"];
    return exports.__fire(address, event, data, callBack);
}

exports.__fire = function(target, event, data, callBack) {
    return new Promise(function (resolve, reject) {
        request(target + "/message",
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                method: "POST",
                body: { event:event, data:data, client:Setting.ecosystem.name }
            },
            function(err, res, body) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(err);
                }
                if (typeof body == "string") {
                    try {
                        body = JSON.parse(body);
                    } catch (exp) {
                        err = exp;
                        body = null;
                    }
                }
                if (err) {
                    if (callBack) return callBack(err, body);
                    return reject(err);
                }
                if (callBack) return callBack(null, body);
                return resolve(body);
            });
    });
}

exports.__fireToAll = function(event, data, onlyTargets, callBack) {
    return new Promise(function (resolve, reject) {
        if (!redisPub) return;
        redisPub.publish("notify", JSON.stringify([ Setting.ecosystem.name, event, data, onlyTargets ]), function(err) {
            if (err) console.error(`redisPub.publish error ---> ${err}`);
            if (callBack) return callBack(err);
            if (err) return reject(err);
            resolve();
        });
    });
}

exports.listen = function(target, event, handler) {
    var key = target + "@" + event;
    var list = server_notifyHandlers[key];
    if (!list) {
        list = [];
        server_notifyHandlers[key] = list;
    }
    if (list.indexOf(handler) >= 0) return;
    list.push(handler);
}

exports.listenAll = function(event, handler) {
    var key = event;
    var list = server_notifyHandlers[key];
    if (!list) {
        list = [];
        server_notifyHandlers[key] = list;
    }
    if (list.indexOf(handler) >= 0) return;
    list.push(handler);
}

exports.unListen = function(target, event, handler) {
    var key = target + "@" + event;
    var list = server_notifyHandlers[key];
    if (!list)  return;

    var index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
}