---
layout: guide
title: Redis
level: 2.5
parent: guide
---

<h3>Redis</h3>
<h4>连接配置</h4>
在./server/config/%ENV%/setting.js里，model.redis节点配置了Redis的连接设置：
<pre><code class="javascript">model: {
    //mongodb connection config
    db: { ... },
    //redis connection config
    redis: {
        host:"127.0.0.1",
        port:6379,
        //prefix defines the prefix string of redis key
        prefix:{
            "*": "weroll_app_",      //default prefix
            common: "weroll_common_"     //another prefix
        },
        ttl:24 * 60 * 60,  //sec,
        pass:"123456",   //password for redis connection
        maxLockTime:2 * 60,  //sec
        releaseLockWhenStart: true
    }
}</code></pre>
对于weroll应用来说，Redis连接并不是必须的，如果你不需要连接Redis，可以将model.redis节点注释。<br>
weroll使用的是<a href="https://www.npmjs.com/package/redis" target="_blank">redis</a>库连接和操作Redis：<br>
<pre><code class="html">npm主页：<a href="https://www.npmjs.com/package/redis" target="&#95;blank">https://www.npmjs.com/package/redis</a></code></pre>
<pre><code class="html">github主页：<a href="https://github.com/NodeRedis/node_redis" target="&#95;blank">https://github.com/NodeRedis/node_redis</a></code></pre>
<pre><code class="html">Redis命令参考：<a href="http://redisdoc.com/" target="&#95;blank">http://redisdoc.com/</a></code></pre>
<br>
<br>
<h4>Redis连接</h4>
在weroll应用中，通常使用Model对象进行MongoDB和Redis连接，示例代码如下：<br>
<pre><code class="javascript">// ./main.js
var App = require("weroll/App");
var app = new App();
var Setting = global.SETTING;<br>
app.addTask(function(cb) {
    var Model = require("weroll/model/Model");
    Model.init(Setting.model, function(err) {
        if (!err) {
            //now, mongodb & redis connection are both setup.
        }
        cb(err);
    });
});<br>
//more init codes...<br>
app.run();
</code></pre>
<br>
<br>
<h4>Redis命令</h4>
weroll对redis库进行了简单的封装了，你可以使用 weroll/model/Redis 对象进行操作：<br>
<pre><code class="javascript">var Redis = require("weroll/model/Redis");<br>
//callback
Redis.set("name", "Jay", function(err, res) {
    console.log(arguments);
});<br>
//promise
Redis.set("name", "Jay").then(function(res) {
    console.log(res);   //echo "OK"
});<br>
//async & await
async function() {
    var result = await Redis.set("name", "Jay");
    console.log(result);   //echo "OK"
}</code></pre>
weroll/model/Redis 对象仅仅封装了一些常用的redis命令，如set, get, del和Hash操作等，如果你想使用更多的redis命令，可以使用Redis.do方法：<br>
<pre><code class="javascript">async function() {
    //Redis.do(COMMAND, [ key, arguments1, arguments2, ... ], [callBack]);
    var result = await Redis.do("set", [ "name", "Jay" ]);
    console.log(result);   //echo "OK"
}</code></pre><br>
<h4>Redis队列处理</h4>

