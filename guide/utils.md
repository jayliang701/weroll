---
layout: guide
title: Utils
level: 2.14
parent: guide
---

<h3>Utils</h3>
<ul class="guide_index">
    <li><a href="#template">内容模板</a></li>
    <li><a href="#sms">发送手机短信</a></li>
    <li><a href="#phone">手机验证码</a></li>
</ul>
<br>
<h4><a name="template">内容模板</a></h4>
有时我们需要使用一些拥有特定格式的文字内容，例如发送短信，发送邮件的时候，需要使用经过排版的文字。<b>weroll/utils/TemplateLib</b> 提供了使用文字内容模板的功能，开发者可以将文字排版后存放在单独的文件中做成模板，在使用时加载模板，并将占位符替换为实际的变量值。具体使用方法如下:
<br>
在 <b>./server/res/template</b> 目录中，创建模板分组目录，如sms和mail：
<div class="screenshot">
<img src="/public/img/template_1.jpg">
</div>

在相应的分组目录中，开发者可以创建针对某一业务需求所要使用的内容模板文件，如新用户注册的欢迎邮件，模板文件名为welcome.tpl，内容如下：

```
Welcome %name%
**********%*********
Hi %name%,<br>
Welcome to be our member!
<br>
<br>
<p style="font-size:12px; color:#666;">This email is sent by system automatically. Please do not reply it.</p>
<br>
%site%
%date%
```

模板内容由 <b>title</b> 和 <b>content</b> 两部分组成，title或content都可以为空，模板中 <b>%XXX%</b> 表示变量占位符：

```
This is title
**********%*********
This is content, %arg0%, %arg1%
```

使用 <b>TemplateLib.useTemplate</b> 加载模板文件和替换变量值：

```js
TemplateLib.useTemplate(GROUP, TEMPLATE_FILE_NAME, VARS);
```

```js
var TemplateLib = require("weroll/utils/TemplateLib");

var template = TemplateLib.useTemplate("mail", "welcome", { site:"My WebSite", name:"Jay" });
console.log(template.title);   //echo "Welcome Jay"
console.log(template.content);   //echo content...
```

如果模板内容中经常用到某一个变量值，如网站的网址，网站的名称等，可以使用 <b>TemplateLib.init()</b> 方法预先设定变量值，如：

```js
TemplateLib.init({ site:"My WebSite", siteDomain:"http://www.magicfish.cn/" });

/* ./server/res/template/mail/test.tpl
This is title
**********%*********
This is content: <a href="siteDomain" target="_blank">%site%</a>
*/

var template = TemplateLib.useTemplate("mail", "test");
console.log(template.content);
//echo 'This is content: <a href="http://www.magicfish.cn/" target="_blank">My WebSite</a>'
```

<br>
<br>
<h4><a name="sms">发送手机短信</a></h4>
使用 <b>weroll/utils/SMSUtil</b> 可以实现手机短信发送服务。开发者可以根据实际合作的短信发送服务提供商所提供的接口，自定义短信发送的业务代码。使用方法如下：

```js
var SMSUtil = require("weroll/utils/SMSUtil");

/* initialize */
var config = {
    limit: {
        duration:60 * 1000,   //对同一个手机发送短信的最小时间间隔
        maxPerDay:99          //对同一个手机一天内最多发送的短信次数
    },
    simulate:true,   //是否开启模拟发送短信, true则表示不会真的使用短信发送服务
    debug:true       //是否开启DEBUG模式，开启则会在终端打印一些日志信息，默认使用global.VARS.debug
};
SMSUtil.init(config);

/* custom SMS service */
var MyProxy = {};
MyProxy.send = function(phone, msg, option, callBack) {
    return new Promise(function(resolve, reject) {
        //your codes
        console.log("send SMS to phone: ", phone);
        if (callBack) return callBack();
        resolve();
    });
};
SMSUtil.setProxy(MyProxy);

/* send with callBack */
SMSUtil.send("18600000000", "Hi Jay, welcome to be our member!", function(err) {
    err && console.error(err);
});

/* send with promise */
SMSUtil.send("18600000000", "Hi Jay, welcome to be our member!").
then(function() {
    //send completed
}).
catch(function(err) {
    err && console.error(err);
});

/* send with async & await */
async function() {
    await SMSUtil.send("18600000000", "Hi Jay, welcome to be our member!");
}

/* enforce send */
SMSUtil.send("18600000000", "Hello again!", { enforce:true });

/* send with template*/
//使用 ./server/res/template/sms/%模板名% 模板文件作为短信内容进行发送
SMSUtil.sendWithTemplate("18600000000", "test", { name:"Jay" }, { enforce:true });
```

<br>
<br>
<h4><a name="phone">手机验证码</a></h4>
在开发互联网应用时，我们经常需要发送手机短信验证码，如新用户注册，用户找回密码等业务场景，使用 <b>weroll/utils/PhoneValidationCode</b> 可以实现手机短信验证码功能。
<br>
<b>PhoneValidationCode</b> 依赖 <b>TemplateLib</b> 和 <b>SMSUtil</b>，在使用需要先初始化这2个依赖库，示例代码如下：

```js
/* init SMSUtil */
var config = {
    limit: {
        duration:60 * 1000,   //milli sec
        maxPerDay:99
    }
};
SMSUtil.init(config);

/* custom SMS service */
var MyProxy = {};
MyProxy.send = function(phone, msg, option, callBack) {
    return new Promise(function(resolve, reject) {
        //your codes
        console.log("send SMS to phone: ", phone);
        if (callBack) return callBack();
        resolve();
    });
};
SMSUtil.setProxy(MyProxy);

/* init TemplateLib */
TemplateLib.init({ site:"My WebSite" });

/* init PhoneValidationCode */
PhoneValidationCode.init();
```

<br>
使用 <b>PhoneValidationCode.send()</b> 方法发送验证码：

```js
PhoneValidationCode.send(PHONE_NUMBER, GROUP, [OPTION], [CALLBACK]);
```


<table>
    <thead>
        <tr>
            <td>Option</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>PHONE_NUMBER</td>
            <td>发送目标的手机号码</td>
        </tr>
        <tr>
            <td>GROUP</td>
            <td>验证码类型，由开发者自由定义，如register表示用于注册的验证码，pwd表示用于找回密码。同一类型验证码将受到最小发送时间间隔的限制。</td>
        </tr>
        <tr>
            <td>OPTION</td>
            <td>可选参数<pre><code>{
    len:10, /* 验证码长度，默认是6位 */
    pattern:[ [0,9], ["A","Z"] ],   /* 验证码生成规则，这里表示用0-9A-Z随机生成，默认是纯数字 */
    template:"test",  /* 发送短信的内容模板名，默认使用validation.tpl内容模板 */
    enfore:true/false    /* 是否强制发送，强制表示无视短信发送的时间间隔和当天最大次数 */
}</code></pre></td>
        </tr>
        <tr>
            <td>CALLBACK</td>
            <td>可选，回调方法，返回err和code。code表示生成的验证码。</td>
        </tr>
    </tbody>
</table>

注意：可选参数中template默认使用 <b>validation.tpl</b> 内容模板，在使用 <b>PhoneValidationCode.send()</b> 之前请先创建内容模板，如：

```

**********%*********
validation code: %code%
```

title可为空，<b>%code%</b> 表示验证码占位符
