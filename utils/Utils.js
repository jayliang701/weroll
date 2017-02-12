var HTTP = require('http');
HTTP.globalAgent.maxSockets = Infinity;
var FS = require('fs');
var URL = require('url');
var Async = require('async');
var ICONV = require('iconv-lite');
var Crypto = require("crypto");
var BufferHelper = require('bufferhelper');
var _ = require("underscore");
var moment = require("moment");
var msgpack = require('msgpack5')();

global.__defineGetter__('jsonZip', function() {
    return msgpack.encode;
});

global.__defineGetter__('jsonUnzip', function() {
    return msgpack.decode;
});

global.__defineGetter__('md5', function() {
    return function(str) {
        var buf = new Buffer(str);
        str = buf.toString("binary");

        var hash = require("crypto").createHash("md5");
        return hash.update(str).digest("hex");
    };
});

global.__defineGetter__('runAsQueue', function() {
    return require('async').waterfall;
});

global.__defineGetter__('runAsParallel', function() {
    return require('async').parallel;
});

global.__defineGetter__('isEmpty', function() {
    return _.isEmpty;
});

global.__defineGetter__('_', function() {
    return _;
});

global.__defineGetter__('moment', function() {
    return moment;
});

global.__defineGetter__('iconv', function() {
    return ICONV;
});

global.__defineGetter__('changeEncoding', function(src, encoding) {
    return ICONV.encode(new Buffer(src), encoding || "utf-8");
});

global.__defineGetter__('cloneObject', function() {
    return function(obj) {
        return JSON.parse(JSON.stringify(obj));
    };
});

global.__defineGetter__('sleep', function() {
    return exports.sleep;
});

Error.create = function(code, msg) {
    msg = msg ? msg.toString() : "unknown";
    var err = new Error('code: ' + code + ', ' + msg);
    err.code = code;
    err.msg = msg;
    err.toString = function() {
        return this.message;
    }
    return err;
}

FS.mkdirp = function() {
    var mkdirp = require("mkdirp");
    mkdirp.apply(null, Array.prototype.slice.call(arguments, 0));
}

require("console-stamp")(console, "yyyy-mm-dd HH:MM:ss");

console.fail = function(code, msg, api) {
    console.error("[" + code + "] " + (api ? "API<" + api + ">" : "") + (msg ? msg.toString() : "unknown"));
}

String.prototype.fillData = function(key, value) {
    return this.replace(new RegExp("\\{" + key + "\\}", "g"), value);
}

String.prototype.hasValue = function() {
    return this != "undefined" && this != "null" && this != "";
}

if (!Array.prototype.shuffle) {
    Array.prototype.shuffle = function() {
        for(var j, x, i = this.length; i; j = parseInt(Math.random() * i), x = this[--i], this[i] = this[j], this[j] = x);
        return this;
    };
}

exports.sleep = function(time) {
    return new Promise(function (resolve) {
        setTimeout(function() {
            resolve();
        }, time);
    });
}

exports.runQueueTask = function(tasks, callBack) {
    return Async.waterfall(tasks, callBack);
}

exports.runParallelTask = function(tasks, callBack) {
    return Async.parallel(tasks, callBack);
}

exports.cloneObject = function(obj) {
    return JSON.parse(JSON.stringify(obj));
}

exports.md5 = function(str) {
    var buf = new Buffer(str);
    str = buf.toString("binary");

    var hash = Crypto.createHash("md5");
    return hash.update(str).digest("hex");
}

exports.rsa = function(privateKey, plain) {
    var buf = new Buffer(plain);
    plain = buf.toString("binary");

    var sign = Crypto.createSign('RSA-SHA1');
    sign.update(plain);

    return sign.sign(privateKey, 'base64');
}

exports.aesEncode = function(plainText, key, iv, encoding) {
    iv = iv ? iv : new Buffer('0000000000000000');
    encoding = encoding ? encoding : 'utf8';
    var decodeKey = Crypto.createHash('sha256').update(key).digest();
    var cipher = Crypto.createCipheriv('aes-256-cbc', decodeKey, iv);
    var text = ICONV.encode(new Buffer(plainText), encoding);

    return cipher.update(text, 'binary', 'hex') + cipher.final('hex');
}

