/**
 * Created by Jay on 10/29/14.
 *
 * { "type":2, "time":"00:02:00", "script":"daily_counting_data" },
 * { "type":1, "firstDelay":0, "duration":20, "disableTime":[ "23:58:00-23:59:59", "00:00:00-00:02:00" ], "waitCallBack":true, "script":"cninfo_zxb", "option":{ "request":{ "encoding":"gb2312", "timeout":8 } } },
 */


var FS = require("fs");
var PATH = require("path");
var Utils = require("../utils/Utils.js");

var config;

var clockTimer;

var intervalThreadPool = [];
var dailyThreadPool = [];

var DEBUG;

function checkIsInTimeRange(startTime, endTime) {
    var now = new Date();
    var dt0 = new Date();
    dt0.setHours(Number(startTime[0]), Number(startTime[1]), Number(startTime[2]), 0);
    dt0 = dt0.getTime();

    if (now < dt0) {
        return false;
    }

    var dt1 = new Date();
    dt1.setHours(Number(endTime[0]), Number(endTime[1]), Number(endTime[2]), 0);
    dt1 = dt1.getTime();

    if (now > dt1) {
        return false;
    }

    return true;
}

exports.start = function(debug) {

    DEBUG = debug;

    if (!config) {
        config = FS.readFileSync(PATH.join(global.APP_ROOT, "server/schedule/localdev.json"));
        config = JSON.parse(config.toString("utf8"));
    }

    for (var i = 0;i < config.list.length; i++) {
        //{ "db":"*", "duration":"5", "script":"test" }
        var sobj = config.list[i];
        switch (sobj.type) {
            case 1:
                if (sobj.disableTime) {
                    var temp = [];
                    sobj.disableTime.forEach(function(range) {
                        range = range.split("-");
                        var startTime = range[0].split(":");
                        var endTime = range[1].split(":");
                        temp.push([ startTime, endTime ]);
                    });
                    sobj.disableTime = temp;
                }

                intervalThreadPool.push(createIntervalThread(sobj));
                break;
            case 2:
                dailyThreadPool.push(createDailyThread(sobj));
                break;
        }
    }

    runClock();
}

function createIntervalThread(sobj) {
    var thread = {};
    thread.id = Utils.randomString(12);
    thread.data = sobj;

    var init = function() {
        if (sobj.waitCallBack == true) {
            var work = function(err) {
                clearTimeout(thread.timer);
                thread.timer = setTimeout(function() {
                    execScript(sobj.script, work, sobj.option, sobj.disableTime);
                }, sobj.duration * 1000);
            }
            work(null);
        } else {
            thread.timer = setInterval(function() {
                execScript(sobj.script, null, sobj.option, sobj.disableTime);
            }, sobj.duration * 1000);
        }

        if (sobj.initExecute == true) {
            execScript(sobj.script, null, sobj.option, sobj.disableTime);
        }
    }

    if (sobj.firstDelay > 0) {
        setTimeout(init, sobj.firstDelay * 1000);
    } else {
        init();
    }

    return thread;
}

function createDailyThread(sobj) {
    var thread = {};
    thread.id = Utils.randomString(12);
    thread.data = sobj;

    if (sobj.initExecute == true) {
        execScript(sobj.script, null, sobj.option);
    }

    return thread;
}

function runClock() {
    clearInterval(clockTimer);
    clockTimer = setInterval(timeRunning, 1000);
}

function timeRunning() {
    var now = new Date();
    var nowms = now.getTime();
    dailyThreadPool.forEach(function(thread) {

        if (!thread.dailyExecuteTime) {
            var time = thread.data.time.split(":");
            var scheduleTime = new Date();
            scheduleTime.setHours(Number(time[0]), Number(time[1]), Number(time[2]));
            scheduleTime.setMilliseconds(0);
            scheduleTime = scheduleTime.getTime();

            var temp = new Date();
            temp.setMilliseconds(0);
            temp = temp.getTime();

            if (scheduleTime < temp) {
                scheduleTime += 24 * 60 * 60 * 1000;
            }

            thread.dailyExecuteTime = scheduleTime;
            var nextTime = new Date();
            nextTime.setTime(scheduleTime);
            if (DEBUG) console.log("daily schedule [" + thread.data.script + "] will be executed at: " + nextTime.toLocaleString());
        }

        var d = nowms - thread.dailyExecuteTime;
        if (d >= 0) {
            //Time to go
            thread.dailyExecuteTime = null;
            execScript(thread.data.script, null, thread.data.option);
        }
    });
}

function execScript(script, callBack, option, disableTime) {
    if (disableTime) {
        for (var i = 0; i < disableTime.length; i++) {
            if (checkIsInTimeRange(disableTime[i][0], disableTime[i][1])) {
                if (DEBUG) console.log("*" + script + "* in disable time ==> skip.");
                setTimeout(callBack, 100);
                return;
            }
        }
    }
    if (DEBUG) console.log("ready to execute script ==> " + script);
    var scriptJS = global.requireModule("schedule/" + script + ".js");
    scriptJS.exec(function(err) {
        if (err) console.error("*" + script + "* throws an error ==> " + err.toString());
        if (callBack) callBack(err);
    }, option ? JSON.parse(JSON.stringify(option)) : {});
}