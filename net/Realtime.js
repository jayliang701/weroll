/**
 * Created by Jay on 2017/1/22.
 */
var Websocket = require("./Websocket");
var Session = require("../model/Session");

exports.createServer = function(config, asDefault) {
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

    this.connect = function(socket, callBack) {
        socket.clientID = socket.id;
        callBack && process.nextTick(function() {
            callBack(socket);

            if (server.config.shakehand != false) {
                traceLog(`waiting client *${socket.clientID}* shakehand...`);
                instance.shakehandTimeout = setTimeout(function() {
                    instance.shakehandFail(socket);
                }, server.config.shakehandTimeout || 15000);
            } else {
                //no need shakehand
                instance.shakehandSuccess(socket);
            }
        });
    }

    this.disconnect = function(socket, callBack) {
        socket.clientID = null;
        try {
            socket.info.session = null;
            socket.info.shakeHandTime = null;
        } catch (exp) {}
        callBack && process.nextTick(function() {
            callBack(socket);
        });
    }

    this.shakehand = function(socket, data, callBack) {
        var sess = data ? data._sess : null;
        if (!sess || !sess.userid || !sess.token || !sess.tokentimestamp) {
            return callBack && process.nextTick(function() {
                callBack(server.config.allowGuest ? true : false);
            });
        }

        Session.check(sess.userid, sess.token, function(err, sess) {
            if (!err && sess) {
                socket.info.session = sess;
                socket.info.shakeHandTime = Date.now();

                callBack && callBack(true);
            } else {
                callBack && callBack(server.config.allowGuest ? true : false);
            }
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