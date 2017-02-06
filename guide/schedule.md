---
layout: guide
title: Schedule
level: 2.15
parent: guide
---

<h3>Utils</h3>
<ul class="guide_index">
    <li><a href="#start">启用计划任务</a></li>
    <li><a href="#rule">脚本规则</a></li>
    <li><a href="#timer">Timer脚本</a></li>
    <li><a href="#daily">Daily脚本</a></li>
</ul>
<br>
<h4><a name="start">启用计划任务</a></h4>
<b>ScheduleManager</b> 提供了计划任务服务，开发者可以用来实现定时任务功能，如统计过去一天的新增用户量，日均访问量，或者是定期进行数据/缓存清理，又或者是定时给运营人员发送系统邮件等等。
<br>
<br>
开发者需要编写任务脚本，将脚本文件保存在 <b>./server/schedule</b> 目录下，如 <b>./server/schedule/ping_server.js</b>。同时将脚本配置到 <b>./server/config/%ENV%/schedule.config</b> 里，一个简单的schedule.config内容如下：

```js
// ./server/config/%ENV%/schedule.config
{
    "ver": "1.0.0",
    "list":[
        { "type":1, "duration":10, "script":"ping_server", option:{ ip:"192.168.1.100" } },
        { "type":2, "time":"00:00:01", "script":"yesterday_data" }
    ]
}
```

上面的计划任务配置，定义了2个任务，第一个任务是每隔10秒钟执行一次 ping_server.js 这个脚本；第二个任务是每天00:00:01的时候，执行一次 yesterday_data.js 这个脚本。
<br>
接着启动 <b>ScheduleManager</b> ：

```js
/* ./main.js */

//app setup ...

app.addTask(function(cb){
    require("weroll/schedule/ScheduleManager").start();
    cb();
});

//more app setup ...
```

<br>
<br>
<br>
<h4><a name="rule">脚本规则</a></h4>
任务脚本需要暴露 <b>exec</b> 方法，并在脚本运行完成之后，执行回调函数。一个典型的脚本模板如下：

```js
/* your script */
exports.exec = exec(callBack, option) {
    //do some jobs
    //end script if it has an Error
    callBack(err);
}
```

开发者需要将业务代码写到exec方法里。
<br>
option参数是schedule.config配置里，对应此脚本的option数据，如:

```
{ "type":1, "duration":10, "script":"ping_server", option:{ ip:"192.168.1.100" } }
```

那么在exec方法里的option参数就上面配置中的option数据：

```js
exports.exec = exec(callBack, option) {
    console.log(option.ip);  //echo "192.168.1.100"
}
```

<br>
注意：ScheduleManager 是在主程序进程中执行脚本，因此脚本可以共享主进程中的数据，进程结束，脚本也会结束。

<br>
<br>
<h4><a name="timer">Timer脚本</a></h4>
<b>Timer脚本</b> 指每隔一段时间就需要执行一次的脚本，不同类型脚本的区别只是在于 schedule.config 的配置，Timer脚本配置如下：

```
{
    "type":1,
    "duration":10,
    "script":SCRIPT_NAME,
    "initExecute":true,
    "firstDelay":0,
    "disableTime":[ "23:58:00-23:59:59", "00:00:00-00:02:00" ],
    "waitCallBack":true,
    "option":{ SCRIPT_ARGUMENTS }
}
```

配置参数详细说明：
<table>
    <thead>
        <tr>
            <td>Option</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>type</td>
            <td>脚本类型，1表示Timer脚本，2表示<a href="#daily">Daily脚本</a></td>
        </tr>
        <tr>
            <td>duration</td>
            <td>脚本执行的时间间隔，单位：秒</td>
        </tr>
        <tr>
            <td>script</td>
            <td>脚本文件名</td>
        </tr>
        <tr>
            <td>initExecute</td>
            <td>true/false，表示该脚本是否在ScheduleManager启动的时候立即执行一次</td>
        </tr>
        <tr>
            <td>firstDelay</td>
            <td>表示该脚本第一次执行时需要延时的时间，单位：秒。如设置10，则表示脚本第一次延时10秒才执行</td>
        </tr>
        <tr>
            <td>disableTime</td>
            <td>数组，表示脚本在这些设定的时间段内不会执行</td>
        </tr>
        <tr>
            <td>waitCallBack</td>
            <td>true/false，表示下一次执行是否需要等待上一次执行的callBack回调。true表示脚本执行callBack回调后，才开始计时下一次执行</td>
        </tr>
        <tr>
            <td>option</td>
            <td>需要传递给脚本的对象</td>
        </tr>
    </tbody>
</table>



<br>
<br>
<h4><a name="daily">Daily脚本</a></h4>
<b>Daily脚本</b> 指每天在指定时间执行一次的脚本，Daily脚本配置如下：

```
{
    "type":2,
    "time":"00:00:01",
    "script":SCRIPT_NAME,
    "initExecute":true,
    "option":{ SCRIPT_ARGUMENTS }
}
```

配置参数详细说明：
<table>
    <thead>
        <tr>
            <td>Option</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>type</td>
            <td>脚本类型，1表示<a href="#timer">Timer脚本</a>，2表示Daily脚本</td>
        </tr>
        <tr>
            <td>time</td>
            <td>脚本执行的时间点，格式是：hh:mm:ss</td>
        </tr>
        <tr>
            <td>script</td>
            <td>脚本文件名</td>
        </tr>
        <tr>
            <td>initExecute</td>
            <td>true/false，表示该脚本是否在ScheduleManager启动的时候立即执行一次</td>
        </tr>
        <tr>
            <td>option</td>
            <td>需要传递给脚本的对象</td>
        </tr>
    </tbody>
</table>