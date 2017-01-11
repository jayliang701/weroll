/**
 * Created by jay on 5/17/16.
 */

var Session = require("../model/Session");
var Redis = require("../model/Redis");
var CODES = require("../ErrorCodes");

var DEBUG = global.VARS.debug;

var DEBUG_HANDLERS = {};

var server;

var router = {
    sendToClient: function(toClient, packet, fromClient) {
        exports.notify(toClient, packet.type, packet.params, packet.cmd, fromClient);
    },
    broadcastToRoom: function(roomID, packet, fromClient) {
        exports.notifyToRoom(roomID, packet.type, packet.params, packet.cmd, fromClient);
    }
};

var shakeHandHandlers = [];

var handlers = {};

var prefix = "";

var CONFIG = { port:80 };

var status = {};

function formatRedisKey(userID) {
    return Redis.join(`realtime_connections_${prefix}_${userID}`);
}

function traceLog() {
    var args = [
        `[Realtime] <${CONFIG.port}>`
    ];
    args = args.concat(Array.prototype.slice.call(arguments, 0));
    console.log.apply(console, args);
}

function traceError() {
    var args = [
        '[Realtime]' + (prefix ? ` <${prefix}>` : '')
    ];
    args = args.concat(Array.prototype.slice.call(arguments, 0));
    console.error.apply(console, args);
}

function updateStatus() {
    status = {};
    status.clientNum = 0;
    status.roomNum = 0;
    if (server) {
        status.clientNum = server.initedCount;
        status.roomNum = _.size(server.rooms);
    }

    try {
        var cpu = process.cpuUsage();
        //console.log(`cpu usage --> user: ${cpu.user}    system: ${cpu.system}`);
        status.cpu_user = cpu.user;
        status.cpu_system = cpu.system;
    } catch (exp) { }
    try {
        var mem = process.memoryUsage();
        //console.log(`Memory usage --> ${mem}`);
        for (var key in mem) {
            status["mem_" + key] = mem[key];
        }
    } catch (exp) { }
    var roomNum = 0;
    if (status.hasOwnProperty("roomNum") && status.roomNum >= 0) {
        roomNum = status.roomNum;
    }

    var expireTime = 5;   //sec

    var tasks = [];
    var redisKey = Redis.join(`socket_server_status_${prefix}`);
    tasks.push([ "HMSET", redisKey, status ]);
    tasks.push([ "EXPIRE", redisKey, expireTime ]);

    redisKey = Redis.join("socket_server_rooms");
    tasks.push([ "ZADD", redisKey, roomNum, prefix ]);
    tasks.push([ "EXPIRE", redisKey, expireTime ]);
    Redis.multi(tasks);
}

exports.getStatus = function() {
    return status;
}

exports.init = function(config, httpServer, customRouter) {
    config = config || CONFIG;
    CONFIG = config;

    /* setup server */
    prefix = config.prefix || "";
    router = customRouter || router;
    exports.router = router;

    var q = [];
    q.push(function(cb) {
        Redis.del(`socket_server_status_${prefix}`, function() {
            Redis.do("ZREM", [ Redis.join("socket_server_rooms"), prefix ], function() {
                cb();
            });
        });
    });
    q.push(function(cb) {
        Redis.findKeysAndDel(Redis.join(`realtime_connections_${prefix}_*`), function(err, num) {
            if (!err) traceLog(`clean ${num} connection info...`);

            var port = config.port;
            if (String(port).hasValue()) {
                var SocketIO = require('socket.io');
                if (port == "*" && httpServer) {
                    server = SocketIO(httpServer);
                    port = httpServer.address().port;
                } else if (!isNaN(Number(port))) {
                    server = SocketIO();
                    server.listen(port);
                }
                CONFIG.port = port;

                traceLog("service is working on port: " + port);
            }
            if (server) {
                server.rooms = {};
                server.initedCount = 0;
                server.on('connection', server_onClientConnected);
            }

            cb();
        });
    });
    q.push(function(cb) {
        if (!CONFIG.disableStatusMonit) {
            setInterval(function() {
                updateStatus();
            }, 2000);
        }
        cb();
    });
    runAsQueue(q);
}
/* handler --> function(data, output, conn) { ... } */
exports.registerHandler = function(event, handler) {
    handlers[event] = handler;
}

exports.registerShakeHandHandler = function(handler) {
    shakeHandHandlers.push(handler);
}

