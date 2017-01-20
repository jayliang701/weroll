/**
 * Created by Jay on 7/29/15.
 */

var Engine;
var Utils = require("./Utils");

var WEEK_DAY_CN = [ '周日', '周一', '周二', '周三', '周四', '周五', '周六' ];

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
    exports.addFilter('datetime_isDiffDate', datetime_isDiffDate);
    exports.addFilter('datetime_format', datetime_format);
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

function datetime_isDiffDate(time1, time2) {
    var dt1 = new Date();
    dt1.setTime(time1);

    var dt2 = new Date();
    dt2.setTime(time2);
    return dt1.getDate() != dt2.getDate();
}

function datetime_format(time, format) {
    if (time <= 0) return '';
    return DateTimeFormatter["format_" + format](time);
}

var DateTimeFormatter = {
    format_YMD: function(time) {
        var dt = new Date();
        dt.setTime(time);
        return Utils.convertTimeToDate(dt.getTime(), false, 'en');
    },
    format_YMD_W: function(time) {
        var dt = new Date();
        dt.setTime(time);
        return Utils.convertTimeToDate(dt.getTime(), false, 'en') + ' ' + WEEK_DAY_CN[dt.getDay()];
    },
    format_HM: function(time) {
        return Utils.getTimeHourAndMin(time, true);
    },
    format_YMD_HM: function(time) {
        var dt = Utils.convertTimeToDate(time, true, 'en');
        dt = dt.substr(0, dt.length - 3);
        return dt;
    },
    format_YMD_HMS: function(time) {
        var dt = Utils.convertTimeToDate(time, true, 'en');
        return dt;
    }
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




