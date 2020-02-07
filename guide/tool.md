---
layout: guide
title: Tools
level: 2.12
parent: guide
---

<h3>Tools</h3>
<ul class="guide_index">
    <li><a href="#how">如何使用tools</a></li>
    <li><a href="#code">编写脚本</a></li>
</ul>
<br>
<h4><a name="how">如何使用tools</a></h4>
在实际项目运营中, 开发者通常需要编写一些脚本, 用于解决运营中发生的一些问题, 如修正数据; 或者进行一些安全级别较高的操作, 如重置管理员密码, 清理数据等.
<br>
weroll提供了一种编写脚本的规范, 在weroll的模板项目中有一个 <b>./server/tools</b> 目录, 用于存放开发者编写的脚本, 然后通过执行以下exec.js来执行脚本操作:

```bash
$ cd YOUR_APPLICATION_FOLDER
$ node exec.js your_script arg0 arg1 arg2
```

<b>exec.js</b> 是weroll模板项目中执行脚本文件的入口; <br>
<b>your_script</b> 则是脚本的文件名(不需要写.js扩展名), 文件名后可以传入多个参数

<br>
假设我们编写了一个用于查询某一天注册用户数的脚本 <b>./server/tools/user_count.js</b>

```bash
$ node exec.js user_count 20170128
```

<br>
exec.js将先加载 <b>./server/config/%ENV%/setting.js</b> 里的配置数据, 如果配置有MongoDB或Redis,则建立相应的连接, 最后加载脚本文件, 开始执行里面的脚本内容.<br>
默认exec.js会使用 <b>localdev</b> 环境下的配置文件, 如果需要使用其他的环境配置, 需要在exec.js之后加上<b>-env</b>参数, 如:<br>

```bash
$ node exec.js -env=prod user_count 20170128
```

<br>
<br>
<h4><a name="code">编写脚本</a></h4>
编写脚本需要遵循一些规范, 一个典型的脚本文件如下:

```js
/* ./server/tools/your_script.js */
//node exec.js your_script arg0 arg1 arg2

exports.do = async (arg0, arg1, arg2) => {
    /*
        sync or await jobs
    */
    //jobs done, exit
    process.done();
}
```

<b>exports.do</b> 方法即是脚本的入口, 方法的参数即是命令行执行脚本时传递的参数.
<br>
<b>process.done([msg])</b> 会结束当前脚本进程, msg参数是可选的, 若不传递, 则控制台在进程结束前会输出"script is completed."; 若传递msg参数, 则控制台在进程结束前输出该信息; 若msg是Error对象, 则控制台在进程结束前使用console.error输出该错误信息.
<br>
<br>
我们接着上面的示例, 开始编写一个用于查询注册用户数的脚本:

```js
/* ./server/tools/user_count.js */

const Model = require("weroll/model/Model");

exports.do = (date1, date2) => {
    var filter = {};
    if (date1) {
        date1 = parseDate(date1);
        if (date2) {
            //user count in date1 ~ date2
            date2 = parseDate(date2);
            filter.createTime = {
                $gte:date1.getTime(),
                $lte:date2.getTime()
            };
        } else {
            //use count in date1
            filter.createTime = {
                $gte:date1.getTime(),
                $lte:date1.getTime() + 24 * 60 * 60 * 1000
            };
        }
    } else {
        //all user count
    }

    Model.DB.count("User", filter, (err, count) => {
        process.done(err ? err : `user count: ${count}`);
    });
}

function parseDate(date) {
    const year = date.substr(0, 4);
    const month = date.substr(4, 2);
    const day = date.substr(6, 2);
    return new Date(year, month, day, 0, 0, 0, 0);
}
```

然后我们来执行这个脚本, 查询数据库中的用户总数:

```bash
$ node exec.js user_count
```

<div class="screenshot">
<img src="/public/img/exec_1.jpg">
</div>
<br>
或者加上2个时间参数, 查询这这个时间段内产生的用户数:

```bash
$ node exec.js user_count 20170128 20170130
```

<div class="screenshot">
<img src="/public/img/exec_2.jpg">
</div>

