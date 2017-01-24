/**
 * Created by Jay on 2017/1/22.
 */
var Websocket = require("../net/Websocket");
var Session = require("../model/Session");

exports.createServer = function(config, noGlobal) {
    if (config.cluster && config.cluster.enable) {
        //enable cluster
        config = cloneObject(config);
        if (!config.port) throw new Error("must set port number for cluster.");
        config.port = config.port + parseInt(global.workerID);
    }
    var server = new Websocket(config);
    var AdpaterClass = config.adpater || DefaultAdapter;
    var adapter = new AdpaterClass(server);

    server.on("connection", function(socket) {

        var config = server.config;

        //connect
        adapter.connect(socket, function() {
            //shakehand
            socket.on("$init", function(data) {
                clearTimeout(socket.initTimer);
                socket.initTimer = undefined;

                server.traceLog(`client *${socket.id}* start shakehand...`);

                adapter.shakehand(socket, data, function(flag) {
                    adapter.shakehandComplete(socket, flag, function (flag) {
                        if (flag) {
                            adapter.shakehandSuccess(socket);
                            server.emit("shakeHandeSuccess", socket);
                        } else {
                            adapter.shakehandFail(socket);
                            server.emit("shakehandFail", socket);
                        }
                    });
                });
            });
        });
    });

    server.on("disconnect", function(socket) {
        adapter.disconnect(socket);
    });

    server.on("start", function(io) {
        adapter.start(io);
    });

    !noGlobal && global.__defineGetter__('Realtime', function() {
        return server;
    });

    return server;
}