exports.aesDecode = function(encryptText, key, iv, encoding) {
    iv = iv ? iv : new Buffer('0000000000000000');
    encoding = encoding ? encoding : 'utf8';
    var encodeKey = Crypto.createHash('sha256').update(key).digest();
    var cipher = Crypto.createDecipheriv('aes-256-cbc', encodeKey, iv);
    var buffer = new BufferHelper();

    var part1 = cipher.update(encryptText, 'hex');
    buffer.concat(part1);
    var part2 = cipher.final();
    buffer.concat(part2);

    return ICONV.decode(buffer.toBuffer(), encoding);
}

exports.randomString = function(len) {
    var parts = [
        [ 48, 57 ], //0-9
        [ 65, 90 ], //A-Z
        [ 97, 122 ]  //a-z
    ];

    var pwd = "";
    for (var i = 0; i < len; i++)
    {
        var part = parts[Math.floor(Math.random() * parts.length)];
        //trace(part[0], part[1], Math.floor(Math.random() * (part[1] - part[0])));
        var code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
        var c = String.fromCharCode(code);
        pwd += c;
    }
    return pwd;
}

exports.randomNumber = function(len) {
    var parts = [
        [ 48, 57 ] //0-9
    ];

    var pwd = "";
    for (var i = 0; i < len; i++)
    {
        var part = parts[0];
        //trace(part[0], part[1], Math.floor(Math.random() * (part[1] - part[0])));
        var code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
        var c = String.fromCharCode(code);
        pwd += c;
    }
    return pwd;
}

exports.getFunctionParameterName = function(func) {
    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var ARGUMENT_NAMES = /([^\s,]+)/g;var fnStr = func.toString().replace(STRIP_COMMENTS, '');
    var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
    if(result === null)
        result = [];
    return result;
}

exports.getCookieValue = function(cookies, key) {
    if (!isNaN(Number(cookies[key]))) return cookies[key];

    var val = decodeURIComponent(cookies[key]);
    val = val.trim();
    if (val.charAt(0) == "'" && val.charAt(val.length - 1) == "'") {
        return val.substr(1, val.length - 2);
    }
    return val;
}

exports.hashMapToArray = function(map, json, loopFunc) {
    var list = [];
    for (var key in map) {
        var obj = json ? JSON.parse(map[key]) : map[key];
        list.push(obj);
        if (loopFunc != null) {
            loopFunc(obj, key, map);
        }
    }
    return list;
}

exports.sortArrayByNumber = function(arr, field, order, func) {
    if (isNaN(order)) order = 1;
    arr.sort(function(value1, value2){
        if (func) func(value1, value2);
        if(value1[field] > value2[field]){
            return order * 1;
        } else if(value1[field] < value2[field]){
            return order * -1;
        } else{
            return 0;
        }
    } );
}

exports.convertArrayToHash = function(arr, key, dataHandler) {
    var map = {};
    arr.forEach(function(obj) {
        map[obj[key]] = dataHandler != null ? dataHandler(obj) : obj;
    });
    return map;
}

exports.convertArrayToHash = function(arr, key, dataHandler) {
    var map = {};
    arr.forEach(function(obj) {
        map[obj[key]] = dataHandler != null ? dataHandler(obj) : obj;
    });
    return map;
}

exports.convertDateString = function(date, spe) {
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();

    spe = spe ? spe : "";

    return y + spe + (m < 10 ? ("0" + m) : m) + spe + (d < 10 ? ("0" + d) : d);
}

