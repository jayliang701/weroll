---
layout: guide
title: Profiling
level: 2.13
parent: guide
---

<h3>Profiling</h3>
<ul class="guide_index">
    <li><a href="#start">启用Profiling</a></li>
    <li><a href="#use">查看和清理Profiling</a></li>
</ul>
<br>
<h4><a name="start">启用Profiling</a></h4>
weroll集成了一种简单的程序性能监控手段, 可以统计WebApp和APIServer中每一个API请求和页面请求的执行性能状况.<br>
<br>
开发者只需要在setting.js中设置好Redis连接配置, 然后在启动进程时添加 <b>-profiling</b> 参数即可开启性能监控, 如:

```bash
$ node main.js -env=prod -profiling
```
<br>
性能监控开启后, weroll默认将会每3秒一次把统计信息写入到Redis里, 开发者也可以定义这个时间周期:<br>

```js
/* ./server/config/%ENV%/setting.js */
module.exports = {
    ....
    profiling: {
        duration:1000    //更改为每秒写一次统计信息
    }
    ...
}
```

<br>
<br>
<h4><a name="use">查看和清理Profiling</a></h4>
目前weroll的性能监控针对API和页面请求提供以下的信息统计:<br>
<ul class="explain short">
    <li><span>total</span><span>所有请求总次数</span></li>
    <li><span>count</span><span>单个请求发生次数</span></li>
    <li><span>avg</span><span>平均请求处理时间, 单位: 毫秒</span></li>
    <li><span>min</span><span>请求最短处理时间, 单位: 毫秒</span></li>
    <li><span>max</span><span>请求最长处理时间, 单位: 毫秒</span></li>
</ul>
<br>
以<a href="/guide/cli/#list" target="_blank">website模板项目</a>为例, 开启性能监控后, 在项目目录下执行profiling脚本可以看到性能监控信息:

```bash
$ node exec.js profiling default
```

<div class="screenshot">
<img src="/public/img/profiling_1.jpg">
</div>

截图中, login表单提交POST请求发生3次, 平均耗时24毫秒, 最小耗时0毫秒, 最大耗时32毫秒; <br>
system.now这个API被调用了14次, 平均耗时1毫秒;<br>
总共发生了26次请求, 平均耗时17毫秒, 最大耗时57毫秒
<br>
<br>
执行脚本时使用clean参数可以清理性能监控信息:

```bash
$ node exec.js profiling default clean
```

<br>
执行脚本请参考<a href="/guide/tool" target="_blank">Tools文档</a>.

