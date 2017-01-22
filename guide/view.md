---
layout: guide
title: View Router
level: 2.03
parent: guide
---

<h3>View Router</h3>
<ul class="guide_index">
    <li><a href="#def">定义路由</a></li>
    <li><a href="#template">视图模板引擎</a></li>
    <li><a href="#data">传递数据到页面</a></li>
    <li><a href="#filter">自定义模板引擎过滤器</a></li>
</ul>
<br>
<h4><a name="def">定义路由</a></h4>
如果要使用页面和页面路由，请使用WebApp来创建http服务，APIServer不提供页面渲染的功能。
<br>
页面路由代码需要定义在server/router目录或其子目录中，weroll启动时会自动解析并注册到Express中。一个典型的路由文件如下：
<br>
<pre><code class="javascript">//./server/router/index.js<br>
function renderIndexPage(req, res, output, user)
    //在页面中使用 {{data.msg}} 可显示hello字符串
    output({ msg:"hello!" });
}<br>
function renderProfilePage(req, res, output, user) {
    output({ nickname:user.nickname, head:user.head });
}<br>
exports.getRouterMap = function() {
    return [
        /*
            url           浏览器url中域名之后的地址
            view          对应要渲染的html页面，如index就表示 %项目目录%/client/views/index.html这个页面
            handle        http GET方式对应的处理方法
            postHandle    http POST方式对应的处理方法
            needLogin     是否需要登录才能访问 true/false
            loginPage     如果没有访问权限，可以指定一个跳转页面，默认是login页面和view一样，
                          页面定义在 %项目目录%/client/views目录或子目录中
       */
        { url: "/", view: "index", handle: renderIndexPage, needLogin:false },
        { url: "/index", view: "index", handle: renderIndexPage, needLogin:false },
        { url: "/profile", view: "profile", handle: renderProfilePage, needLogin:true, loginPage:"signin" }
    ];
}</code></pre>
<br>
<br>
<h4><a name="template">视图模板引擎</a></h4>
weroll默认使用 nunjucks 作为模板引擎，请参考<a href="https://mozilla.github.io/nunjucks/" target="_blank">nunjucks官方文档</a>。你也可以使用其他的模板引擎如jade, ejs, swig等，示例代码如下：
<pre><code class="javascript">//这是main.js中的代码片段<br>
//var Setting = global.SETTING;<br>
Setting.viewEngine = {
    //webApp: an instance of Express
    init: function(webApp, viewPath, useCache) {
        var engine = {};
        //务必要实现这个方法
        engine.$setFilter = function(key, func) {
            //do nothing
        };
        webApp.set('view engine', 'ejs');
        console.log("use view engine: ejs");
        return engine;
    }
};
//create and start a web application
var webApp = require("weroll/web/WebApp").start(Setting);</code></pre>

<br>
<h4><a name="data">传递数据到页面</a></h4>
在路由的处理方法中，使用output即可输出数据。
<pre><code class="javascript">//./server/router/index.js<br>
function renderIndexPage(req, res, output, user)
    //在页面中使用 {{data.msg}} 可显示hello字符串
    output({ msg:"hello!" });
}</code></pre>
<pre><code class="html">&lt;!-- ./client/views/index.html --&gt;<br>
&lt;div&gt;&#123;&#123;data.msg&#125;&#125;&lt;/div&gt; &lt;!-- display "hello!" --&gt;</code></pre><br>
在页面中{{data}}对象即是output传递出去的对象，weroll还封装了一些常用的数据传递到页面中。如URL的querystring数据：
<pre><code class="html">&lt;!-- ./client/views/index.html --&gt;<br>
&lt;!-- URL: http://localhost:3000/some_page?page=2&size=10 --&gt;<br>
&lt;div&gt;page: &#123;&#123;query.page&#125;&#125;&lt;/div&gt; &lt;!-- display "2" --&gt;
&lt;div&gt;size: &#123;&#123;query.size&#125;&#125;&lt;/div&gt; &lt;!-- display "10" --&gt;</code></pre>
<br>
获取服务器当前的时间戳：
<pre><code class="html">&lt;!-- ./client/views/index.html --&gt;<br>
&lt;div&gt;Server Time: &#123;&#123;now&#125;&#125;&lt;/div&gt;</code></pre>
<br>
获取./server/config/%ENV%/setting.js 里的一些配置数据，如：
<pre><code class="html">&lt;!-- ./client/views/index.html --&gt;<br>
&lt;div&gt;Site Domain: &#123;&#123;setting.SITE&#125;&#125;&lt;/div&gt;   &lt;!-- 网站域名 --&gt;
&lt;div&gt;Resource CDN: &#123;&#123;setting.RES&#95;CDN&#95;DOMAIN&#125;&#125;&lt;/div&gt;   &lt;!-- 静态资源CDN域名 --&gt;
&lt;div&gt;Site Domain: &#123;&#123;setting.API&#95;GATEWAY&#125;&#125;&lt;/div&gt;   &lt;!-- API Gateway的URL地址 --&gt;</code></pre>
你也可以自定义或者扩展setting里的数据：
<pre><code class="javascript">//./main.js<br>
require("weroll/web/WebApp").start(Setting, function(webApp) {
    webApp.COMMON&#95;RESPONSE&#95;DATA.defaultStyle = "blue";
});</code></pre>
<pre><code class="html">&lt;!-- ./client/views/index.html --&gt;<br>
&lt;link type="text/css" rel="stylesheet"
      href="&#123;&#123;setting.RES&#95;CDN&#95;DOMAIN&#125;&#125;/css/&#123;&#123;setting.defaultStyle&#125;&#125;.css" &gt;&lt;/link&gt;</code></pre>

<br>
<h4><a name="filter">自定义模板引擎过滤器</a></h4>
通过 ViewEngineFilter.addFilter() 可以添加自定义过滤器，这里以nunjucks为例：
<pre><code class="javascript">//./server/router/index.js<br>
var ViewEngineFilter = require("weroll/utils/ViewEngineFilter");<br>
//第一个参数是过滤器的名字，第二个参数是function
ViewEngineFilter.addFilter("json", json);<br>
//在页面中正确渲染json数据
function json(val, express) {
    return this.env.getFilter("safe")(JSON.stringify(val));
}<br>
//the render function of page<br>
function renderSomePage(req, res, params) {
    output({ list:[ "Jay", "Tracy" ] });
}<br></code></pre>
<pre><code class="html">&lt;!-- ./client/views/some_page.html --&gt;<br>
&lt;script&gt;
var list = &#123;&#123;data.list|json&#125;&#125;;
console.log(list[0]); //echo Jay
&lt;/script&gt;</code></pre>
<br>