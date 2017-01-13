/**
 * Created by Jay on 2016/8/30.
 */

var UTIL = require("util");
var Utils = require("./Utils");

var checker = {};

checker["string"] = function(val, allowEmpty) {
    if (allowEmpty && (!val || val == "")) return { value:val };
    if (!val || val == "") {
        return { value:null, err:new Error("empty string") };
    }
    return { value:val };
}

checker["json"] = function(val) {
    if (typeof val == "object") return { value:val };
    try {
        val = (val == "{}") ? {} : JSON.parse(val);
    } catch (err) {
        console.error('JSON.parse error ----> ' + val);
        return { value:null, err:err };
    }
    return { value:val };
}

checker["object"] = function(val) {
    return checker["json"](val);
}

checker["array"] = function(val) {
    if (val instanceof Array) {
        return { value:val };
    } else {
        if (typeof val != "object" && typeof val != "string") return { value:null, err:new Error("invalid Array") };

        try {
            val = (val == "[]") ? [] : JSON.parse(val);
        } catch (err) {
            console.error('JSON.parse error ----> ' + val);
            return { value:null, err:err };
        }
        return { value:val };
    }
}

checker["email"] = function(val) {
    if (!Utils.checkEmailFormat(val)) {
        return { value:null, err:new Error("invalid email") };
    }
    return { value:val };
}

checker["cellphone"] = function(val) {
    if (!Utils.cnCellPhoneCheck(val)) {
        return { value:null, err:new Error("invalid cellphone") };
    }
    return { value:val };
}

checker["boolean"] = function(val) {
    if (String(val) != "true" && String(val) != "false" && String(val) != "1" && String(val) != "0") {
        return { value:null, err:new Error("invalid boolean") };
    }
    var flag = (String(val) == "true" || String(val) == "1") ? true : false;
    return { value:flag };
}

checker["number"] = function(val) {
    if (isNaN(Number(val))) {
        return { value:null, err:new Error("NaN number") };
    }
    return { value:Number(val) };
}

checker["int"] = function(val) {
    if (isNaN(Number(val))) {
        return { value:null, err:new Error("NaN int") };
    }
    return { value:parseInt(val) };
}

checker["geo"] = function(val) {
    if (typeof val == "string") {
        val = val.replace(/\s/g, '')
        if (val.indexOf(",") > 0) {
            val = val.split(",");
        } else {
            try {
                val = JSON.parse(val);
            } catch (err) {
                return { value:null, err:new Error("invalid geo") };
            }
        }
    }
    val = [ Number(val[0]), Number(val[1]) ];
    if (isNaN(Number(val[0])) || isNaN(Number(val[1]))) {
        return { value:null, err:new Error("invalid geo") };
    }
    return { value:val };
}

module.exports = checker;