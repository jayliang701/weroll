---
layout: guide
title: Websocket
level: 2.10
parent: guide
---

<h3>Websocket</h3>
<ul class="guide_index">
    <li><a href="#rt">Realtime</a></li>
    <li><a href="#auth">握手和权限</a></li>
    <li><a href="#how">常见业务场景和示例代码</a></li>
</ul>
<br>
<h4><a name="rt">Realtime</a></h4>
weroll 封装了 <a href="http://socket.io/docs/" target="_blank">socket.io</a> 库来实现Websocket长连接, 使用 <b>weroll/web/Realtime</b> 可以轻松实现基于Websocket的实时数据通讯. <br>
Realtime 的基本使用方法如下:<br>

```js
var Realtime = require("weroll/web/Realtime");

/* 创建Realtime实例, 建立Websocket服务 */
var config = {
     port: 3001,
     debug:true,
     allowGuest:true,
     shakehand:false,
     /* shakehandTimeout:5000, */
     /* enable cluster
     cluster:{
         enable:true,
         redis:{ host:"127.0.0.1", port:6379 }
     }
     */
};
Realtime.createServer(config).start();


/* 侦听客户端连接成功 */
Realtime.on("connection", function(socket) {
    socket.on("hello", function(data) {
        console.log('receive "hello" message from client: ', data);
        socket.emit("bye", { "msg":"game over" });
    });
});
```

客户端可以使用 <a href="https://github.com/socketio/socket.io-client" target="_blank">socket.io-client</a> 进行连接, 详细请看官方文档.
<br>

Realtime配置参数详细说明如下:<br>
<table class="doc">
    <thead>
        <tr>
            <td>Option</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><b>port</b></td>
            <td>端口号</td>
        </tr>
        <tr>
            <td><b>debug</b></td>
            <td>是否开启debug模式, 开启后可以看到Realtime的log. 如果不设置, 则使用<b>global.VARS.debug</b>. </td>
        </tr>
        <tr>
            <td><b>allowGuest</b></td>
            <td>是否允许游客匿名连接, true表示连接需要进过服务器握手和权限验证。默认是false</td>
        </tr>
        <tr>
            <td><b>shakehand</b></td>
            <td>是否需要握手, true表示客户端在连接后需要发送握手请求。默认是false</td>
        </tr>
        <tr>
            <td><b>shakehandTimeout</b></td>
            <td>设置握手超时时间, 默认是15秒, 意思是如果客户端在连接后超过指定时间没有完成握手, 服务器将自动断开连接</td>
        </tr>
        <tr>
            <td><b>cluster</b></td>
            <td>集群配置:
                <pre><code class="json">cluster:{
     enable:true,
     redis:{ host:"127.0.0.1", port:6379 }
 }</code></pre>
                enable - 是否开启集群<br>
                redis - 配置集群连接的Redis服务
            </td>
        </tr>
    </tbody>
</table>

<br>

Realtime事件列表如下:<br>
<table class="doc">
    <thead>
        <tr>
            <td>Event</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><b>start</b></td>
            <td>当start方法执行时抛出该事件, 侦听函数将得到require("socket.io")()返回的对象.</td>
        </tr>
        <tr>
            <td><b>connection</b></td>
            <td>当与客户端建立连接时, 侦听函数将得到客户端连接socket对象, 请参考<a href="https://github.com/socketio/socket.io-client/blob/master/docs/API.md#socket" target="_blank">官方文档</a>.</td>
        </tr>
        <tr>
            <td><b>disconnect</b></td>
            <td>当与客户端连接断开时, 得到客户端连接socket对象.</td>
        </tr>
        <tr>
            <td><b>shakeHandStart</b></td>
            <td>当接到客户端握手请求时, 得到客户端连接socket对象.</td>
        </tr>
        <tr>
            <td><b>shakeHandComplete</b></td>
            <td>当客户端握手请求完成处理时, 得到客户端连接socket对象和握手是否成功的布尔值:
            <pre><code class="javascript">Realtime.on("shakeHandComplete", (socket, result)=>{
    console.log(result); //echo true or false
})</code></pre>
            </td>
        </tr>
        <tr>
            <td><b>shakeHandSuccess</b></td>
            <td>当成功与客户端握手时, 得到客户端连接socket对象. <br>注意: 即使连接配置中shakehand设置为false, shakeHandSuccess事件也一样会触发. </td>
        </tr>
        <tr>
            <td><b>shakeHandFail</b></td>
            <td>当客户端握手失败或错误时, 得到客户端连接socket对象.</td>
        </tr>
    </tbody>
</table>