exports.convertDateStringToTime = function(dateStr) {
    var parts = dateStr.split(" ");
    var dateArr = parts[0];
    var year;
    var month;
    var day;
    if (dateArr.indexOf("-") > 0) {
        dateArr = dateStr.split("-");
        year = dateArr[0];
        month = dateArr[1];
        day = dateArr[2];
    } else if (dateArr.indexOf("/") > 0) {
        dateArr = dateStr.split("/");
        year = dateArr[0];
        month = dateArr[1];
        day = dateArr[2];
    } else if (dateArr.indexOf(".") > 0) {
        dateArr = dateStr.split(".");
        year = dateArr[0];
        month = dateArr[1];
        day = dateArr[2];
    } else if (dateArr.indexOf("年") > 0) {
        year = dateStr.substring(0, dateStr.indexOf("年"));
        month = dateStr.substring(dateStr.indexOf("年") + 1, dateStr.indexOf("月"));
        day = dateStr.substring(dateStr.indexOf("月") + 1, dateStr.indexOf("日"));
    }

    var dt = new Date();
    dt.setYear(parseInt(year));
    dt.setMonth(parseInt(month) - 1);
    dt.setDate(parseInt(day));
    dt.setHours(0);
    dt.setMinutes(0);
    dt.setSeconds(0);
    dt.setMilliseconds(0);

    if (parts.length > 1) {
        try {
            var timeStr = parts[1];
            if (timeStr.indexOf(":") > 0) {
                var timeArr = timeStr.split(":");
                dt.setHours(parseInt(timeArr[0]));
                dt.setMinutes(parseInt(timeArr[1]));
                dt.setSeconds(timeArr.length > 2 ? parseInt(timeArr[2]) : 0);
            } else if (timeStr.indexOf("时") > 0) {
                var hh = timeStr.substring(0, timeStr.indexOf("时"));
                dt.setHours(parseInt(hh));
                if(timeStr.indexOf("分") > 0) {
                    var mm = timeStr.substring(timeStr.indexOf("时") + 1, timeStr.indexOf("分"));
                    dt.setMinutes(parseInt(mm));
                }
                if(timeStr.indexOf("秒") > 0) {
                    var ss = timeStr.substring(timeStr.indexOf("分") + 1, timeStr.indexOf("秒"));
                    dt.setSeconds(parseInt(ss));
                }
            }
        } catch (err) {
            return dt.getTime();
        }
    }
    return dt.getTime();
}

exports.convertDateTimeString = function(date, needSec, dateSpe, dateTimeSpe, timeSpe) {
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();

    var hh = date.getHours();
    var mm = date.getMinutes();
    var ss = date.getSeconds();

    dateSpe = dateSpe ? dateSpe : "";

    dateTimeSpe = dateTimeSpe ? dateTimeSpe : "";

    timeSpe = timeSpe ? timeSpe : "";

    return y + dateSpe + (m < 10 ? ("0" + m) : m) + dateSpe + (d < 10 ? ("0" + d) : d) + dateTimeSpe + (hh < 10 ? ("0" + hh) : hh) + timeSpe + (mm < 10 ? ("0" + mm) : mm) + (needSec ? (timeSpe + (ss < 10 ? ("0" + ss) : ss)) : "");
}

exports.convertSecToTimeStr = function(val, lang, allShow) {
    var str = '';
    var min = Math.floor(val / 60);
    var sec = val - min * 60;
    if (sec > 0) {
        str = (sec >= 10 ? sec : ('0' + sec)) + (lang == 'en' ? '' : '秒');
    } else {
        str = '';
    }
    var hour = Math.floor(min / 60);
    min = min - hour * 60;
    if (min > 0 || allShow) str = (min >= 10 ? min : ('0' + min)) + (lang == 'en' ? ':' : '分') + str;
    if (hour > 0 || allShow) str = (hour >= 10 ? hour : ('0' + hour)) + (lang == 'en' ? ':' : '小时') + str;
    return str;
}

exports.convertTimeToDate = function(time, toTime, lang, noSec) {
    var date = new Date();
    date.setTime(time);
    var m = date.getMonth() + 1;
    var d = date.getDate();
    var str = lang == "en" ? date.getFullYear() + "-" + (m >= 10 ? m : ('0' + m)) + "-" + (d >= 10 ? d : ('0' + d)) : date.getFullYear() + "年" + (m >= 10 ? m : ('0' + m)) + "月" + (d >= 10 ? d : ('0' + d)) + "日";
    if (toTime) {
        str += " " + (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes());
    }
    if (toTime && !noSec) {
        str += ":" + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
    }
    return str;
}

