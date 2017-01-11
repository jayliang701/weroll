
var FS = require("fs");
var PATH = require("path");
var Utils = require("./Utils.js");

var TEMPLATE_CACHE = {};

var PARAMS = {
    "NOW_YHM": function() {
        return Utils.convertTimeToDate(Date.now(), false);
    },
    "NOW_YHM_CN": function() {
        return Utils.convertTimeToDate(Date.now(), false, "cn");
    }
};

var TITLE_CONTENT_SEP = "**********%*********";

exports.init = function(params) {
    if (params) {
        for (var key in params) {
            PARAMS[key] = params[key];
        }
    }
}

function fillParams(str, params) {
    if (!String(str).hasValue()) return str;
    var args = str.match(/%[a-zA-Z_-]+%/mg);
    args = args ? args : [];
    args.forEach(function(m) {
        var key = m.substring(1, m.length - 1);
        if (PARAMS.hasOwnProperty(key)) {
            var val = typeof PARAMS[key] == "function" ? PARAMS[key]() : PARAMS[key];
            str = str.replace(new RegExp(m, "mg"), val);
        }
        if (params && params.hasOwnProperty(key)) {
            try {
                var val = typeof PARAMS[key] == "function" ? params[key]() : params[key];
                str = str.replace(new RegExp(m, "mg"), val);
            } catch (exp) {
                console.error("TemplateLib.fillParams ==> " + exp.toString());
            }
        }
    });
    return str;
}

function useTemplate(group, key, args) {
    TEMPLATE_CACHE[group] = TEMPLATE_CACHE[group] ? TEMPLATE_CACHE[group] : {};
    var groupMap = TEMPLATE_CACHE[group];
    groupMap[key] = groupMap[key] ? groupMap[key] : null;

    if (!groupMap[key]) {
        var all = FS.readFileSync(PATH.join(global.APP_ROOT, "server/res/template/" + group + "/" + key + ".tpl"));
        all = all.toString("utf8");
        var parts = all.split(TITLE_CONTENT_SEP);
        var title = parts.length > 1 ? parts[0].trim() : "";
        var content = parts.length > 1 ? parts[1].trim() : all.trim();
        groupMap[key] = { group:group, key:key, title:title, content:content };
    }

    var template = groupMap[key];
    var title = fillParams(template.title, args);
    var content = fillParams(template.content, args);

    return { title:title, content:content };
}

exports.useTemplate = useTemplate;