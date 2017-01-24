/**
 * Created by Jay on 2017/1/22.
 */
var Websocket = require("./Websocket");
var Session = require("../model/Session");

exports.createServer = function(config, asDefault) {
    var server = new Websocket(config);
    server.__subs = [];
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

                adapter.shakehand(socket, data, function(flag) {
                    if (flag) {
                        adapter.shakehandFail(socket);
                    } else {
                        adapter.shakehandSuccess(socket);
                    }
                });
            });
        });
    });

    server.on("disconnect", function(socket) {
        adapter.disconnect(socket);
    });

    asDefault && global.__defineGetter__('Realtime', function() {
        return server;
    });

    return server;
}

function DefaultAdapter(server) {
    var instance = this;
    this.server = server;
    this.Session = server.config.session || Session.getSharedInstance();
    var traceLog = server.traceLog;
    var traceError = server.traceError;
    var traceInfo = server.traceInfo;

    var enterRoom = function(room, callBack) {
        var socket = this;
        return new Promise(function(resolve, reject) {
            socket.join(room, function (err) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(err);
                }
                resolve();
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
        var socket = this;
        var args = Array.prototype.slice.call(arguments, 0);
        args.shift();
        if (socket.broadcast) {
            var caller = socket.broadcast.to(socketID);
            caller.emit.apply(caller, args);
        }
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

    this.connect = function(socket, callBack) {
        socket.clientID = socket.id;
        socket.enterRoom = enterRoom.bind(socket);
        socket.leaveRoom = leaveRoom.bind(socket);
        socket.broadcast = broadcast.bind(socket);
        socket.broadcastWithoutSender = broadcastWithoutSender.bind(socket);
        socket.broadcastToRoom = broadcastToRoom.bind(socket);
        socket.broadcastToRoomWithoutSender = broadcastToRoomWithoutSender.bind(socket);

        socket.on("m", function (data) {
            server.traceLog(`get message from client *${socket.id}* : ${JSON.stringify(data)}`);
            server.emit(data[0], socket, data[1]);
        });

        return new Promise(function(resolve) {

            if (server.config.shakehand != false) {
                traceLog(`waiting client *${socket.clientID}* shakehand...`);
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
        socket.clientID = null;
        try {
            socket.info.session = null;
            socket.info.shakeHandTime = null;
        } catch (exp) {}
        return new Promise(function(resolve) {
            process.nextTick(function() {
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
                    var flag = server.config.allowGuest ? true : false;
                    if (callBack) return callBack(flag);
                    resolve(flag);

                });
            }

            Session.check(sess.userid, sess.token, function(err, sess) {
                if (!err && sess) {
                    socket.info.session = sess;
                    socket.info.shakeHandTime = Date.now();

                    if (callBack) return callBack(true);
                    resolve(true);
                } else {
                    var flag = server.config.allowGuest ? true : false;
                    if (callBack) return callBack(flag);
                    resolve(flag);
                }
            });
        });
    }

    this.shakehandFail = function(socket) {
        traceLog(`client *${socket.clientID}* shakehand failed`);
        clearTimeout(instance.shakehandTimeout);
        try { socket.close(); } catch (exp) { }
        try { socket.disconnect(); } catch (exp) { }
    }

    this.shakehandSuccess = function(socket) {
        socket.clientID = (socket.info.session ? socket.info.session.userid : null) || socket.clientID;
        traceLog(`client *${socket.clientID}* shakehand success. clientID: ${socket.clientID}`);
        clearTimeout(instance.shakehandTimeout);
    }
}

exports.DefaultAdapter = DefaultAdapter;