exports.broadcast = function(users, event, data, cmd) {
    users = users || [];
    users.forEach(function(uid) {
        exports.notify(uid, event, data, cmd);
    });
}

exports.notify = function(to, event, data, cmd, from) {
    data = cloneObject(data);
    exports.getUserConnections(to, null, function(socket) {
        //traceLog("pull client sync data --> ", { type:event, params:data });
        socket.emit("sync", { type:event, params:data, cmd:cmd, from:from });
    });
}

exports.notifyToRoom = function(room, event, data, cmd, from) {
    data = cloneObject(data);
    if (server) {
        var packet = { type:event, params:data, cmd:cmd, from:from, room:room };
        server.to(room).emit("sync", packet);
    }
}

exports.notifyToAll = function(event, data, cmd, from) {
    data = cloneObject(data);
    if (server) {
        var packet = { type:event, params:data, cmd:cmd, from:from };
        server.sockets.emit('sync', packet);
    }
}

exports.getUserConnections = function(userID, callBack, renderFunc) {
    //traceLog("try to notify client --> " + userID);
    var key = formatRedisKey(userID);
    Redis.do("ZREVRANGE", [ key, 0, 0 ], function(socketIDs, err) {
        //traceLog("find connections --> ", socketIDs);
        if (socketIDs && socketIDs.length > 0) {
            var sockets = [];
            socketIDs.forEach(function(socketID) {
                var socket = server.sockets.connected[socketID];
                if (socket) {
                    renderFunc && renderFunc(socket);
                    sockets.push(socket);
                }
            })
            callBack && callBack(sockets);
            return;
        }

        if (err) traceError("Redis.zrange error when get user connections --> " + err.toString());
    });
}

exports.kick = function(userID) {
    //traceLog("try to notify client --> " + userid);
    var key = formatRedisKey(userID);
    Redis.do("ZRANGE", [ key, 0, -1 ], function(socketIDs, err) {
        if (socketIDs && socketIDs.length > 0) {
            socketIDs.forEach(function(socketID) {
                var socket = server.sockets.connected[socketID];
                if (socket) {
                    //traceLog("let client offline.");
                    socket.emit("$kick", {  });

                    setTimeout(function() {
                        //close connection after few seconds
                        try { socket.close(); } catch (exp) { }
                        try { socket.disconnect(); } catch (exp) { }
                    }, 2000);
                }
            });
            return;
        }

        if (err) traceError("Redis.zrange error when notify message --> " + err.toString());
    });
}

