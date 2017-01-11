/**
 * Created by Jay on 14-5-8.
 */

var CP = require('child_process');
var PATH = require('path');

function run(executor, args, callBack, outCallBack) {
    var cmd = executor;
    if (args && args.length > 0) {
        cmd += " \"" + args.join("\" \"") + "\"";
    }

    //console.log("shell run cmd ==> " + cmd);
    CP.exec(cmd, function(err, stdout, stderr) {
        if (err) console.log(new Buffer(err, "ansi").toString("utf8"));

        //console.log(stdout);

        if (stdout && outCallBack) {
            outCallBack(stdout);
        }

        if (callBack) {
            callBack(err ? false : true);
        }
    });
}

exports.run = run;

