/**
 * Created by Jay on 7/29/15.
 */

var Engine;
var Utils = require("./Utils");

var CDN_URL = "";

var FILTER_MAP = {};

exports.init = function(options) {
    Engine = options.engine || require("nunjucks");
    CDN_URL = options.cdnUrl;
    if (CDN_URL.charCodeAt(CDN_URL.length - 1) == "/") CDN_URL = CDN_URL.substr(0, CDN_URL.length - 1);

    exports.addFilter('json', json);
    exports.addFilter('fetch', fetch);
    exports.addFilter('string', string);
    exports.addFilter('gender', gender);
    exports.addFilter('cdn', cdn);
    exports.addFilter('number_toFixed', number_toFixed);
    exports.addFilter('moment_locale', moment_locale);
    exports.addFilter('moment_format', moment_format);
    exports.addFilter('moment', moment);
    exports.addFilter("props", props);
    exports.addFilter("type", type);
    exports.addFilter("wrap", wrap);
}

exports.addFilter = function(key, handler) {
    if (FILTER_MAP[key]) return;
    var func = Engine.$setFilter || Engine.setFilter || Engine.addFilter;
    func && func.apply(Engine, [ key, handler ]);
    FILTER_MAP[key] = handler;
}

function json(val, defaultValue) {
    if (!String(val).hasValue()) {
        if (defaultValue) {
            val = defaultValue;
        } else {
            return "null";
        }
    }
    return this.env.getFilter("safe")(JSON.stringify(val));
}

function fetch(arr, prop, defaultVal) {
    prop = String(prop).hasValue() ? String(prop) : "";
    defaultVal = defaultVal != undefined ? defaultVal : "";
    var val = arr;
    if (val === undefined || val === null) return defaultVal;
    else if (val === 0 || val === false) return val;
    prop = prop.split(".");
    try {
        for (var i = 0; i < prop.length; i++) {
            val = val[prop[i]];
            if (val === undefined || val === null) {
                return defaultVal;
            }
            else if (val === 0 || val === false) {
                return val;
            }
        }
    } catch (exp) {
        return defaultVal;
    }
    if (String(defaultVal).hasValue() && !String(val).hasValue()) return defaultVal;
    return val;
}

function string(str, method) {
    var args = [];
    try {
        var i = 2
        while (i >= 0) {
            var val = arguments[i];
            if (val == undefined) i = -1;
            else {
                args.push(val);
                i ++;
            }
        }
        return str[method].apply(str, args);
    } catch (exp) {
        return "";
    }
}

function gender(val) {
    return parseInt(val) == 2 ? '女' : '男';
}

function cdn(url, placeholder) {
    if (String(url).hasValue()) {
        return CDN_URL + "/" + url;
    } else {
        return placeholder;
    }
}

function number_toFixed(val, fixed) {
    return Number(val).toFixed(fixed);
}

function moment_locale(val, lang) {
    var m = global.moment(val);
    m.locale(lang);
    var params = Array.prototype.slice.call(arguments, 0);
    params.splice(1, 1);
    params[0] = m;
    return moment.apply(m, params);
}

function moment_format(val, lang, format) {
    var params = Array.prototype.slice.call(arguments, 0);
    if (typeof lang == "string" && typeof format == "string") {
        return moment_locale(val, lang, 'format', format);
    }
    params.splice(1, 0, 'format');
    return moment.apply(this, params);
}

function moment(val, func) {
    var args = Array.prototype.slice.call(arguments, 0);

    var m = typeof val == "object" ? val : global.moment(val);
    func = func || 'format';
    if (m[func]) {
        args.splice(0, 2);
        return m[func].apply(m, args);
    }
    return val;
}

function props(obj, fields, spe) {
    if (!obj) return "";
    var temp = [];
    fields = fields.split(",");
    for (var i = 0; i < fields.length; i++) {
        var prop = fields[i];
        var val = obj[prop];
        if (String(val).hasValue()) {
            temp.push(String(val));
        }
    }
    return temp.join(spe);
}

function type(val) {
    return typeof val;
}

function wrap(val) {
    if (!val) return val;
    return val.replace(/[\r\n]/img, "<br>");
}




