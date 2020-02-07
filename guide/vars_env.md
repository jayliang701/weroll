---
layout: guide
title: Vars & Env
level: 2.00
parent: guide
---

<h3>Vars & Env</h3>
<ul class="guide_index">
    <li><a href="#vars">global.VARS</a></li>
    <li><a href="#env">切换运行环境</a></li>
</ul>
<br>
<h4><a name="vars">global.VARS</a></h4>
某些业务场景下，我们需要在启动node进程时传递一些变量，通常我们会这么做，如：

``````js
$ node main.js var1 var2 var3
```

在weroll应用中，使用以下的规则传递参数：

```js
$ node main.js -var1=xxx -var2=yyy -var3
```

在weroll/App实例创建之后，即可使用 <b>global.VARS</b> 对象引用这些变量：

```js
var App = require("weroll/App");
var app = new App();

console.log("var1: ", global.VARS.var1);  //echo "xxx"
console.log("var2: ", global.VARS.var2);  //echo "yyy"
console.log("var3: ", global.VARS.var3);  //echo true
```

需要注意的是，weroll会使用 <b>env</b> 和 <b>debug</b> 这2个变量名，请注意不要占用：

```js
/* node main.js */
//env默认值是localdev，即使不设定env参数，也global.VARS.env也会有默认值
console.log("env: ", global.VARS.env);  //echo "localdev"

//debug默认值是undefined
console.log("debug: ", global.VARS.debug);  //echo undefined

/* node main.js -env=test -debug */
console.log("env: ", global.VARS.env);  //echo "test"
console.log("debug: ", global.VARS.debug);  //echo true
```

weroll自带的<b>API调试工具</b>只有在 <b>global.VARS.debug == true</b> 的条件下才会开启，切换到生产环境时请<b>不要设置-debug</b>运行参数。

<br>
<h4><a name="env">切换运行环境</a></h4>
weroll项目中，在 ./server/config 目录下存在一个setting.js文件，这是项目变量配置。config目录下还可能有类似localdev，test，prod等目录，不同的环境变量就配置在不同的目录下，每个环境都有一个setting.js，该setting.js文件的变量配置会将config/setting.js中的配置覆盖。因此我们可以将和运行环境无关的变量或默认变量放在config/setting.js中，将特定环境中的变量写到 config/xxx/setting.js 中。<br><br>
weroll就是通过 <b>global.VARS.env</b> 变量来决定应用使用哪一个setting.js，默认环境是 <b>localdev</b>，开发者可根据实际需要创建其他的环境，例如：

```js
//switch to test
/* node main.js -env=test -debug */
console.log("env: ", global.VARS.env);  //echo "localdev"
//加载 ./server/config/test/setting.js 文件
var testSetting = global.SETTING;
console.log("[test] port: ", testSetting.port);

//switch to your_env
/* node main.js -env=your_env */
console.log("env: ", global.VARS.env);  //echo "your_env"
//加载 ./server/config/your_env/setting.js 文件
var yourSetting = global.SETTING;
console.log("[your_env] port: ", yourSetting.port);
```

我们建议将全局配置参数设定在setting.js中，如数据库连接，静态资源CDN地址等，这样可以更好的管理及切换开发环境和生产环境。<br>

