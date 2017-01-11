/**
 * Created by Jay on 2016/1/4.
 */
var Utils = require("wego/utils/Utils");
var gulp = require('gulp');
var gutil = require('gulp-util');
var through = require('through2');
var pp = require('preprocess');
var PATH = require("path");
var FS = require("fs");

function shortPath(path) {
    path = path.replace(/\.\.\//img, '');
    path = path.replace(/\.\//img, '');
	if (path.indexOf("/") == 0) path = path.substr(1);
    return path;
}

module.exports = function (options) {
    return through.obj(function (file, enc, cb) {
        console.log("++++++++++++ " + file.path + " ++++++++++++");

        // 如果文件为空，不做任何操作，转入下一个操作，即下一个 .pipe()
        if (file.isNull()) {
            this.push(file);
            return cb();
        }
        var instance = this;

        var rootPath = options.rootPath;
        var buildPath = options.buildPath;

        // 插件不支持对 Stream 对直接操作，跑出异常
        if (file.isStream()) {
            this.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
            return cb();
        }

        // 将文件内容转成字符串，并调用 preprocess 组件进行预处理
        // 然后将处理后的字符串，再转成Buffer形式
        var content = pp.preprocess(file.contents.toString(), options || {});
        //file.contents = new Buffer(content);

        //<script src="js/mui.js"></script>

        var CSS_REG = /<link[^>]*\/>/img;
        var JS_REG = /<script[^>]*>.*<\/script>/img;

        var blocks = content.match(JS_REG);
        blocks = blocks || [];

        var jsList = [];
        var cssList = [];

        blocks.forEach(function(block) {
            var jsPath = block.substring(block.indexOf(" src") + 1);
            jsPath = jsPath.replace(/'/img, "\"");
            jsPath = jsPath.replace(/\s?=\s?/i, "=");
            jsPath = jsPath.replace("src=\"", "");
            jsPath = jsPath.substring(0, jsPath.indexOf("\""));
            jsPath = jsPath.trim();
            jsList.push(jsPath);
            content = content.replace(block, '<script>%' + jsPath + '%</script>');
        });

        jsList = jsList || [];

        blocks = content.match(CSS_REG);
        blocks = blocks || [];
        blocks.forEach(function(block) {
            var cssPath = block.substring(block.indexOf(" href") + 1);
            cssPath = cssPath.replace(/'/img, "\"");
            cssPath = cssPath.replace(/\s?=\s?/i, "=");
            cssPath = cssPath.replace("href=\"", "");
            cssPath = cssPath.substring(0, cssPath.indexOf("\""));
            cssPath = cssPath.trim();
            cssList.push(cssPath);
            content = content.replace(block, '<css>%' + cssPath + '%</css>');
        });

        jsList = jsList || [];
        cssList = cssList || [];

        var q = [];

        jsList.forEach(function(jsPath) {
            q.push(function(cb2) {
                var path = PATH.resolve(buildPath, shortPath(jsPath));
                FS.readFile(path, function(err, data) {
                    console.log("merged js ==> " + jsPath);
                    var block = '<script>%' + jsPath + '%</script>';
                    if (err) {
                        console.log("[Warning] no such file ---> " + path);
                        content.replace(block, '');
                    } else {
                        var all = data.toString("utf8");
                        content = content.replace(block, '<script>' + all + '</script>');
                        content = content.replace(block, '');
                    }
                    cb2(err);
                });
            });
        });

        cssList.forEach(function(cssPath) {
            q.push(function(cb2) {
                var path = PATH.resolve(buildPath, shortPath(cssPath));
                FS.readFile(path, function(err, data) {
                    console.log("merged css ==> " + cssPath);
                    var block = '<css>%' + cssPath + '%</css>';
                    if (err) {
                        console.log("[Warning] no such file ---> " + path);
                        content.replace(block, '');
                    } else {
                        var all = data.toString("utf8");
                        content = content.replace(block, '<style>' + all + '</style>');
                        content = content.replace(block, '');
                    }
                    cb2(err);
                });
            });
        });
        runAsQueue(q, function(err) {
            console.log('merge completed');
            console.log("------------- " + file.path + " -------------");
            if (err) {
                cb(err);
            } else {
                content = content.replace(/@charset "UTF-8";/img, '');
                file.contents = new Buffer(content);
                cb(null, file);
            }
        });

    });
};