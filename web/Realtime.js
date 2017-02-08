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
    server.__producers = {};
    server.registerProducer = function(name, func) {
        this.__producers[name] = func.bind(this);
    };

    var AdpaterClass = config.adpater || DefaultAdapter;
    var adapter = new AdpaterClass(server);

    server.on("connection", function(socket) {

        var config = server.config;

        //connect
        adapter.connect(socket, function() {
            //shakehand
            config.shakehand != false && socket.on("$init", function(data) {
                clearTimeout(socket.initTimer);
                socket.initTimer = undefined;

                server.traceLog(`client *${socket.id}* start shakehand...`);

                server.emit("shakeHandStart", socket);
                adapter.shakehand(socket, data, function(flag) {
                    adapter.shakehandComplete(socket, flag, function (flag) {
                        if (flag) {
                            adapter.shakehandSuccess(socket);
                            server.emit("shakeHandSuccess", socket);
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
    /*
    server.getClientsInRoom = function(room, callBack, mapFunc) {
        return new Promise(function (resolve, reject) {

        });
    };
     */
    server.getClientConnectionBySocketID = function (socketID) {
        return this.sockets.connected[socketID];
    };

    server.getClientIDBySocketID = function (socketID) {
        var socket = this.getClientConnectionBySocketID(socketID);
        return socket ? socket.clientID : null;
    };

    server.sendTo = function(clientID, type, data) {
        adapter.sendTo(clientID, type, data);
    };

    server.broadcastToRoom = function(room, type, data) {
        adapter.broadcastToRoom(room, type, data);
    };

    server.broadcastToAll = function(type, data) {
        adapter.broadcastToAll(type, data);
    };

    server.kick = function(clientID, data) {
        adapter.kick(clientID, data);
    };

    //default register producer
    server.registerProducer("getClientIDBySocketID", server.getClientIDBySocketID);

    server.invoke = function(method, args, callBack) {
        var func = server.__producers[method];
        if (func) {
            var res = func.apply(server, args);
            if (res instanceof Promise) {
                res.then(function(result) {
                    callBack && callBack(result);
                }).catch(function(err) {
                    server.traceError('be invoked error: ', err.message || err.toString());
                    callBack && callBack();
                });
            } else {
                callBack && callBack(res);
            }
        } else {
            server.traceError('be invoked error: ', 'no such method ---> ', method);
            callBack && callBack();
        }
    }

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

    var kick = function(data) {
        var socket = this;
        socket.emit("$kick", data);
        setTimeout(function() {
            //close connection after few seconds
            try { socket.close(); } catch (exp) { }
            try { socket.disconnect(); } catch (exp) { }
        }, 1000);
    }

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
        var socket = this;
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

    this.invoke = function(method, args, callBack) {
        var ins = this;
        return new Promise(function (resolve, reject) {
            if (ins.cluster) {
                ins.cluster.customRequest([ "invoke", [ method, args ] ], function(err, results) {
                    if (err) {
                        ins.server.traceError('invoke error ---> ', err);
                        if (callBack) return callBack(err);
                        return reject(err);
                    }
                    if (callBack) return callBack(null, results);
                    return resolve(results);
                });
            } else {
                ins.server.invoke(method, args, function(res) {
                    if (callBack) return callBack(null, [ res ]);
                    return resolve([ res ]);
                });
            }
        });
    }

    this.kick = function(clientID, data) {
        this.invoke("kick", [ clientID, data ]);
    }

    this.sendTo = function(clientID, type, data) {
        this.broadcastToRoom(`###${clientID}`, type, data);
    }

    this.broadcastToRoom = function(room, type, data) {
        if (this.server && this.server.io) {
            var caller = this.server.io.in(room);
            caller && caller.emit(type, data);
        }
    }

    this.broadcastToAll = function(type, data) {
        if (this.server && this.server.io) {
            this.server.io.emit(type, data);
        }
    }
    /*
    this.getClientsInRoom = function(room, callBack, mapFunc) {
        mapFunc = arguments.length > 2 ? arguments[2] : null;
        if (typeof mapFunc != "function") mapFunc = null;

        var ins = this;
        return new Promise(function (resolve) {
            if (ins.cluster) {
                ins.server.io.in(room).clients(function (err, socketIDs) {
                    if (err) {
                        if (callBack) return callBack(err);
                        return reject(err);
                    }

                    socketIDs = socketIDs || [];
                    socketIDs.forEach(function() {
                        ins.invoke("getClientIDBySocketID", [ socketIDs ], function(err, results) {
                            results = results || [];

                        });
                    });
                    if (callBack) return callBack(clientIDs);
                    resolve(clientIDs);
                });
            } else {
                var clientIDs = [];
                _.mapObject(ins.server.io.sockets.adapter.rooms[room], function(socket) {
                    clientIDs.push(socket.clientID);
                    mapFunc && mapFunc(socket);
                });
                if (callBack) return callBack(clientIDs);
                resolve(clientIDs);
            }
        });
    }
    */
    /*
    this.getClientConnections = function(clientID, callBack, mapFunc) {
        mapFunc = arguments.length > 2 ? arguments[2] : null;
        if (typeof mapFunc != "function") mapFunc = null;

        var ins = this;
        return new Promise(function (resolve, reject) {
            var room = `###${clientID}`;
            var sockets = [];
            if (ins.cluster) {
                ins.cluster.clients([ room ], function (err, clients) {
                    if (err) {
                        if (callBack) return callBack(err);
                        return reject(err);
                    }
                    var ids = clients ? (clients[room] || []) : [];
                    ids.forEach(function(id) {
                        var socket = server.sockets.connected[id];
                        if (socket) {
                            mapFunc && mapFunc(socket);
                            sockets.push(socket);
                        }
                    });
                    if (callBack) return callBack(null, sockets);
                    return resolve(sockets);
                });
            } else {
                _.mapObject(ins.server.io.sockets.adapter.rooms[room], function(socket) {
                    sockets.push(socket);
                    mapFunc && mapFunc(socket);
                });
                if (callBack) return callBack(null, sockets);
                return resolve(sockets);
            }
        });
    }
    */

    this.start = function(io) {
        if (this.config.cluster && this.config.cluster.enable) {
            var opt = cloneObject(this.config.cluster.redis);
            opt.key = opt.key || "realtime";
            this.cluster = require('socket.io-redis')(opt);
            io.adapter(this.cluster);
            this.cluster = io.of('/').adapter;

            this.cluster.customHook = function (data, callBack) {
                var event = data[0];
                var args = data[1];
                if (event == 'invoke') {
                    server.invoke(args[0], args[1], callBack);
                }
            }
        }

        var server = this.server;
        server.__kick = function(clientID, data) {
            server.traceLog('try to kick: ', clientID);
            var sockets;
            try {
                sockets = server.io.sockets.adapter.rooms[`###${clientID}`].sockets;
                //server.traceLog('clients in room: ', sockets);
            } catch (exp) {
                //server.traceLog('no such room...');
                sockets = {};
            }
            _.mapObject(sockets, function(val, socketID) {
                var socket = server.io.sockets.connected[socketID];
                if (socket) {
                    server.traceLog(`found socket connection *${socketID}* and kick!`);
                    socket.helper.kick(data);
                }
            });
        };
        server.registerProducer("kick", server.__kick);
    }

    this.connect = function(socket, callBack) {
        socket.clientID = socket.id;
        socket.helper = {};
        socket.helper.kick = kick.bind(socket);
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
            if (callBack) return callBack(true);
            resolve(true);
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
        socket.helper.enterRoom(`###${socket.clientID}`, function(err) {
            err && traceError(`enterRoom error after shakehand ---> ${err}`);
            socket.emit("$init", { time:Date.now(), socketID:socket.id, clientID:socket.clientID });
            traceLog(`client *${socket.clientID}* shakehand success. clientID: ${socket.clientID}`);
        });
        clearTimeout(instance.shakehandTimeout);
    }
}

exports.DefaultAdapter = DefaultAdapter;