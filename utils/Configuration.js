/**
 * Created by Jay on 2017/9/20.
 */

const FS = require("fs");
const PATH = require("path");
const util = require('util');
const vm = require('vm');
const _set = require("lodash/set");

let deepmerge = require("deepmerge");

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
        let txt = FS.readFileSync(path, "utf8");
        txt = JSON.parse(txt);
        return txt;
    } catch (err) {
        console.error(err);
        return {};
    }
}

function build(topFile, customFile) {
    let setting = {};
    if (checkFileExists(topFile)) {
        setting = readJSON(topFile);
    }

    let custom = {};
    if (checkFileExists(customFile)) {
        custom = readJSON(customFile);
    }

    setting = deepmerge(setting, custom);

    let settingStr = JSON.stringify(setting);

    let vars = setting.$VARS || {};
    let overrides = {};
    for (let key in global.VARS) {
        let val = global.VARS[key];
        if (key.startsWith("vars.$.")) {
            key = key.replace("vars.$.", "");
            vars[key] = val;
        } else if (key.startsWith("vars.")) {
            key = key.replace("vars.", "");
            overrides[key] = val;
        }
    }
    setting.$VARS = vars;
    vars.APP_ROOT = global.APP_ROOT.replace(/\\/gm, "\\\\");
    vars.ENV = global.VARS.env;
    _.map(vars, function (val, key) {
        if (typeof val === "object") val = JSON.stringify(val);
        settingStr = setValue(settingStr, key, val);
    });

    let filters = settingStr.match(/Filter\.[^\)]*\([^\)]*\)/ig);
    if (filters && filters.length > 0) {
        filters.forEach(function (block) {
            let sandbox = {
                Filter: Filter,
                value:undefined
            };
            let context = new vm.createContext(sandbox);
            let script = new vm.Script(`value = ${block}`);
            script.runInContext(context);
            settingStr = settingStr.replace(block, sandbox.value);
        });
    }

    setting = JSON.parse(settingStr);

    for (let key in overrides) {
        _set(setting, key, overrides[key]);
    }

    return setting;
}

let Filter = {
    path: function () {
        let args = Array.prototype.slice.call(arguments, 0);
        let path = PATH.join.apply(PATH, args);
        path = path.replace(/\\/gm, "\\\\");
        return path;
    }
};

exports.init = function () {
    let topFile = PATH.join(global.APP_ROOT, "server/config/setting.js");
    let customFile = PATH.join(global.APP_ROOT, `server/config/${global.VARS.env}/setting.js`);
    return build(topFile, customFile);
}

exports.build = build;
