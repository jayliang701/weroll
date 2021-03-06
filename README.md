<h1>weroll</h1>
<h3>极速搭建一个基于微服务架构的Node.js应用程序，用最小的代码实现常见的web业务。</h3>
weroll基于MongoDB，Redis，Express 4.x以及APIServer（基于原生http库开发的极简化API服务库），经过数个商业项目凝练而来。
<br><br>
主要特点如下：<br>
<ul>
    <li>与具体业务无关，与持久化数据库无关</li>
    <li>合理的项目文件结构，区分路由逻辑和API逻辑</li>
    <li>路由和API可定义访问权限</li>
    <li>API定义支持常用的数据校验（如字符，数字，手机号等），支持必须参数和可选参数设定</li>
    <li>提供API调试工具，自动显示API描述和参数说明</li>
    <li>支持多环境配置, 可根据启动参数切换运行环境, 如dev, test, production等, 不同的环境使用不同的配置文件，由开发者自由定义</li>
    <li>内置MongoDB的支持，使用Mongoose操作数据库，简化了Schema定义流程，简化了Model使用方式</li>
    <li>封装了socket.io可以实现基本的websocket实时数据交互</li>
    <li>集成一些常见的web服务功能，如用户权限维护，邮件发送，短信发送/验证码检查等</li>
    <li>面向微服务架构，多个weroll应用之间可以配置成为一个生态系统，相互之间可以调用API和推送消息</li>
</ul>
<br>
<h3>Quick Start</h3>
<h4>使用weroll-cli</h4>
weroll-cli 是一个帮助你快速生成weroll应用程序骨架的命令行工具。
<br><br>
<b>Step 1:</b> npm全局安装weroll-cli
<pre class="highlight"><code style="width:100%;">$ npm install -g weroll-cli</code></pre>

<b>Step 2:</b> 使用weroll命令创建一个weroll项目（在命令行当前目录下，创建DemoApp目录）
<pre class="highlight"><code style="width:100%;">$ weroll init DemoApp</code></pre>
如果你需要使用cnpm，请在命令后面加上 --cnpm 参数
<pre class="highlight"><code style="width:100%;">$ weroll init DemoApp --cnpm</code></pre>
或者使用yarn进行创建
<pre class="highlight"><code style="width:100%;">$ weroll init DemoApp --yarn</code></pre>

<b>Step 3:</b> 等待项目创建完成，进入项目目录，启动项目
<pre class="highlight"><code style="width:100%;">$ npm run dev</code></pre>
你也可以使用其他node进程管理器，如pm2，forever等
<br>
<br>
现在你可以使用浏览器打开 <a href="http://localhost:3000/" target="_blank">http://localhost:3000/</a> 看到应用程序的主页
<br>
<h3>Let's roll!</h3>
<br>
<br>
查看详细文档，请至项目主页：<a href="http://weroll.magicfish.cn/" target="_blank">http://weroll.magicfish.cn/</a>