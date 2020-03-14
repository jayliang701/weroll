/**
 * Created by Jay on 2015/9/25.
 */
const CLUSTER = require('cluster');
const PATH = require("path");
const vm = require('vm');
const Configuration = require("./utils/Configuration");
const Utils = require("./utils/Utils");

function App() {
    global.pm2 = process.env.hasOwnProperty("NODE_APP_INSTANCE") && process.env.NODE_APP_INSTANCE >= 0;
    global.workerID = global.pm2 ? process.env.NODE_APP_INSTANCE : (CLUSTER.worker ? (CLUSTER.worker.id - 1) : 0);

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
                else {
                    let str = val;
                    if (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'") {
                        str = val.substring(1, val.length - 1);
                    } else if (val.charAt(0) === "\"" && val.charAt(val.length - 1) === "\"") {
                        str = val.substring(1, val.length - 1);
                    }
                    try {
                        str = vm.runInNewContext(str);
                    } catch (err) {
                        str = val;
                    }
                    val = str;
                }
            }
            global.VARS[key] = val;
        }
    }
    if (!global.VARS.env) global.VARS.env = "localdev";

    if (!global.APP_ROOT) global.APP_ROOT = PATH.parse(process.mainModule.filename).dir;

    global.requireModule = function(path) {
        return require(PATH.join(global.APP_ROOT, "server/" + path));
    };

    global.SETTING = Configuration.init();

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
            console.error(":( Server startup fail :( ==> ", err);
        } else {
            console.log(`
 +-+-+-+-+-+-+
 |W|E|R|O|L|L|
 +-+-+-+-+-+-+`);
            console.log("Server startup successfully. [env: " + global.VARS.env + "]");
        }
    });
}

module.exports = App;