---
layout: guide
title: HTTP
level: 2.01
parent: guide
---

<h3>HTTP</h3>
<ul class="guide_index">
    <li><a href="#about">关于WebApp和APIServer</a></li>
    <li><a href="#config">配置IP和端口</a></li>
</ul>
<br>
<h4><a name="about">关于WebApp和APIServer</a></h4>
weroll提供了WebApp和APIServer实现http服务。WebApp是对Express 4.X的封装，APIServer则是基于原生http库开发的极简http服务，仅支持API开发，不提供页面渲染。
<br>
以下是2者的详细区别说明
<table class="doc">
    <thead>
        <tr>
            <td style="width:155px;"></td>
            <td>WebApp</td>
            <td>APIServer</td>
            <td></td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>View Render</td>
            <td class="yes">Yes</td>
            <td class="no">No</td>
            <td>APIServer only support __test page</td>
        </tr>
        <tr>
            <td>Custom Router</td>
            <td class="yes">Yes</td>
            <td class="yes">Yes</td>
            <td></td>
        </tr>
        <tr>
            <td>API</td>
            <td class="yes">Yes</td>
            <td class="yes">Yes</td>
            <td>APIServer faster 30-40%</td>
        </tr>
        <tr>
            <td>User Session</td>
            <td class="yes">Yes</td>
            <td class="yes">Yes</td>
            <td></td>
        </tr>
        <tr>
            <td>MongoDB</td>
            <td class="yes">Yes</td>
            <td class="yes">Yes</td>
            <td></td>
        </tr>
        <tr>
            <td>Redis</td>
            <td class="yes">Yes</td>
            <td class="yes">Yes</td>
            <td></td>
        </tr>
        <tr>
            <td>Cache</td>
            <td class="yes">Yes</td>
            <td class="yes">Yes</td>
            <td></td>
        </tr>
        <tr>
            <td>Multi Instances</td>
            <td class="yes">Yes</td>
            <td class="yes">Yes</td>
            <td></td>
        </tr>
    </tbody>
</table>


APIServer的API并发处理性能比WebApp (实际上就是Express) 高30-40%，因此在开发时请根据你的业务需求选择使用APIServer还是WebApp，如果像微服务这样的应用或者移动应用服务，建议使用APIServer以获得更好的性能。
<br>
在应用中你可以创建多个APIServer实例，但需要侦听不同的端口。
<br>
<br>
WebApp使用示例：<br>
<pre><code class="javascript">// ./main.js 中的代码片段
var webApp = require("weroll/web/WebApp").start(Setting, function(webApp) {
    //do something after server is setup
});</code></pre>
<br>
APIServer使用示例：<br>
<pre><code class="javascript">// ./main.js 中的代码片段
var webApp = require("weroll/web/APIServer").createServer();
webApp.start(Setting, function(webApp) {
    //do something after server is setup
});</code></pre>
<br>
<br>
<h4><a name="config">配置IP和端口</a></h4>
HTTP服务的IP和端口在 ./server/config/%ENV%/setting.js 中进行配置：<br>
<pre><code class="javascript">module.exports = {
    ...
    host:"0.0.0.0",  //default is "127.0.0.1"
    port:3000,
    ...
}
</code></pre>
<br>
一个完整的HTTP服务创建的示例代码如下：<br>
<pre><code class="javascript">// ./main.js
var App = require("weroll/App");
var app = new App();
//get the whole setting object which defined in setting.js
var Setting = global.SETTING;
app.addTask(function(cb) {
    var Model = require("weroll/model/Model");
    Model.init(Setting.model, function(err) {
        cb(err);
    });
});
app.addTask(function(cb) {
    //create and start a web application using WebApp Class
    require("weroll/web/WebApp").start(Setting, function(webApp) {
        cb();
    });
});
/* use APIServer
app.addTask(function(cb) {
    //create and start a web application using APIServer Class
    var webApp = require("weroll/web/APIServer").createServer();
    webApp.start(Setting, function(webApp) {
        cb();
    });
});
*/
app.run();
</code></pre>
