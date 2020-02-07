---
layout: guide
title: Redis
level: 2.05
parent: guide
---

<h3>Redis</h3>
<ul class="guide_index">
    <li><a href="#config">连接配置</a></li>
    <li><a href="#conn">Redis连接</a></li>
    <li><a href="#cmd">Redis命令</a></li>
    <li><a href="#tasks">Redis队列处理</a></li>
    <li><a href="#key">Redis Key 规则</a></li>
    <li><a href="#multi">创建多个Redis连接实例</a></li>
    <li><a href="#pubsub">Pub/Sub 消息发布和订阅</a></li>
</ul>
<br>
<h4><a name="config">连接配置</a></h4>
在./server/config/%ENV%/setting.js里，model.redis节点配置了Redis的连接设置：

```js
/* ./server/config/%ENV%/setting.js */
module.exports = {
    ...
    model: {
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
    },
    ...
}
```

对于weroll应用来说，Redis连接并不是必须的，如果你不需要连接Redis，可以将setting.js中的model.redis节点注释。<br>
weroll使用的是<a href="https://www.npmjs.com/package/redis" target="_blank">redis</a>库连接和操作Redis：<br>
<pre><code class="html">npm主页：<a href="https://www.npmjs.com/package/redis" target="&#95;blank">https://www.npmjs.com/package/redis</a></code></pre>
<pre><code class="html">github主页：<a href="https://github.com/NodeRedis/node_redis" target="&#95;blank">https://github.com/NodeRedis/node_redis</a></code></pre>
<pre><code class="html">Redis命令参考：<a href="http://redisdoc.com/" target="&#95;blank">http://redisdoc.com/</a></code></pre>
<br>
<br>
<h4><a name="conn">Redis连接</a></h4>
在weroll应用中，通常使用Model对象进行MongoDB和Redis连接，示例代码如下：<br>

```js
// ./main.js
const App = require("weroll/App");
const app = new App();
const Setting = global.SETTING;

app.addTask((cb) => {
    const Model = require("weroll/model/Model");
    Model.init(Setting.model, (err) => {
        if (!err) {
            //now, mongodb & redis connection are both setup.
        }
        cb(err);
    });
});

//more init codes...

app.run();
```

<br>
<br>
<h4><a name="cmd">Redis命令</a></h4>
weroll对redis库进行了简单的封装了，你可以使用 weroll/model/Redis 对象进行操作：<br>

```js
const Redis = require("weroll/model/Redis");

//callback
Redis.set("name", "Jay", (err, res) => {
    console.log(arguments);
});

//promise
Redis.set("name", "Jay").then(res => {
    console.log(res);   //echo "OK"
});

//async & await
async () => {
    const result = await Redis.set("name", "Jay");
    console.log(result);   //echo "OK"
}
```
weroll/model/Redis 对象仅仅封装了一些常用的redis命令，如set, get, del和Hash操作等，如果你想使用更多的redis命令，可以使用Redis.do方法：

```js
async () => {
    //Redis.do(COMMAND, [ key, arguments1, arguments2, ... ], [callBack]);
    const result = await Redis.do("set", [ Redis.join("name"), "Jay" ]);
    console.log(result);   //echo "OK"
}
```
<br>
<h4><a name="tasks">Redis队列处理</a></h4>
示例代码：<br>

```js
const tasks = [
  [ "set", Redis.join("name"), "JayX", (err, res) => {
      console.loe(res);   //echo "OK"
  } ],
  [ "get", Redis.join("name"), (err, res) => {
      console.loe(res);   //echo "JayX"
  } ]
];
Redis.multi(tasks, err => {
    err && console.error(err);
});
```
<br>
<h4><a name="key">Redis Key 规则</a></h4>
在weroll应用中，redis的key通常是这样的规则：<br>

```js
/** 在./server/config/%ENV%/setting.js中：
model: {
    redis: {
        ...
        prefix:{
            "*": "weroll_test_",      //default prefix
            common: "weroll_common_"     //another prefix
            site: "weroll_site_"     //another prefix
        }
    }
} */

//your code
Redis.set("name", "JayX");
//actually ---> key: "weroll_test_name",   value: "JayX"

//use 'common' prefix
Redis.set("@common->name", "JayX");
//actually ---> key: "weroll_common_name",   value: "JayX"

//use 'site' prefix
Redis.set("@site->name", "JayX");
//actually ---> key: "weroll_site_name",   value: "JayX"
```
<div class="screenshot"><img src="/public/img/screenshot_2.jpg">
<!-- ![screenshot_2](/public/img/screenshot_2.jpg) -->
</div>
<br>
对于Redis.do和Redis.multi操作，需要直接传递完整的key值，使用Redis.join可以得到完整的key值，示例代码如下：<br>

```js
const Redis = require("weroll/model/Redis");

const fullKey = Redis.join("name");
console.log(fullKey);  //echo "weroll_test_name"

Redis.do("set", [ fullKey, "Jay" ]);

const tasks = [
  [ "get", Redis.join("name"), (err, res) => {
      console.loe(res);   //echo "JayX"
  },
  [ "get", "name", (err, res) => {
      console.loe(res);   //echo undefined
  } ]
];
Redis.multi(tasks, err => {
    err && console.error(err);
});
```
<br>
<br>
<h4><a name="multi">创建多个Redis连接实例</a></h4>
使用 Redis.createClient 方法能够创建新的redis连接实例，返回<a href="https://www.npmjs.com/package/redis#rediscreateclient" target="_blank">RedisClient对象</a>，示例代码如下：<br>

```js
const Redis = require("weroll/model/Redis");

//使用新的连接配置
const client1 = Redis.createClient({ host:"127.0.0.1", port:6379, pass:"12346" });

//使用setting.js中的连接配置
const client2 = Redis.createClient();

//侦听connect事件
const client3 = Redis.createClient(null, client => {
    console.log(client3 === client);  //echo true
    //do something after connection setup
});
//Or
const client4 = Redis.createClient();
client4.on("connect", () => {
    //do something after connection setup
});
```
<br>
<br>
<h4><a name="pubsub">Pub/Sub 消息发布和订阅</a></h4>
Redis消息推送和消息接收由2个不同的reids连接实例来实现，详细请参考<a href="http://redisdoc.com/topic/pubsub.html" target="_blank">Redis命令参考-发布与订阅</a><br>
示例代码如下：<br>

```js
const Redis = require("weroll/model/Redis");
const config = { host:"127.0.0.1", port:6379, pass:"12346" };
Redis.createClient(config, (sub) => {
    sub.on("message", (channel, message) => {
        console.log(channel);   //echo "talk"
        console.log(message);   //echo "hi"
    });
    sub.subscribe("talk", (err) => {
        if (err) return console.error(err);
        Redis.publish("talk", "hi");
    });
});
```
需要注意的是，请不要使用weroll/model/Redis对象来订阅消息，请使用新的连接实例进行消息订阅。