function DefaultAdapter(server) {
    var instance = this;
    this.server = server;
    this.config = server.config;
    this.Session = server.config.session || Session.getSharedInstance();
    var traceLog = server.traceLog;
    var traceError = server.traceError;
    var traceInfo = server.traceInfo;

    var enterRoom = function(room, callBack) {
        var socket = this;
        return new Promise(function(resolve, reject) {
            socket.join(room, function (err) {
                if (callBack) return callBack(err);
                err ? reject(err) : resolve();
            });
        });
    }

    var leaveRoom = function(room, callBack) {
        var socket = this;
        return new Promise(function(resolve, reject) {
            socket.leave(room, function (err) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(err);
                }
                resolve();
            });
        });
    }

    var sendTo = function(clientID, type, data) {
        socket.helper.broadcastToRoom(`###${socket.clientID}`, type, data);
    }

    var broadcast = function(type, data) {
        var socket = this;
        var args = Array.prototype.slice.call(arguments, 0);
        if (socket.server) {
            socket.server.emit.apply(socket.server, args);
        }
    }

    var broadcastWithoutSender = function(type, data) {
        var socket = this;
        var args = Array.prototype.slice.call(arguments, 0);
        if (socket.broadcast) {
            socket.broadcast.emit.apply(socket.broadcast, args);
        }
    }

    var broadcastToRoom = function(room, type, data) {
        var socket = this;
        var args = Array.prototype.slice.call(arguments, 0);
        room = args[0];
        args.shift();
        if (socket.server) {
            var caller = socket.server.in(room);
            caller && caller.emit.apply(caller, args);
        }
    }

    var broadcastToRoomWithoutSender = function(room, type, data) {
        var socket = this;
        var args = Array.prototype.slice.call(arguments, 0);
        room = args[0];
        args.shift();
        if (socket.broadcast) {
            var caller = socket.broadcast.to(room);
            caller && caller.emit.apply(caller, args);
        }
    }

    this.start = function(io) {
        if (this.config.cluster && this.config.cluster.enable) {
            var opt = cloneObject(this.config.cluster.redis);
            opt.key = opt.key || "realtime";
            this.cluster = require('socket.io-redis')(opt);
            io.adapter(this.cluster);
            this.cluster = io.of('/').adapter;
        }
    }

    this.connect = function(socket, callBack) {
        socket.clientID = socket.id;
        socket.helper = {};
        socket.helper.sendTo = sendTo.bind(socket);
        socket.helper.enterRoom = enterRoom.bind(socket);
        socket.helper.leaveRoom = leaveRoom.bind(socket);
        socket.helper.broadcast = broadcast.bind(socket);
        socket.helper.broadcastWithoutSender = broadcastWithoutSender.bind(socket);
        socket.helper.broadcastToRoom = broadcastToRoom.bind(socket);
        socket.helper.broadcastToRoomWithoutSender = broadcastToRoomWithoutSender.bind(socket);

        socket.on("m", function (data) {
            server.traceLog(`get message from client *${socket.id}* : ${JSON.stringify(data)}`);
            server.emit(data[0], socket, data[1]);
        });

        return new Promise(function(resolve) {

            if (server.config.shakehand != false) {
                traceLog(`waiting client *${socket.clientID}* ${server.config.shakehandTimeout / 1000} seconds to shakehand...`);
                instance.shakehandTimeout = setTimeout(function() {
                    instance.shakehandFail(socket);
                }, server.config.shakehandTimeout || 15000);
            } else {
                //no need shakehand
                instance.shakehandSuccess(socket);
            }

            process.nextTick(function() {
                if (callBack) return callBack(socket);
                resolve();
            });
        });
    }

    this.disconnect = function(socket, callBack) {
        return new Promise(function (resolve) {
            process.nextTick(function () {
                socket.clientID = null;
                try {
                    socket.info.session = null;
                    socket.info.shakeHandTime = null;
                } catch (exp) {}
                if (callBack) return callBack(socket);
                resolve();
            });
        });
    }

    this.shakehand = function(socket, data, callBack) {
        return new Promise(function(resolve) {
            var sess = data ? data._sess : null;
            if (!sess || !sess.userid || !sess.token || !sess.tokentimestamp) {
                return process.nextTick(function() {
                    var flag = instance.config.allowGuest ? true : false;
                    if (callBack) return callBack(flag);
                    resolve(flag);
                });
            }

            instance.Session.check(sess.userid, sess.token, function(err, sess) {
                if (!err && sess) {
                    socket.info.session = sess;
                    socket.info.shakeHandTime = Date.now();

                    if (callBack) return callBack(true);
                    resolve(true);
                } else {
                    var flag = instance.config.allowGuest ? true : false;
                    if (callBack) return callBack(flag);
                    resolve(flag);
                }
            });
        });
    }

    this.shakehandComplete = function(socket, flag, callBack) {
        return new Promise(function (resolve) {
            if (!flag) {
                if (callBack) return callBack(false);
                return resolve(false);
            }
            socket.helper.enterRoom(`###${socket.clientID}`, function(err) {
                err && traceError(`enterRoom error after shakehand ---> ${err}`);
                if (callBack) return callBack(!err && flag);
                return resolve(err && flag);
            });
        });
        /*
        if (this.config.multiConnection) {
            socket.enterRoom(`###${socket.clientID}`, function(err) {
                traceError(`enterRoom error after shakehand ---> ${err}`);
                callBack && callBack(!err);
            });
        } else {
            callBack && callBack(true);
        }
        */
    }

    this.shakehandFail = function(socket) {
        traceLog(`client *${socket.clientID}* shakehand failed`);
        clearTimeout(instance.shakehandTimeout);
        try { socket.close(); } catch (exp) { }
        try { socket.disconnect(); } catch (exp) { }
    }

    this.shakehandSuccess = function(socket) {
        socket.clientID = (socket.info.session ? socket.info.session.userid : null) || socket.clientID;
        socket.emit("$init", { clientID:socket.clientID });
        traceLog(`client *${socket.clientID}* shakehand success. clientID: ${socket.clientID}`);
        clearTimeout(instance.shakehandTimeout);
    }
}

exports.DefaultAdapter = DefaultAdapter;