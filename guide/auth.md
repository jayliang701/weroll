---
layout: guide
title: Authorization
level: 2.06
parent: guide
---

<h3>Authorization</h3>

<ul class="guide_index">
    <li><a href="#account">账户登录和管理</a></li>
    <li><a href="#sess">Session</a></li>
    <li><a href="#sess_save">创建登录会话</a></li>
    <li><a href="#sess_check">Session验证</a></li>
    <li><a href="#ac">API和View Router的权限控制</a></li>
    <li><a href="#cache">进阶技巧 - 缓存更多的用户数据</a></li>
    <li><a href="#super_ac">进阶技巧 - 高级访问控制</a></li>
    <li><a href="#custom_sess_check">进阶技巧 - 自定义Session检查</a></li>
</ul>
<br>

<h4><a name="account">账户登录和管理</a></h4>
由于数据库操作对weroll应用不是必须的，因此weroll没有集成用户账户管理功能，需要开发者根据自己需要实现维护账户数据，登录验证，和密码修改等功能。
<br>
<br>
<h4><a name="sess">Session</a></h4>
weroll内置了Session管理功能，使用 <b>weroll/model/Session</b> 对象可以对用户的登录会话进行管理和校验。<br>
weroll的Session采用的是JsonWebToken机制（简称JWT），关于JWT的机制，请阅读<a href="https://jwt.io/introduction/" target="_blank">《Introduction to JSON Web Tokens》</a>。<br>
对于WebApp的页面路由请求说，JWT令牌将存放在客户端的cookie中。 <br>
对于APIServer来说，JWT令牌可以附加在请求头或请求参数的auth属性中。<br>
<br>
<br>
启用Session:<br>

```js
/* ./server/config/%ENV%/setting.js */
module.exports ={
    ...
    session: {
            /* user access session config. enable redis first */
            secret:"your jwt secret",    //jwt secret
            storage: "mongodb",    //redis, mongodb
            onePointEnter:true,    //whether allow create session in multi client device
            cookiePath:"/",      //cookie path for client browser
            cacheExpireTime:3 * 60,     //session cache expire time, sec
            tokenExpireTime:24 * 60 * 60,  //session token expire time, sec
            cookieExpireTime:24 * 60 * 60 * 1000  //million sec
    },
    ...
}
```

<br>
其中有几个重要的参数设置：<br>
<table class="doc">
    <thead>
        <tr>
            <td>Setting</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><b>session.secret</b></td>
            <td>JsonWebToken（JWT）的密钥字符串。</td>
        </tr>
        <tr>
            <td><b>session.storage</b></td>
            <td>使用何种持久化方式存储用户session，提供redis或mongodb两种方式，默认为redis。</td>
        </tr>
        <tr>
            <td><b>session.onePointEnter</b></td>
            <td>作用是是否允许同一个用户在多个客户端创建会话，如果为true则表示不允许，最近一次用户创建会话会覆盖之前创建的会话信息，使其他客户端失去访问权限。</td>
        </tr>
        <tr>
            <td><b>session.cacheExpireTime</b></td>
            <td>表示会话数据的缓存过期时间。在weroll中，会话数据会存储到redis中，防止node进程销毁导致用户会话丢失；同时再缓存到node进程内存中，以提高Token校验的性能，cacheExpireTime 参数即表示在内存中的过期时间，内存数据过期后，weroll会从redis中读取会话数据，并再次写进内存中。</td>
        </tr>
        <tr>
            <td><b>session.tokenExpireTime</b></td>
            <td>表示会话的过期时间。</td>
        </tr>
    </tbody>
</table>
使用Session必须要配置Redis连接，请参考 <a href="http://weroll.magicfish.cn/guide/redis/" target="_blank">Guide - Redis</a>
<br>
<br>
<h4><a name="sess_save">创建登录会话</a></h4>
假设你已经实现了用户登录验证：<br>

```js
//得到了用户的id（或者_id，对于MongoDB来说）
//user --> { id:"1001", ... }
//extra --> { nickname:"Jay", gender:1, ... }   //可选
var Session = require("weroll/model/Session");

//callback
Session.getSharedInstance().save(user, extra, (err, token) => {
    if (err) return console.error(err);
    console.log(`session saved --> token: ${token}`);
});

//Promise
Session.getSharedInstance().save(user, extra).then((token) => {
    //session saved
}).catch((err) => {
    //save error
});

//async & await
async () => {
    const token = await Session.getSharedInstance().save(user, extra);
    console.log(`session saved --> token: ${token}`);
}
```

会话创建之后，开发者需要将 <b>token</b> 交给客户端。如果你使用WebApp开发网页项目，可以将令牌数据写到客户端请求的cookie里，例如：<br>

```js
//after user login
//user --> { _id:"1001", nickname:"Jay", type:100 }

const token = await Session.getSharedInstance().save(user);

const option = {
    //设置cookie的path参数
    path: Setting.session.cookiePath || "/",
    //设置cookie的过期时间
    expires: new Date(Date.now() + Setting.session.cookieExpireTime)
};
res.cookie("authorization", token, option);
//end this response
```