function server_onClientConnected(socket) {

    var conn = socket.request.connection;

    socket.info = {
        id: socket.id,
        ip: conn.remoteAddress,
        port: conn.remotePort,
        connectTime: Date.now()
    };

    socket.$rooms = socket.rooms || {};

    socket.initTimer = setTimeout(function() {
        try { socket.close(); } catch (exp) { }
        try { socket.disconnect(); } catch (exp) { }
    }, 15 * 1000);

    socket.enterRoom = function(roomID, callBack) {
        var socket = this;

        var clientID = socket.clientID;
        if (!clientID) {
            callBack && callBack(new Error("not allow to enter room before init connection"));
            return;
        }

        traceLog(`client *${clientID}* enter room: ${roomID}`);

        if (!socket.rooms.hasOwnProperty(roomID)) {
            if (!server.rooms[roomID]) {
                server.rooms[roomID] = 0;
            }
            server.rooms[roomID] ++;
        }

        socket.join(roomID, function() {
            socket.$rooms = socket.rooms;
            var tasks = [];
            tasks.push([ "SADD", Redis.join(`user_room_${clientID}_${roomID}`), CONFIG.routeAddress, function(err) {
                if (err) traceError("Redis.sadd[1] error when enter room --> " + err.toString());
            } ]);
            tasks.push([ "SADD", Redis.join(`room_node_${roomID}`), CONFIG.routeAddress, function(err) {
                if (err) traceError("Redis.sadd[2] error when enter room --> " + err.toString());
            } ]);
            Redis.multi(tasks, function(flag, err) {
                var res;
                if (callBack) {
                    res = callBack(err);
                }
                if (!res) {
                    socket.emit("$enterRoom", { room:roomID, time:Date.now() });
                }
            });
        });
    }

    socket.leaveRoom = function(roomID, callBack) {
        var socket = this;

        var clientID = socket.clientID;
        if (!clientID) {
            callBack && callBack(new Error("not allow to enter room before init connection"));
            return;
        }

        if (!socket.$rooms.hasOwnProperty(roomID) || !server.rooms.hasOwnProperty(roomID)) {
            callBack && callBack();
            return;
        }

        traceLog(`client *${clientID}* leave room: ${roomID}`);

        if (server.rooms.hasOwnProperty(roomID) && server.rooms[roomID] > 0) server.rooms[roomID] --;
        if (server.rooms[roomID] == 0) delete server.rooms[roomID];

        socket.leave(roomID, function() {
            socket.$rooms = socket.rooms;
            var tasks = [];
            tasks.push([ "SREM", Redis.join(`user_room_${clientID}_${roomID}`), CONFIG.routeAddress, function(err) {
                if (err) traceError("Redis.srem[1] error when leave room --> " + err.toString());
            } ]);

            var clients = server.sockets.adapter.rooms[roomID];
            if (!clients || clients.length <= 0) {
                tasks.push([ "SREM", Redis.join(`room_node_${roomID}`), CONFIG.routeAddress, function(err) {
                    if (err) traceError("Redis.srem[2] error when leave room --> " + err.toString());
                } ]);
            }

            Redis.multi(tasks, function(flag, err) {
                var res;
                if (callBack) {
                    res = callBack(err);
                }
                if (!res) {
                    socket.emit("$leaveRoom", { room:roomID, time:Date.now() });
                }
            });
        });
    }

    socket.err = function(code, msg) {
        if (typeof arguments[0] == "object") {
            code = arguments[0].code || CODES.SERVER_ERROR;
            msg = arguments[0].msg || arguments[0].message;
        }
        this.emit("$err", { code:code, msg:msg });
    };

    socket.ack = function(rqid, result) {
        if (result && result.constructor == Error) {
            var code = result.code || CODES.SERVER_ERROR;
            var msg = result.msg || result.message;
            this.emit("ack", [ rqid, code, msg ]);
            return false;
        } else {
            var args = [ rqid, CODES.OK ];
            if (result) args.push(result);
            this.emit("ack", args);
            return true;
        }
    };

    socket.sync = function(type, data) {
        socket.emit("sync", { type:type, params:data });
    }

    socket.execCommand = function(data) {
        var rqid = data[0];
        var type = data[1];

        traceLog(`client *${socket.clientID}* send command ---> [${type}${rqid ? ("::" + rqid) : ""}] `, data.params);

        //if (DEBUG) traceLog("*client@" + sess.userid + "* from " + socket.info.ip + ":" + socket.info.port + " request sync --> " + data.type);

        var handler = handlers[type];
        if (handler) {
            handler(data[2], socket, function(result) {
                if (!socket.ack(rqid, result)) {
                    traceError("handle command *" + type + "* error --> " + result.toString());
                }
            });
        } else {
            if (DEBUG) {
                var func = DEBUG_HANDLERS[type];
                func && func(data.params, socket);
            }
        }
    }

    socket.shakeHand = function() {

        var lastShakeHandTime = socket.info.shakeHandTime;
        var now = Date.now();
        socket.info.shakeHandTime = now;

        var key = formatRedisKey(socket.clientID);

        var tasks = [];
        if (lastShakeHandTime) {
            tasks.push([ "ZREMRANGEBYSCORE", key, lastShakeHandTime, lastShakeHandTime, function(err) {
                if (err) traceError("Redis.zremrangebyscore error when socket shake hand --> " + err.toString());
            } ]);
        }
        tasks.push([ "ZADD", key, now, socket.id, function(err) {
            if (err) traceError("Redis.zadd error when socket shake hand --> " + err.toString());
        } ]);
        if (CONFIG.useRoute) {
            tasks.push([ "SADD", Redis.join(`conn_${socket.clientID}`), CONFIG.routeAddress, function(err) {
                if (err) traceError("Redis.sadd error when init socket connection --> " + err.toString());
            } ]);
        }
        updateStatus();
        Redis.multi(tasks, function(flag) {
            if (flag) {
                server.initedCount ++;
                socket.emit("$init", { msg:"hello", time:Date.now(), socketID:socket.id, clientID:socket.clientID });
                if (DEBUG) {
                    traceLog("*client@" + socket.clientID + "@" + socket.id + "* from " + socket.info.ip + ":" + socket.info.port + " is shakeHanded.");

                    var num1 = server.engine.clientsCount;
                    var num2 = server.initedCount;
                    traceLog(`sever info ---> connected: ${num1}     shakehand: ${num2}`);
                }

                shakeHandHandlers.forEach(function(handler) {
                    handler && handler(socket);
                });
            }
        });
    }

    socket.on("$init", function (data) {

        clearTimeout(socket.initTimer);
        socket.initTimer = undefined;

        var sess = data ? data._sess : null;
        if (!CONFIG.allowGuest && (!sess || !sess.userid || !sess.token || !sess.tokentimestamp)) {
            try { socket.close(); } catch (exp) { }
            try { socket.disconnect(); } catch (exp) { }
            return;
        }

        socket.clientID = sess && sess.userid ? sess.userid : null;
        if (!socket.clientID) {
            socket.clientID = data.clientID || socket.id;
        }
        if (sess) {
            Session.getSharedInstance().check(sess.userid, sess.token, function(flag, sess, err) {
                if (!err && flag == 1) {
                    socket.info.userid = sess.userid;
                    socket.info.token = sess.token;
                    socket.info.tokentimestamp = sess.tokentimestamp;

                    socket.shakeHand();

                } else {
                    if (CONFIG.allowGuest) {
                        socket.shakeHand();
                    } else {
                        //no auth to sync, close this client connection
                        try { socket.close(); } catch (exp) { }
                        try { socket.disconnect(); } catch (exp) { }
                    }
                }
            });
        } else {
            if (CONFIG.allowGuest) {
                socket.shakeHand();
            } else {
                //no auth to sync, close this client connection
                try { socket.close(); } catch (exp) { }
                try { socket.disconnect(); } catch (exp) { }
            }
        }
    });

    socket.on("cmd", function (data) {
        if (socket.clientID) {
            var rqid = data[0];
            var type = data[1];

            traceLog(`client *${socket.clientID}* send command ---> [${type}${rqid ? ("::" + rqid) : ""}] `, data.params);

            //if (DEBUG) traceLog("*client@" + sess.userid + "* from " + socket.info.ip + ":" + socket.info.port + " request sync --> " + data.type);

            var handler = handlers[type];
            if (handler) {
                handler(data[2], socket, function(result) {
                    if (!socket.ack(rqid, result)) {
                        traceError("handle command *" + type + "* error --> " + result.toString());
                    }
                });
            } else {
                if (DEBUG) {
                    var func = DEBUG_HANDLERS[type];
                    func && func(data.params, socket);
                }
            }
        } else {
            //no auth to sync, close this client connection
            try { socket.close(); } catch (exp) { }
            try { socket.disconnect(); } catch (exp) { }
        }
    });

    socket.once("disconnect", function () {
        try {
            for (var roomID in socket.$rooms) {
                socket.leaveRoom(roomID);
            }
            socket.$rooms = {};
        } catch (exp) {
            console.error(exp);
        }

        if (socket.clientID) {
            server.initedCount --;
            server.initedCount = Math.max(server.initedCount, 0);

            var tasks = [];
            tasks.push([ "ZREM", formatRedisKey(socket.clientID), socket.id ]);
            if (CONFIG.useRoute) {
                tasks.push([ "SREM", Redis.join(`conn_${socket.clientID}`), CONFIG.routeAddress ]);
            }
            Redis.multi(tasks, function(flag, err) {
                if (err) traceError("clean user data after disconnect error --> " + err.toString());
            });

            traceLog("client *" + socket.clientID + "* disconnected...");
            delete this.info["userid"];
            delete this.info["token"];
            delete this.info["tokentimestamp"];
        } else {
            traceLog("socket *" + socket.id + "* disconnected...");
        }
    });
}

DEBUG_HANDLERS["@enterRoom"] = function(data, socket) {
    socket.enterRoom(data.room);
}

DEBUG_HANDLERS["@leaveRoom"] = function(data, socket) {
    socket.leaveRoom(data.room);
}

DEBUG_HANDLERS["@one"] = function(data, socket) {
    router.sendToClient(data.to, data.packet, socket.clientID);
}

DEBUG_HANDLERS["@room"] = function(data, socket) {
    router.broadcastToRoom(data.room, data.packet, socket.clientID);
}