exports.getTimeHourAndMin = function(time, noSec) {
    var date = new Date();
    date.setTime(time);
    var str = (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes());
    if (!noSec) {
        str += ":" + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
    }
    return str;
}

exports.changeDay = function(date, passDay) {
    var todayStart = new Date();
    todayStart.setTime(date.getTime());
    todayStart = todayStart.getTime();
    todayStart += passDay * 24 * 60 * 60 * 1000;
    var day = new Date();
    day.setTime(todayStart);
    return day;
}

exports.propertyJsonParse = function(obj, clone) {
    var temp = {};
    if (!clone) {
        temp = obj;
    }
    for (var key in obj) {
        var val = obj[key];
        if (typeof val == 'string' && (String(val).indexOf('{}') == 0 || String(val).indexOf('{"') == 0 || String(val).indexOf('[]') == 0 || String(val).indexOf('[{') == 0 || String(val).indexOf('[[') == 0)) {
            try {
                temp[key] = JSON.parse(obj[key]);
            } catch (err) {
                console.error("Utils.propertyJsonParse throw an error ==> " + err.toString());
            }
        } else if (clone) {
            temp[key] = obj[key];
        }
    }
    return temp;
}

exports.propertyJsonStringify = function(obj, clone) {
    var temp = {};
    if (!clone) {
        temp = obj;
    }
    for (var key in obj) {
        var val = obj[key];
        if (typeof val == 'object') {
            try {
                temp[key] = JSON.stringify(obj[key]);
            } catch (err) {
                console.error("Utils.propertyJsonStringify throw an error ==> " + err.toString());
            }
        } else if (clone) {
            temp[key] = obj[key];
        }
    }
    return temp;
}

exports.getFromUrl = function(url) {
    var option = typeof arguments[1] == "function" ? null : arguments[1];
    var callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
    if (typeof callBack != "function") callBack = null;

    if (option && option.debug) console.log("ready to request [" + url + "]...");
    if (option && option.debug) option._startTime = Date.now();
    var headers = option && option.headers ? option.headers : {};
    var urlInfo = URL.parse(url);

    var req = HTTP.get({
        hostname:urlInfo.hostname,
        port:urlInfo.port ? urlInfo.port : 80,
        path:urlInfo.path,
        headers:headers
    }, function(res){
        req.$response = res;
        req.getResponseCookie = function(key) {
            if (req.$responseCookies) {
                return req.$responseCookies[key];
            } else if (req.$response && req.$response.headers) {
                var cookies = require("cookie").parse(req.$response.headers["set-cookie"]);
                cookies = cookies || {};
                req.$responseCookies = cookies;
                return cookies[key];
            } else {
                return null;
            }
        };

        var buffer = new BufferHelper();
        res.on("data", function(data){
            if (req._isTimeout == true) {
                if (option && option.debug) console.log("ops! time out....<data>");
                return;
            }
            if (option && option.debug) console.log("request response data ==> " + data.length + " bytes");
            buffer.concat(data);
        }).on("end",function(){

            clearTimeout(req._timeoutTimer);

            if (req._isTimeout == true) {
                if (option && option.debug) console.log("ops! time out....<end>");
                return;
            }

            var buf = buffer.toBuffer();
            if (option && option.debug) {
                option._costTime = Date.now() - option._startTime;
                console.log("request end ==> " + buf.length + " bytes     " + option._costTime + "ms");
            }

            //var buf = new Buffer(html,'binary');
            var str = ICONV.decode(buf, (option && option.encoding) ? option.encoding : "utf8");
            callBack(str);
        }).on("close",function(){
            callBack(null, new Error("request connection has been closed."));
        });
    });
    req.on('error',function(err){
        callBack(null, err);
    });
    if (option && option.timeout && option.timeout > 0) {
        req._timeoutTimer = setTimeout(function() {
            req._isTimeout = true;
            clearTimeout(req._timeoutTimer);
            if (option.debug) console.log("request timeout (" + option.timeout + "s).");
            callBack(null, new Error("request timeout."));
        }, option.timeout * 1000);
    }
    return req;
}

