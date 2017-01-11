/**
 * Created by Jay on 2015/9/25.
 */
var PATH = require("path");
var Utils = require("./utils/Utils");

function App() {
    var args = Utils.cloneObject(process.argv);
    var runArgs = args.splice(2);
    global.VARS = {};
    for (var i = 0; i < runArgs.length; i++) {
        var key = runArgs[i];
        if (key.charAt(0) == "-") {
            key = key.substring(1);
            var temp = key.split("=");
            key = temp[0];
            var val = true;
            if (temp.length > 1) {
                val = temp[1];
                if (String(val) == "true") val = true;
                else if (String(val) == "false") val = false;
            }
            global.VARS[key] = val;
        }
    }
    if (!global.VARS.env) global.VARS.env = "localdev";

    if (!global.APP_ROOT) global.APP_ROOT = PATH.parse(process.mainModule.filename).dir;

    global.requireModule = function(path) {
        return require(PATH.join(global.APP_ROOT, "server/" + path));
    };

    global.SETTING = global.requireModule("config/" + global.VARS.env + "/setting.js");
    global.getConfigPath = function(file) {
        return PATH.join(global.APP_ROOT, "server/config/" + global.VARS.env + "/" + file);
    }

    this.startupTasks = [];
}

App.prototype.addTask = function(func) {
    this.startupTasks.push(func);
}

App.prototype.run = function(callBack) {
    Utils.runQueueTask(this.startupTasks, function(err) {
        if (callBack) {
            callBack(err);
            return;
        }
        if (err) {
            console.error(":( Server startup fail :( ==> " + err);
        } else {
            console.log("(づ￣ 3￣)づ Server startup successfully. [env: " + global.VARS.env + "]");
        }
    });
}

module.exports = App;