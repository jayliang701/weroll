/**
 * Created by Jay on 14-5-21.
 */

var TemplateLib = require("./TemplateLib.js");
var Utils = require("./Utils.js");
var EMAIL = require("emailjs/email");
var FS = require("fs");
var PATH = require("path");

var server;

var config;

var DEBUG = global.VARS.debug;

exports.init = function(setting) {
	config = setting;
	server = EMAIL.server.connect(config.stamp);
}

exports.send = function(to, templateKey, params, callBack) {
	var tpl = TemplateLib.useTemplate("mail", templateKey, params);
	__send(tpl.title, tpl.content, tpl.content, to, callBack);
}

function __send(title, msg, htmlMsg, to, callBack) {

    var mail = {
        from: config.senderName + " <" + config.sender + ">",
        to: to,
        subject: title,
        text: msg,
        attachment: []
    };
    if (htmlMsg && htmlMsg != "") {
        mail.attachment.push({ data: htmlMsg, alternative:true });
    }

    if (DEBUG) console.log("send mail to <" + to + ">");

    server.send(mail, function(err, message) {
        if (err) {
            console.error("send email error ==> " + err);
        }
        if (callBack) {
            callBack(err, message);
        }
    });
}