如果你使用APIServer，可以将令牌数据通过API响应的方式，返回给客户端，例如：<br>

```js
/* ./server/service/UserService.js */

//define "user.login" API
exports.login = async (params) => {
    //check account and password ...
    //if existed, then we get an user data
    //user --> { _id:"1001", nickname:"Jay", type:100 }
    //now we create session
    const token = await Session.getSharedInstance().save(user);
    //response token and other data to client
    return { token };
}

```

<br>
<h4><a name="sess_check">Session验证</a></h4>
客户端获得token数据后，在随后的API请求或页面访问等操作中，需要把<b>token</b>提交给服务器进行验证。weroll并不关心客户端如何存储和管理token数据，你可以存放在cookie里，或者LocalStorage里，或者是移动设备的本地文件里。<br>
<br>
对于使用WebApp来说，如果创建会话后将token写到了客户端cookie里，那么客户端并不需要做什么特别的处理，浏览器会自动在每次请求时附带cookie数据。weroll会自动从请求的cookie中获得token并进行校验。<br>
<br>
如果你使用APIServer，可以将token等数据连同API请求参数一起提交给服务器进行校验或者遵循JWT的实现标准，附加在请求头Authorization里，示例代码如下：<br>

```js
/* client side */

var params = {};
//set api name
params.method = "user.changeHead";
//set api request data
params.data = { "head":"123.jpg" };
//submit token
params.auth = "your jwt string";    // option 1

$.ajax({
    type: "post",
    url: "http://localhost:3000/api",
    headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Authorization": "your jwt string"    // option 2
    },
    data: JSON.stringify(params),
    success: function (data, status, xhr) {
        if (data.code == 1) {
            console.log('API ok: ', data);
        } else {
            console.error('API error: [' + data.code + '] - ' + data.msg);
        }
    }
});
```

<br>
<br>
<h4><a name="ac">API和View Router的权限控制</a></h4>
当你使用了 <b>weroll/model/Session</b> 管理用户会话之后，则可以给每一个API和View Router设定访问权限，例如：<br>

```js
/* ./server/service/UserService.js */
exports.config = {
    name: "user",
    enabled: true,
    security: {
        //将needLogin参数设置为true，则表示该接口需要Session校验通过才能访问
        //否则API将返回 { code:100, msg:"NO_PERMISSION" }
        "hello":{ needLogin:true, checkParams:{ name:"string" }, optionalParams:{ gender:"int" } }
    }
};

exports.hello = (params, user) =>{
    //user 对象则是 Session.save 时传递的数据
    console.log("user id: ", user.id);  //or user.userid
    //some codes ...
}


/* ./server/router/page.js */
function renderSomePage(req, res, output, user) {
    //user 对象则是 Session.save 时传递的数据
    console.log("user id: ", user.id);  //or user.userid
    //output({ ... });
}

exports.getRouterMap = function() {
    return [
        //将needLogin参数设置为true，则表示该页面需要Session校验通过才能访问，否则将自动跳到login页面
        { url: "/some_page", view: "some_page", handle: renderSomePage, needLogin:true }
    ];
}
```

<br>
<br>
<h3>进阶技巧</h3>
<h4><a name="cache">缓存更多的用户数据</a></h4>
假设API或View Router的业务逻辑，经常需要使用用户的某些数据，而又不会经常发生变化的，例如昵称，性别，头像等。可以利用创建会话 Session.save() 将这些数据和token缓存在一起，这样可以大量减少数据库查询和相关代码。实例如下：<br>

```js
/* Session.save */
//query from Database: userData --> { _id:"1001", nickname:"Jay", head:"123.jpg", arg1:{...}, type:100 }
const Session = require("weroll/model/Session");

const user = { userid:userData._id, type:userData.type };
const extra = { nickname: userData.nickname, head: userData.head, key1:userData.arg1 };

//callback
Session.getSharedInstance().save(user, extra);

/////////////////////////////////////////////////////////////

/* ./server/router/page.js */
function renderSomePage(req, res, output, user) {
    console.log("user id: ", user.id);  //or user.userid
    //use extra to get more properties of user
    console.log("user nickname: ", user.nickname);
    console.log("user head: ", user.head);
    console.log("user arg1: ", user.key1);
    //output({ ... });
}
```
<br>
<br>
<h4><a name="super_ac">高级访问控制</a></h4>
在某些业务场景下，仅仅依据用户是否登录来决定访问权限是不足以满足业务需求的，例如VIP用户才可以访问某些页面，或者只有高级管理员才能执行某些删除和修改操作，因此我们需要根据用户的类型做更精细的访问控制。<br>
在weroll应用中，开发者可以在API和View Router配置中使用allow参数，定义更精细的权限控制。实例如下：

