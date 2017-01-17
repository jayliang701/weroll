---
layout: guide
title: Guide
level: 1,
key: guide
---

<h3>Guide</h3>
weroll并不是严格意义上的框架，而是一套web应用开发的工具集。对于weroll来说，数据库连接操作，页面程序和API定义都是可选的，我们可以根据实际需求选择性的使用weroll的功能。
<br>
<br>
<h4>一个典型的web应用程序骨架如下：</h4>
<pre><code class="html">+ 项目目录
    └ <i style="color:#999;">node_modules
        └ weroll</i>
    └ client --------------- web前端
        └ res ---------------- 静态资源目录，如js/css/img
        └ views ----------------- html页面
            └ template --------------- 父模板
    └ server --------------- 数据&逻辑&服务
        └ config ----------------- 环境配置文件
            └ localdev --------------- 本地开发环境的配置
                cache.config ------------ 缓存配置
                setting.js ----------- 全局配置
            └ test
            └ prod
        └ router ----------------- 页面路由
        └ service ------------------- API定义
    main.js ------------------ 入口
    package.json</code></pre>

<br>
如果搭建API服务器，不需要页面渲染，可以不需要client目录
<h4>一个典型的API应用程序骨架如下：</h4>
<pre><code class="html">+ 项目目录
    └ <i style="color:#999;">node_modules
        └ weroll</i>
    └ server --------------- 数据&逻辑&服务
        └ config ----------------- 环境配置文件
        └ service ------------------- API定义
    main.js ------------------ 入口
    package.json</code></pre>
如果你需要使用API调试工具，请保留 ./client/views/__test.html 文件。
<br>
<br>
<h4>入口程序</h4>
使用weroll，首先要配置./server/config/%ENV%/setting.js，接着在入口文件中创建 weroll/App 实例：

``````js
/* ./server/config/localdev/setting.js
    module.exports = {
        host: "localhost",
        port: 3000,
        model: {...}
        ...
    }
*/

/* main.js */
var App = require("weroll/App");
var app = new App();

console.log("env: ", global.VARS.env);  //echo "localdev"

//App实例创建之后，即可通过 global.STTING 对象直接引用setting.js文件里的配置数据
var Setting = global.SETTING;
console.log("host: ", Setting.host);   //echo "localhost"
console.log("port: ", Setting.port);   //echo "3000"
console.log("db config: ", Setting.model.db);

//the following task will be executed one by one.
app.addTask(function(cb) {
    //define some initialize works
    //e.g: setup MongoDB and Redis connection
    cb();
});
app.addTask(function(cb) {
    //define more initialize works
    //e.g: setup WebApp
    cb();
});

//start above initialize works
app.run();
```