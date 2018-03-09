/**
 * Created by Jay on 2017/9/20.
 */

const FS = require("fs");
const PATH = require("path");
const util = require('util');
const vm = require('vm');

var deepmerge = require("deepmerge");

function setValue(str, key, val) {
    if (typeof val == "number" || typeof val == "boolean") {
        str = str.replace(new RegExp("[\"']\\$\\{" + key + "\\}[\"']", "img"), val);
    }
    return str.replace(new RegExp("\\$\\{" + key + "\\}", "img"), val);
}

function checkFileExists(path) {
    try {
        FS.statSync(path);
        return true;
    } catch (err) {
        return false;
    }
}

function readJSON(path) {
    try {
        if (path.substr(path.length - 3).toLowerCase() == ".js") {
            return require(path);
        }
        var txt = FS.readFileSync(path, "utf8");
        txt = JSON.parse(txt);
        return txt;
    } catch (err) {
        console.error(err);
        return {};
    }
}

function build(topFile, customFile) {
    var setting = {};
    if (checkFileExists(topFile)) {
        setting = readJSON(topFile);
    }

    var custom = {};
    if (checkFileExists(customFile)) {
        custom = readJSON(customFile);
    }

    setting = deepmerge(setting, custom);

    var settingStr = JSON.stringify(setting);

    var vars = setting.$VARS || {};
    vars.APP_ROOT = global.APP_ROOT.replace(/\\/gm, "\\\\");
    vars.ENV = global.VARS.env;
    _.map(vars, function (val, key) {
        if (typeof val === "object") val = JSON.stringify(val);
        settingStr = setValue(settingStr, key, val);
    });

    var filters = settingStr.match(/Filter\.[^\)]*\([^\)]*\)/ig);
    if (filters && filters.length > 0) {
        filters.forEach(function (block) {
            var sandbox = {
                Filter: Filter,
                value:undefined
            };
            var context = new vm.createContext(sandbox);
            var script = new vm.Script(`value = ${block}`);
            script.runInContext(context);
            settingStr = settingStr.replace(block, sandbox.value);
        });
    }

    setting = JSON.parse(settingStr);

    return setting;
}

var Filter = {
    path: function () {
        var args = Array.prototype.slice.call(arguments, 0);
        var path = PATH.join.apply(PATH, args);
        path = path.replace(/\\/gm, "\\\\");
        return path;
    }
};

exports.init = function () {
    var topFile = PATH.join(global.APP_ROOT, "server/config/setting.js");
    var customFile = PATH.join(global.APP_ROOT, `server/config/${global.VARS.env}/setting.js`);
    return build(topFile, customFile);
}

exports.build = build;
