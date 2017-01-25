
var PATH = require("path");
var FS = require("fs");

var Utils = require("../utils/Utils");

var SERVICE_LIST = null;

var getFunctionParameterName = Utils.getFunctionParameterName || function(func) {
        var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
        var ARGUMENT_NAMES = /([^\s,]+)/g;var fnStr = func.toString().replace(STRIP_COMMENTS, '');
        var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
        if(result === null)
            result = [];
        return result;
    }

function renderAPIDoc(req, res, output, user) {
    var done = function() {
        var callback = require("url").parse(req.url, true).query.callback;
        res.writeHead(200, {
            "Content-Type":"text/plain; charset=utf-8"
        });
        res.end(callback + "(" + JSON.stringify(SERVICE_LIST) + ")");
    }
    if (SERVICE_LIST) {
        done();
    } else {
        renderRoot(req, res, function(data) {
            done();
        }, user);
    }
}

function renderRoot(req, res, output, user) {

    if (!SERVICE_LIST) {
        SERVICE_LIST = [];

        var checkFolder = function(path, handler) {
            var files = FS.readdirSync(path);
            files.forEach(function(rf) {
                if (rf.indexOf(".") >= 0) {
                    if (rf.substr(rf.length - 3, 3) == ".js") {
                        handler(path, rf);
                    }
                } else {
                    checkFolder(PATH.join(path, rf), handler);
                }
            });
        }

        var doRegisterService = function(path, file) {
            //read comments
            var scripts = FS.readFileSync(PATH.join(path, file), { encoding:"utf-8" });

            path = path.replace(global.APP_ROOT, "").replace("\\server\\", "").replace("/server/", "").replace("\\", "/");
            var service = global.requireModule(path + "/" + file);
            if (service.config && service.config.name && service.config.enabled == true) {
                var methods = [];
                for (var key in service) {
                    var val = service[key];
                    if (typeof val != "function" || key.indexOf("$") == 0) continue;
                    var funcArgs = getFunctionParameterName(val);
                    if (funcArgs[0] == 'req' && funcArgs[1] == 'res') {
                        var security = service.config.security && service.config.security[key] ? service.config.security[key] : {};
                        var def = { name: service.config.name + "." + key, security:security, index:methods.length, desc:"", paramsDesc:{} };
                        methods.push(def);

                        //parse comments
                        var comment = scripts.match(new RegExp("//@" + key + "( )+.*[\r\n]+"));
                        if (comment && comment[0]) {
                            comment = comment[0].trim();
                            var args = comment.match(new RegExp("@[a-zA-Z0-9]+( )+[^@\r\n]+", "g"));
                            if (args && args.length > 0) {
                                def.desc = args[0].substring(args[0].indexOf(" ")).trim();
                                if (args.length > 1) {
                                    for (var i = 1; i < args.length; i++) {
                                        var argName = args[i].substring(1, args[i].indexOf(" ")).trim();
                                        var argDesc = args[i].substring(args[i].indexOf(" ")).trim();
                                        def.paramsDesc[argName] = argDesc;
                                    }
                                }
                            }
                        }
                    }
                }

                SERVICE_LIST.push({ index:SERVICE_LIST.length, group:file.replace("Service.js", ""), methods:methods });
            }
        }

        //init services
        checkFolder(PATH.join(global.APP_ROOT, "server/service"), doRegisterService);
    }
    var html = "";
    var compress = global.SETTING.compress ? global.SETTING.compress.api : false;
    try {
        html = FS.readFileSync(PATH.join(__dirname, "./__test.html"), {encoding:"utf8"});
        html = html.replace('<head>', `<head><script>window.API_COMPRESS = ${compress}</script>`);
    } catch (exp) {
        console.error(exp);
        res.writeHead(404);
        res.end();
        return;
    }
    res.end(html);
}

exports.getRouterMap = function() {
    return [
        { url: "/__apidoc", view: "__apidoc", handle: renderAPIDoc, needLogin:false },
        { url: "/__test", view: "__test", handle: renderRoot, needLogin:false }
    ];
}


