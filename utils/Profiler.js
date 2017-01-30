/**
 * Created by Jay on 29/01/2017.
 */
var Redis = require("../model/Redis");

function Profiler(option) {

    var instance = this;

    this.option = option || {};

    this.name = this.option.name || "default";

    this.records = [];

    this.start = function() {
        this.profileTimer = setInterval(this.saveProfile.bind(this), this.option.duration || 3000);
    }
    
    this.saveProfile = function () {
        if (this.records && this.records.length > 0) {
            Redis.multi(this.records);
            this.records.length = 0;
        }
    }

    this.recordRequest = function(req) {
        if (!req.$target || isNaN(req.$startTime) || req.$startTime <= 0) return;
        var now = Date.now();
        var costTime = now - req.$startTime;
        var target = req.$target;

        this.records.push([ "ZADD", Redis.join(`profiling_${this.name}_request_${target}`), costTime, now ]);
    }

    this.stop = function() {
        this.profileTimer && clearInterval(this.profileTimer);
        if (this.records) this.records.length = 0;
    }

    this.clean = function(callBack) {
        var key = Redis.join(`profiling_${this.name}_request_*`);
        return new Promise(function(resolve, reject) {
            Redis.findKeysAndDel(key, function(err) {
                if (callBack) return callBack(err);
                err ? reject(err) : resolve();
            });
        });
    }

    this.view = function(callBack, mapFunc) {
        var prefix = Redis.join(`profiling_${this.name}_request_`);
        return new Promise(function(resolve, reject) {
            Redis.do("keys", [ prefix + "*" ], function(err, keys) {
                if (err) {
                    if (callBack) return callBack(err);
                    return reject(err);
                }

                keys = keys || [];
                var list = [];
                var result = { total:0, avg:0, max:0, totalAvgTime:0, targets:list };
                var num = 0;
                var tempNum = 0;

                var done = function() {
                    delete result["totalAvgTime"];
                    if (callBack) return callBack(null, result);
                    resolve(result);
                };

                keys.forEach(function(key) {
                    var obj = {};

                    Redis.do("ZRANGE", [ key, 0, -1, "WITHSCORES" ], function(err, res) {
                        num ++;
                        if (err) console.error(err);
                        else {
                            res = res || [];
                            var count = 0;
                            var min = 0;
                            var max = 0;
                            var avg = 0;
                            var total = 0;
                            for (var i = 0; i < res.length; i += 2) {
                                var t = res[i];
                                var c = res[i + 1];
                                count ++;
                                total += Number(c);
                                min = Math.min(min, c);
                                max = Math.max(max, c);
                            }
                            tempNum ++;
                            avg = Math.ceil(total / count);

                            obj.min = min;
                            obj.max = max;
                            obj.avg = avg;
                            obj.count = count;
                            obj.target = key.replace(prefix, "").replace("_", ".");
                            list.push(obj);

                            result.total += count;
                            result.totalAvgTime += avg;
                            result.max = Math.max(max, result.max);

                            mapFunc && mapFunc(obj);
                            //console.log(`${obj.method} ---> count: ${obj.count}     avg: ${obj.avg}     min: ${obj.min}     max: ${obj.max}`);
                        }
                        if (num >= keys.length) {
                            result.avg = Math.ceil(result.totalAvgTime / tempNum);
                            //console.log(`total requests: ${result.total}`);
                            //console.log(`avg request time: ${result.avg}`);
                            //console.log(`max request time: ${result.max}`);

                            done();
                        }
                    });
                });
                if (keys.length <= 0) {
                    done();
                }
            });
        });
    }
}

module.exports = Profiler;
