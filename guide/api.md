---
layout: guide
title: API
level: 2.2
parent: guide
---

<h3>API</h3>
<h4>API的规则</h4>
weroll的API统一使用 <b>[POST] http://域名/api</b> 作为入口，请求和响应数据使用json格式
<br>
<br>
一个典型的weroll的API是这样的：
<pre><code class="javascript"><b>- General -</b>
<b>Request URL:</b> http://localhost:3000/api
<b>Request Method:</b> POST<br>
<b>- Request Header -</b>
<b>Content-Type:</b> application/json; charset=UTF-8<br>
<b>- Request Payload / Post Data -</b>
{ "method":"user.hello","data":{"name":"Jay","gender":"1"} }
// method 表示接口名称, data 表示请求参数<br>
<b>- Response Header -</b>
<b>Content-Type:</b> application/json<br>
<b>- Response Data -</b>
{"code":1,"data":{"a":1, "b":2},"msg":"OK"}
// code 表示错误码, 1表示正确, data 表示响应的结果数据, msg 表示消息, 当 code > 1 时则是错误的具体描述
</code></pre>
<br>
<h4>创建你自己的API</h4>
在 server/service目录中，新建一个脚本文件，比如UserService.js。Service文件必须在server/service目录或其子目录中，weroll在启动时会自动遍历里面的所有js文件，注册API。以下是一个典型的Service代码
<pre><code class="javascript">//./server/service/UserService.js
//配置这组API的前缀名和各个接口的参数定义
exports.config = {
    name: "user", //定义这组api的前缀名为user
    enabled: true,
    security: {
        //按照以下注释的写法，API调试工具可以自动识别这些说明并在工具中显示出来
        //@hello 打个招呼 @name 名字 @gender 性别,1-男,2-女
        "hello":{ needLogin:false, checkParams:{ name:"string" }, optionalParams:{ gender:"int" } },
        //@bye 说再见 @name 名字
        "bye":{ needLogin:false, optionalParams:{ name:"string" } }
    }
};<br>
exports.hello = function(req, res, params) {
    var name = params.name;
    var gender = params.gender;
    res.sayOK({ msg:&#96;欢迎, 你的名字是${name}, 性别是${gender == 1 ? "男" : "女"}&#96; });
}<br>
exports.bye = function(req, res, params) {
    var name = params.name || "陌生人";
    res.sayOK({ msg:&#96;再见, ${name}&#96; });
}</code></pre>

通过以上代码，我们定义了一组前缀为<b>user</b>的接口，并创建了2个具体的方法 <b>user.hello</b> 和<b>user.bye</b><br>
现在启动程序，在浏览器中打开以下页面使用API调试工具进行测试<br>
<pre><code class="css">http://localhost:3000/__test</code></pre>
这是weroll自带的API调试工具，你可以使用这个工具调试进行API接口调试，它会自动解析出所有定义在service目录下的API接口，并识别其中的注释，将其变成API接口描述和参数的说明。<br>
<div class="screenshot">![screenshot_1](/public/img/screenshot_1.jpg)</div>
<br>
当然你也可以使用PostMan一类的工具进行调试。
<br>
<br>

<h4>API中的 req 对象</h4>
如果你使用的是WebApp类建立http服务，req对象则是Express框架中的Request对象，请参考Express的官方文档中的<a href="http://expressjs.com/en/4x/api.html#req" target="_blank">Request说明</a>。
<br>
如果你使用的是APIServer类建立http服务，req对象则是原生http库中的request对象，请参考<a href="https://nodejs.org/api/http.html#http_class_http_clientrequest" target="_blank">Node.js官方文档</a>。
<br>
<br>
weroll对req对象添加了一些新的属性和方法，以便我们更有效率的开发<br>
<table>
    <thead>
        <tr>
            <td style="width:140px;">Property</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>req.&#95;clientIP</td>
            <td style="text-align:left;">客户端的IP地址</td>
        </tr>
        <tr>
            <td>req.&#95;identifyID</td>
            <td style="text-align:left;">客户端的uuid，由weroll在客户端第一次请求时生成，可用于统计在线用户数等业务场景，请参考<a href="https://github.com/jayliang701/weroll/blob/master/web/WebRequestPreprocess.js#L153" target="_blank">源代码</a></td>
        </tr>
    </tbody>
</table>
<br>
<table>
    <thead>
        <tr>
            <td style="width:140px;">Method</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>req.callAPI()</td>
            <td style="text-align:left;">调用其他的API方法，如 req.callAPI("user.hello", { name:"Jay" }, session, callBack)。这样我们就可以在任何一个路由或者任何一个API代码段中，调用任何一个API，使API得到重复利用。</td>
        </tr>
    </tbody>
</table>


<br>
<h4>API中的 res 对象</h4>
如果你使用的是WebApp类建立http服务，res对象则是Express框架中的Response对象，请参考Express的官方文档中的<a href="http://expressjs.com/en/4x/api.html#res" target="_blank">Response说明</a>。
<br>
如果你使用的是APIServer类建立http服务，res对象则是原生http库中的response对象，请参考<a href="https://nodejs.org/api/http.html#http_class_http_serverresponse" target="_blank">Node.js官方文档</a>。
<br>
<br>
同样，weroll也对res对象添加了一些新的方法<br>
<table>
    <thead>
        <tr>
            <td style="width:140px;">Method</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>res.sayOK()</td>
            <td style="text-align:left;">响应正确结果给客户端，使用json对象作为参数，如果不写参数，则客户端会得到: <br><pre><code class="json">{ code:1, data:{ flag:1 }, msg:"OK" }</code></pre></td>
        </tr>
        <tr>
            <td>res.sayError()</td>
            <td style="text-align:left;">响应错误结果给客户端，可使用Error对象，String对象或者[ code, msg ]作为参数<br><pre><code class="javascript">//Example
res.sayError(new Error("ops"));
res.sayError("ops");
res.sayError(100, "ops");
res.sayError(Error.create(100, "ops"));</code></pre></td>
        </tr>
        <tr>
            <td>res.done()</td>
            <td style="text-align:left;">响应结果给客户端<br><pre><code class="javascript">//Example
res.done(err, result);</code></pre>如果err存在，则执行res.sayError(err)，否则将执行res.sayOK(result)</td>
        </tr>
        <tr>
            <td>res.exec()</td>
            <td style="text-align:left;">执行一个数组任务队列，然后将结果响应给客户端。使用数组对象作为参数，请参考<a href="http://caolan.github.io/async/docs.html#waterfall" target="_blank">async库中的waterfall方法</a><br><pre><code class="javascript">//Example
var q = [];
q.push(function(callback) {
    User.findOne({ username:"jayliang" }, function(err, doc) {
        callback(err, doc);
    });
});
q.push(function(user, callback) {
    //do some async/sync works whatever you like
    console.log("found user: ", user.name);
    callback(null, user);
});
res.exec(q);</code></pre>
res.exec相当于执行了async.waterfall方法，如果队列中的任意一个callback传递了存在的err对象，则队列中断，执行res.sayError(err) 将错误响应给客户端，否则将依次执行队列中的代码段，最后执行res.sayOK</td>
        </tr>
    </tbody>
</table>

<br>
