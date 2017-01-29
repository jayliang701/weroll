---
layout: guide
title: Cluster
level: 2.11
parent: guide
---

<h3>Cluster</h3>
<ul class="guide_index">
    <li><a href="#impl">实现cluster</a></li>
    <li><a href="#ws">Websocket集群</a></li>
</ul>
<br>
<h4><a name="impl">实现cluster</a></h4>
通常情况下, weroll应用程序的集群和<a href="https://nodejs.org/api/cluster.html#cluster_cluster" target="_blank">Node.js官方的做法</a>并没有区别, 例如:

```js
/* ./main.js */
var App = require("weroll/App");
var app = new App();

var Setting = global.SETTING;

app.addTask(function(cb) {
    var Model = require("weroll/model/Model");
    Model.init(Setting.model, function(err) {
        cb(err);
    });
});
app.addTask(function(cb) {
    //create and start a web application
    var webApp = require("weroll/web/WebApp").start(Setting, function(webApp) {
        /* setup Ecosystem */
        var Ecosystem = require("weroll/eco/Ecosystem");
        Ecosystem.init();
        cb();
    });
});

app.run();
```

```js
/* ./cluster.js */
const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
} else {
    //setup weroll application
    require("./server.js");
    console.log(`Worker ${process.pid} started`);
}
```

<br>
或者使用<a href="http://pm2.keymetrics.io/" target="_blank">pm2</a>实现集群, 例如:<br>

```bash
$ npm install -g pm2
$ pm2 start YOUR_APPLICATION_FOLDER/main.js -i MAX
```
<br>
<br>
<h4><a name="ws">Websocket集群</a></h4>
集群并不会影响WebApp, APIServer和Ecosystem, 多个node进程将共享它们所使用的同一个端口. 具体请参考<a href="https://nodejs.org/api/cluster.html#cluster_how_it_works" target="_blank">官方文档</a>.
<br>
因此我们的主要问题是集群对Websocket长连接的影响. Realtime 集成了 <a href="https://www.npmjs.com/package/socket.io-redis" target="_blank">socket.io-redis</a> 使得weroll应用在集群环境下依然可以正常的使用Websocket.
<br>
在集群环境下, 每一个node进程中的Realtime将使用独立的端口, 而不是共享一个端口. 下面以官方的cluster为例:
<br>

```js
/* ./main.js */
var App = require("weroll/App");
var app = new App();

var Setting = global.SETTING;

app.addTask(function(cb) {
    var Realtime = require("weroll/web/Realtime");
    var config = {
        port: 3001,
        allowGuest: true,
        shakehand: false
    };
    Realtime.createServer(config).start();
    cb();
});

app.run();
```

```js
/* ./cluster.js */
const cluster = require('cluster');
const http = require('http');
const processNum = 4;  //开启4核集群

if (cluster.isMaster) {
    // Fork workers.
    for (let i = 0; i < processNum; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
} else {
    //setup weroll application
    require("./server.js");
    console.log(`Worker ${process.pid} started`);
}
```

执行结果如下:<br>

<div class="screenshot">
<img src="/public/img/cluster_1.jpg">
</div>
<br>
Realtime的初始化参数中, 定义了port = 3001, 那么第一个进程的Realtime使用3001端口, 第二个进程的Realtime则使用3002端口, 第三个进程使用3003端口, 以此类推.
<br>
<br>
通常有两种方式供客户端使用长连接集群, 一是在连接前由服务端计算出一个负载较低的连接服务器的地址, 客户端再进行连接; 二是客户端使用域名进行websocket连接, 服务器通过Nginx等软件实现负载均衡, 也是socket.io官方推荐的一种做法. <br>
<br>
Nginx负载均衡配置示例如下:<br>

```
http {
    ...

    upstream ws_nodes {
      ip_hash;
      server 127.0.0.1:6001;
      server 127.0.0.1:6002;
      server 127.0.0.1:6003;
      server 127.0.0.1:6004;
    }

    ...

    server {
      listen 3000;
      server_name ws.yourdomain.com;
      location / {
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_pass http://ws_nodes;
      }
    }
}
```
<br>
相关文档:
<ul>
    <li><a href="http://socket.io/docs/using-multiple-nodes/" target="_blank">socket.io - Using multiple nodes</a></li>
    <li><a href="http://nginx.org/en/docs/http/load_balancing.html" target="_blank">Using nginx as HTTP load balancer</a></li>
</ul>