exports.html_encode = function(str) {
    var s = "";
    if (str.length == 0) return "";
    s = str.replace(/&/img, "&gt;");
    s = s.replace(/</img, "&lt;");
    s = s.replace(/>/img, "&gt;");
    s = s.replace(/ /img, "&nbsp;");
    s = s.replace(/\'im/g, "&#39;");
    s = s.replace(/\"/img, "&quot;");
    s = s.replace(/\n/img, "<br>");
    s = s.replace(/“/img, "&ldquo;");
    s = s.replace(/”/img, "&rdquo;");
    return s;
}

exports.html_decode = function(str) {
    var s = "";
    if (str.length == 0) return "";
    s = str.replace(/&gt;/img, "&");
    s = s.replace(/&lt;/img, "<");
    s = s.replace(/&gt;/img, ">");
    s = s.replace(/&nbsp;/img, " ");
    s = s.replace(/&#39;/img, "\'");
    s = s.replace(/&quot;/img, "\"");
    s = s.replace(/<br>/img, "\n");
    s = s.replace(/&ldquo;/img, "“");
    s = s.replace(/&rdquo;/img, "”");
    return s;
}

exports.fetchFirstOneFromHash = function(hash) {
    if (!hash) return null;
    for (var prop in hash) {
        return hash[prop];
    }
}

exports.parseIP = function (req) {
    try {
        var ip = req.headers['X-Real-IP'] ||
            req.headers['X-Forwarded-For'] ||
            req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
        if (ip == "::1" || ip == "127.0.0.1") ip = "0.0.0.0";
        return ip;
    } catch (err) {
        return "unknown"
    }
}

var TIME_RECORD = {};

exports.startRecordTime = function(id) {
    TIME_RECORD[id] = Date.now();
}

exports.getCostTime = function(id) {
    var time = Date.now() - TIME_RECORD[id];
    delete TIME_RECORD[id];
    return time;
}

/***
 * 各种服务端验证
 * modify by YDY 2015/9/30
 ***/

//验证邮箱地址
exports.checkEmailFormat = function(str){
    if (!str || typeof str != 'string') return false;
    var re = /^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/;
    return re.test(str);
}

//验证电话号码，手机或座机
exports.checkPhoneFormat = function(str){
    if (!str || typeof str != 'string') return false;
    var re = /^1\d{10}$/;
    if (!re.test(str)) {
        re = /^0\d{2,3}-?\d{7,8}$/;
        return re.test(str);
    } else {
        return true;
    }
}

//验证大陆手机号码
exports.cnCellPhoneCheck = function(str){
    if (!str || typeof str != 'string') return false;
    var re = /^1\d{10}$/;
    if(str.indexOf(",") != -1){
        var p = str.split(",");
        p.forEach(function(v){
           if(!re.test(v)){
               return false;
           }
        });
        return true;
    }else{
        if (!str || str == "" || str == "undefined" || str == "null") return false;
        return re.test(str);
    }
}

///////////////////////////////////////////////////////////////////////////

exports.idCardCheck = function (arrIdCard){
    if (!arrIdCard || typeof arrIdCard != 'string') return false;
    var tag = false;
    var sigma = 0;
    var a = new Array(7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2 );
    var w = new Array("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2");
    for (var i = 0; i < 17; i++) {
        var ai = parseInt(arrIdCard.substring(i, i + 1));
        var wi = a[i];
        sigma += ai * wi;
    }
    var number = sigma % 11;
    var check_number = w[number];
    if (arrIdCard.substring(17) != check_number) {
        tag =  false;
    } else {
        tag = true;
    }
    return tag;
}

exports.urlCheck = function (str){
    if (!str || typeof str != 'string') return false;

    var reg = new RegExp("(http://){0,1}([0-9a-zA-z].+\.).+[a-zA-z].+/{0,1}");
    var isurl = reg.test(str);
    return isurl;
}

exports.lookUpProperty = function(obj, prop) {
    if (obj == null || obj == undefined || prop == null || prop == undefined) return null;
    if (prop.indexOf(".") <= 0) return obj[prop];

    var keys = prop.split(".");
    var val = obj;
    for (var i = 0; i < keys.length; i++) {
        val = val[keys[i]];
        if (val == null || val == undefined) return null;
    }
    return val;
}

exports.setProperty = function(obj, prop, val) {
    if (prop == null || prop == undefined) return obj;
    obj = obj ? obj : {};
    if (prop.indexOf(".") < 0) {
        obj[prop] = val;
        return obj;
    }

    var keys = prop.split(".");
    var temp = obj;
    for (var i = 0; i < keys.length; i++) {
        if (i == keys.length - 1) {
            temp[keys[i]] = val;
        } else {
            if (!temp[keys[i]]) {
                temp[keys[i]] = {};
            }
            temp = temp[keys[i]];
        }
    }
    return obj;
}

exports.deepClone = function(obj) {
    if (!obj) return obj;
    var copy = {};
    for (var prop in obj) {
        exports.setProperty(copy, prop, obj[prop]);
    }
    return copy;
}

exports.isFromMobile = function() {
    try {
        var userAgent = arguments[0];
        if (typeof userAgent == 'object') {
            userAgent = userAgent.headers['user-agent']
        }
        var u = userAgent.toLowerCase();
        var mobile = u.indexOf('mobile') > -1;
        var wp = u.indexOf('iemobile') > -1; //是否为windows phone
        var android = u.indexOf('android') > -1; //android终端
        var iPhone = u.indexOf('iphone') > -1; //是否为iPhone
        var iPad = u.indexOf('ipad') > -1; //是否iPad
        return mobile || wp || android || iPhone || iPad;
    } catch (err) {
        return false;
    }
}

exports.isFromAndroid = function() {
    try {
        var userAgent = arguments[0];
        if (typeof userAgent == 'object') {
            userAgent = userAgent.headers['user-agent']
        }
        var u = userAgent.toLowerCase();
        var mobile = u.indexOf('mobile') > -1;
        var android = u.indexOf('android') > -1; //android终端
        return mobile && android;
    } catch (err) {
        return false;
    }
}

exports.isFromIOS = function() {
    try {
        var userAgent = arguments[0];
        if (typeof userAgent == 'object') {
            userAgent = userAgent.headers['user-agent']
        }
        var u = userAgent.toLowerCase();
        var mobile = u.indexOf('mobile') > -1;
        var iPhone = u.indexOf('iphone') > -1; //是否为iPhone
        var iPad = u.indexOf('ipad') > -1; //是否iPad
        return mobile && iPhone && iPad;
    } catch (err) {
        return false;
    }
}

exports.randomCellPhone = function(sed){
    var phoneNumber = sed || "130";
    for (var i=0;i<8;i++) phoneNumber += parseInt(Math.random() * 10);
    return phoneNumber;
}

exports.createIdCard = function (){
    var id_number;
    var sigma = 0;
    var a = new Array(7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2 );
    var w = new Array("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2");

    do{
        id_number = "";
        for (var i = 0; i < 17; i++) {
            var ele = a[parseInt(Math.random()*10)];
            id_number += ele;
            var ai = parseInt(ele);
            var wi = a[i];
            sigma += ai * wi;
        }
        var number = sigma % 11;
        var check_number = w[number];
        id_number += check_number;

        var check = exports.idCardCheck(id_number);
    }while( !check );

    return id_number;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

exports.calDistanceInMeters = function(p1, p2) {
    p1 = arguments.length == 2 ? arguments[0] : [ arguments[0], arguments[1] ];
    p2 = arguments.length == 2 ? arguments[1] : [ arguments[2], arguments[3] ];

    var x1 = p1[0];
    var y1 = p1[1];
    var x2 = p2[0];
    var y2 = p2[1];

    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(x2 - x1);     // deg2rad below
    var dLon = deg2rad(y2 - y1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(x1)) * Math.cos(deg2rad(x2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return Math.floor(d * 1000);
}