```js
/* ./server/service/UserService.js */
exports.config = {
    name: "user",
    enabled: true,
    security: {
        //将needLogin参数设置为true，则表示该接口需要Session校验通过才能访问
        //设置allow参数，表示只有user.type = 1或2 的用户才能使用此接口
        //否则API将返回 { code:100, msg:"NO_PERMISSION" }
        "hello":{ needLogin:true, allow:[ [ "type",[1,2] ] ] }
    }
};
```

当客户端请求使用 user.hello 接口时，weroll会先检查Session，然后再检查allow参数（如果存在的话），当两者都通过时才进入业务逻辑代码。<br>
allow 参数是数组结构，因此允许开发者定义多个检查项，weroll会按照顺序逐一执行，一旦检查失败则中断退出，例如：

```
allow:[ [ "type",[1,2] ], [ "check-1",[ array args... ] ], [ "check-2",{ hash args... } ] ]
```

type 是weroll自带的一个过滤器，weroll允许开发者自定义过滤器。假设这样的业务场景：某些页面只允许VIP等级大于等于3级的会员用户访问，我们可以这样做：<br>
配置View Router的allow参数：

```js
/* ./server/router/vip_page.js */
function renderVIP_Page(req, res, output, user) {
    //vip user can access
    //output({ ... });
}

function renderVIP_3_Page(req, res, output, user) {
    //vip user (level >= 3) can access
    //output({ ... });
}

exports.getRouterMap = function() {
    return [
        { url: "/vip_page", view: "vip_page", handle: renderVIP_Page, needLogin:true,
          //use 'custom' checker, vip level must >= 1
          allow:[ [ "custom",{ vipLevel:" >= 1" } ] ]
        },
        { url: "/vip_3_page", view: "vip_3_page", handle: renderVIP_3_Page, needLogin:true,
          //use 'custom' checker, vip level must >= 3
          allow:[ [ "custom",{ vipLevel:" >= 3" } ] ]
        }
    ];
}
```

使用 <b>AuthorityChecker</b> 对象注册自定义检查器：

```js
/* somewhere */
const AuthorityChecker = require("weroll/utils/AuthorityChecker");

//define check function
const vipLevelCheck = function(user, allow, callBack) {
    //allow --> { vipLevel:"..." }

    /* Async check:
       //you can query vipLevel data of user from Database or somewhere
        User.findOne({ _id:user.id }, { vipLevel:1 }, function(err, doc) {
            user.vipLevel = doc.get("vipLevel");
            var result = eval(user.vipLevel + allow.vipLevel);
            callBack(result);
        });
    */

    /* Sync check */
    //eval("user.vipLevel >= N")
    const result = eval(user.vipLevel + allow.vipLevel);
    //must execute callBack(true or false) to end this check
    callBack(result);
}

//register as name "custom"
AuthorityChecker.register("custom", vipLevelCheck);
```

检查器中的user参数时 <b>Session.getSharedInstance().save(user, extra)</b> 时的用户数据，你可以把经常需要用来做权限检查的数据，在save是存放在 <b>extra</b> 对象中，以减少访问数据库的次数。
<br><br>
现在当用户访问 vip_page 和 vip_3_page 这2个页面时，就会对用户的vipLevel值进行检查。检查失败和登录检查失败一样，请求将被重定向到login页面；如果是API，检查失败则会返回 NO_PERMISSION 错误。
<br>


<br>
<br>
<h4><a name="custom_sess_check">自定义Session检查</a></h4>
weroll允许开发者完全定义Session检查，只需要重写 <b>WebApp</b> 或 <b>APIServer</b> 的 <b>handleUserSession()</b> 方法。<br>
例如，我们改用MongoDB数据库来读写会话数据，示例代码如下：<br>

```js
//user login successfully
//user --> { _id:"1001", nickname:"Jay", type:100 }
const Model = require("weroll/model/Model");
const Utils = require("weroll/utils/Utils");

const token = Utils.randomString(16);
const now = Date.now();
//upsert a session data into "__session" table of MongoDB
Model.DB.update("__session", { _id:user._id, token:token, tokentimestamp:now }, { upsert:true });
```
<br>
在 ./server 目录下新建 <b>WebAppExt.js</b> 用来扩展 WebApp 或 APIServer：

```js
/* ./server/WebAppExt.js */
var Session = require("weroll/model/Session");

exports.extend = function(webApp) {
    //override "handleUserSession" method
    webApp.handleUserSession = (req, res, token) => {
        return new Promise(resolve => {
            const user = { isLogined:false };
            //find session data from MongoDB
            Model.DB.findOne("__session", { _id:auth.userid, token:token }, (err, doc) => {
                if (err) return error(err, user);
                if (doc) {
                    //session passed
                    user.isLogined = true;
                    user.id = doc._id;
                }
                resolve(user);
            });
        });
    };
}
```

```js
/* ./main.js */
//create and start a web application
const webApp = require("weroll/web/WebApp").start(Setting, function(instance) {
    //do something after HTTP service initialized.
    cb();
});
//extend WebApp
require("./server/WebAppExt").extend(webApp);
```


