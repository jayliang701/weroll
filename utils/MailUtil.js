/**
 * Created by Jay on 14-5-21.
 */

var TemplateLib = require("./TemplateLib.js");
var Utils = require("./Utils.js");
var EMAIL = require("emailjs/email");
var FS = require("fs");
var PATH = require("path");

var proxy;

var config;

var DEBUG = global.VARS.debug;
var SIMULATION = false;

proxy = {};

proxy.init = function(config) {
    //setup smtp server
    proxy.$server = EMAIL.server.connect(config.stamp);
}

proxy.send = function(from, to, title, content, option, callBack) {
    var ins = this;
    return new Promise(function(resolve, reject) {
        var mail = {
            from: from,
            to: to,
            subject: title,
            text: content,
            attachment: []
        };
        mail.attachment.push({ data: content, alternative:true });

        ins.$server.send(mail, function(err, message) {
            if (err) {
                DEBUG && console.error("send email to <" + to + "> error ---> ", err);
                if (callBack) return callBack(err, message);
                return reject(err);
            }

            DEBUG && console.log("send mail to <" + to + "> ok.");

            if (callBack) return callBack();
            return resolve();
        });
    });
}

exports.init = function(setting) {
    config = setting;
    SIMULATION = config.hasOwnProperty("simulate") ? config.simulate : SIMULATION;
    DEBUG = config.hasOwnProperty("debug") ? config.debug : DEBUG;
    proxy.init(config);
}

exports.send = function(to, title, content, option, callBack) {
    option = typeof arguments[3] == "object" ? arguments[3] : {};
    option = option || {};
    callBack = typeof arguments[3] == "function" ? arguments[3] : arguments[4];
    if (typeof callBack != "function") callBack = null;

    var from = config.sender;
    if (config.senderName) from = config.senderName + " <" + from + ">";

    return new Promise(function(resolve, reject) {
        if (SIMULATION) {
            setTimeout(function() {
                console.log("simulate send email >>> ");
                console.log("from: ", from);
                console.log("to: ", to);
                console.log("title: ", title);
                console.log("content: ", content);
                if (callBack) return callBack();
                resolve();
            }, 20);
        } else {
            proxy.send(from, to, title, content, option, function(err) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(err);
                }
                if (callBack) return callBack();
                resolve();
            });
        }
    });
}

exports.sendWithTemplate = function(to, templateKey, params, option, callBack) {
    option = typeof arguments[3] == "object" ? arguments[3] : {};
    option = option || {};
    callBack = typeof arguments[3] == "function" ? arguments[3] : arguments[4];
    if (typeof callBack != "function") callBack = null;

    var tpl = TemplateLib.useTemplate("mail", templateKey, params);
    send(to, tpl.title, tpl.content, option, callBack);
}

exports.setProxy = function(newProxy) {
    proxy = newProxy;
};