<br>
<br>
<h4><a name="auth">握手和权限</a></h4>
通常情况下, 我们希望客户端需要经过授权才能连接Websocket, Realtime和WebApp及APIServer一样, 默认使用<b>weroll/model/Session</b>进行权限验证. Realtime通过握手请求进行权限验证, 握手成功之后, 客户端则可以继续使用连接, 否则服务器将强行断开连接.<br>
<br>
Realtime的握手请求需要客户端在连接之后, 发送$init消息, 并附带userid, token和tokentimestamp数据(请参考<a href="/guide/auth#sess" target="_blank">Authorization文档</a>), 示例代码如下:<br>

```html
/* client side */
<script type="text/javascript" src="js/socket.io.min.js"></script>
<script>
var sess = { userid:USER_ID, token:TOKEN, tokentimestamp:TOKEN_TIMESTAMP };

var socket = io("http://localhost:3001");
socket.on("connect", function() {
    console.log('connected to ' + url);
    console.log('start shakehand with session: ', sess);
    //发送握手请求
    socket.emit('$init', { _sess:sess });
});
//侦听握手请求处理结果
socket.on("$init", function(data) {
    //握手成功
    //data = { clientID:客户端连接的UUID }
    socket.clientID = data.clientID;
    console.log('shakehand success. clientID: ' + socket.clientID);
});
socket.on("disconnect", function() {
    //如果握手失败或超过指定时间没有进行握手, 连接将被强行断开
    socket.clientID = undefined;
    console.log('disconnected');
});
</script>
```

握手成功之后, 服务器会返回$init消息, 并得到clientID. <b>clientID</b>是客户端连接的UUID, 如果服务端不需要权限验证, 在握手之后, clientID等于socket.id; 如果需要权限验证, 握手之后, clientID等于用户的userid.<br>
<br>
如果服务端设置allowGuest = false, shakehand = false, 则客户端连接后不需要发送$init消息进行握手, 但是服务端依然会推送$init消息给客户端.
<br>
<br>
<h4><a name="how">常见业务场景和示例代码</a></h4>
Realtime初始化时, 会得到一个<a href="https://github.com/jayliang701/weroll/blob/master/net/Websocket.js" target="_blank">weroll/net/Websocket</a>对象的实例, 默认会将此实例注册到全局环境中, 因此在使用Realtime时, 不需要再用require进行导入.
<br>
如果你需要在一个项目中建立多个Websocket服务器, 可以自行维护Websocket对象池.
<br>

```js
var Websocket = require("weroll/net/Websocket");
var Realtime = require("weroll/web/Realtime");

//server1被注册成为全局对象
var server1 = Realtime.createServer({ port:3001 });
//server1 is an instance of weroll/net/Websocket
server1.start();

console.log(server1 instanceof Websocket);          //echo true
console.log(global.Realtime instanceof Websocket);  //echo true
console.log(server1 === global.Realtime);           //echo true

//设置第二个参数为true, 不让它注册成为全局对象
var server2 = Realtime.createServer({ port:3002 }, true);
//server2 is an instance of weroll/net/Websocket
server2.start();
```

```js
/* somewhere */
//直接使用Realtime, 不需要require导入
Realtime.on("connection", function(socket) {
    //your codes
});
```

<br>
一些常见的业务场景和示例代码:<br>

```js
/* 侦听客户端连接和客户端消息 */
Realtime.on("shakehandSuccess", function(socket) {
    //侦听客户端发送的hello类型的消息
    socket.on("hello", function(data) {
        console.log('receive "hello" message from client: ', data);
        //给客户端发送消息
        socket.emit("bye", { "msg":"game over" });
    });
});


/* 更简洁的消息处理方式 */
/* client side */
io.emit("m", [ "hello", { name:"Jay" } ]);

/* server side */
Realtime.on("hello", function(socket, data) {
    console.log('receive "hello" message from client: ', data);
});


/* socket.helper对象 */
/* 加入房间 */
//callback
socket.helper.enterRoom(roomID, function(err) {
    err && console.error(err);
});

//promise
socket.helper.enterRoom(roomID).then(function() {
    //do something after enter room
}).catch(function(err) {
    err && console.error(err);
});

//async & await
async function() {
    await socket.helper.enterRoom(roomID);
}

/* 离开房间 */
socket.helper.leaveRoom(roomID);

/* 在房间中广播消息 */
socket.helper.broadcastToRoom(roomID, event, data);

/* 在房间中广播消息, 但不发送给socket本身 */
socket.helper.broadcastToRoomWithoutSender(roomID, event, data);

/* 广播消息给所有人 */
socket.helper.broadcast(event, data);

/* 广播消息给所有人, 除了socket本身 */
socket.helper.broadcastWithoutSender(event, data);

/* 给某个客户端发送消息 */
//如果同一个用户在多个客户端设备进行连接, 则此消息会发送给此用户的所有连接客户端
socket.helper.sendTo(clientID, event, data);
```


