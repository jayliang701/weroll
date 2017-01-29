---
layout: guide
title: weroll-cli
level: 2.20
parent: guide
---

<h3>weroll-cli</h3>
<ul class="guide_index">
    <li><a href="#what">什么是weroll-cli</a></li>
    <li><a href="#template">视图模板引擎</a></li>
    <li><a href="#data">传递数据到页面</a></li>
    <li><a href="#filter">自定义模板引擎过滤器</a></li>
</ul>
<br>
<h4><a name="what">什么是weroll-cli</a></h4>
<b>weroll-cli</b> 是一个帮助你快速生成weroll模板项目的命令行工具。
<br><br>
npm或cnpm全局安装weroll-cli
<pre class="highlight"><code style="width:100%;">$ npm install -g weroll-cli</code></pre>

weroll用法如下：
<pre class="highlight"><code style="width:100%;">$ weroll --version
$ weroll init {模板} {项目/目录名称}</code></pre>
例如在命令行当前目录下，使用mini模板创建DemoApp项目：
<pre class="highlight"><code style="width:100%;">$ weroll init mini DemoApp</code></pre>
如果你需要使用cnpm，可以在命令后面加上 --cnpm 参数
<pre class="highlight"><code style="width:100%;">$ weroll init mini DemoApp --cnpm</code></pre>
如果你已经建立了项目目录，如WebApp，可以进入该目录后再执行weroll init：
<pre class="highlight"><code style="width:100%;">$ cd WebApp
$ weroll init mini</code></pre>

<br>
目前可创建的模板项目有：
<br>
<table class="doc">
    <thead>
        <tr>
            <td>Template</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td><a href="https://github.com/jayliang701/weroll-kickstarter-mini" target="_blank">mini</a></td>
            <td>最精简的weroll模板项目，只有View和API示例的简单示例，没有数据库操作和Ecosystem示例</td>
        </tr>
        <tr>
            <td><a href="https://github.com/jayliang701/weroll-kickstarter-website" target="_blank">website</a></td>
            <td>网站模板项目，提供了用户账户注册、登录/登出，使用数据库创建用户数据，登录会话管理的示例</td>
        </tr>
        <tr>
            <td><a href="https://github.com/jayliang701/weroll-kickstarter-game" target="_blank">game</a></td>
            <td>游戏服务器模板项目，提供了用户账户注册、登录/登出，多房间实时聊天</td>
        </tr>
    </tbody>
</table>