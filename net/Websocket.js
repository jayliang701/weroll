/**
 * Created by Jay on 2017/1/22.
 */
var EventEmitter = require("events").EventEmitter;
var SocketIO = require('socket.io');
var DEBUG = false;

var traceLog = global.WebsocketTraceLog || function() {
        var args = Array.prototype.slice.call(arguments, 0);
        console.log.apply(console, [ '<Websocket>' ].concat(args));
    };

var traceError = global.WebsocketTraceLog || function() {
        var args = Array.prototype.slice.call(arguments, 0);
        console.error.apply(console, [ '<Websocket>' ].concat(args));
    };

var traceInfo = global.WebsocketTraceInfo || function() {
        var args = Array.prototype.slice.call(arguments, 0);
        console.info.apply(console, [ '<Websocket>' ].concat(args));
    };

//config -> { server, [port], [adapter] }
function Websocket(config) {
    DEBUG = config.debug || (global.VARS ? global.VARS.debug : false);
    if (!DEBUG) {
        traceLog = function() {};
        traceError = function() {};
        traceInfo = function() {};
    }
    this.traceLog = traceLog;
    this.traceError = traceError;
    this.traceInfo = traceInfo;
    this.config = config;
    this.io = null;
}

Websocket.prototype.__proto__ = EventEmitter.prototype;

Websocket.prototype.start = function() {
    var ins = this;
    var config = this.config;
    var io = this.io;
    if (io) throw new Error("can't start a Websocket which is connected");

    var port = config.port || 80;
    var hosted = port;
    if (config.server) {
        port = config.server.address().port;
        hosted = config.server;
    }
    this.port = port;
    this.io = io = SocketIO(hosted);
    io.on('connection', function(socket){
        var conn = socket.request.connection;

        socket.info = {
            id: socket.id,
            ip: conn.remoteAddress.replace('::ffff:', ''),
            port: conn.remotePort,
            connectTime: Date.now()
        };

        traceLog(`client *${socket.id}* connected from ${socket.info.ip}:${socket.info.port}`);

        socket.once('disconnect', function() {
            traceLog(`client *${socket.id}* disconnected...`);
            ins.emit("disconnect", socket);
        });

        ins.emit("connection", socket);
    });
    io.on('error', function(err){
        ins.emit("error", err);
    });

    traceLog(`instance start at port: ${port} ${config.server ? 'with http server' : ''}`);
    ins.emit("start", io);
}

module.exports = Websocket;