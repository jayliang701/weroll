---
layout: guide
title: Cache
level: 2.10
parent: guide
---

<h3>Cache</h3>
<ul class="guide_index">
    <li><a href="#intro">多级缓存</a></li>
    <li><a href="#config">缓存配置</a></li>
</ul>
<br>
<h4><a name="intro">多级缓存</a></h4>
weroll中设计了一套多级缓存系统, 默认支持二级缓存, 一级缓存使用<a href="https://www.npmjs.com/package/memory-cache" target="_blank">memory-cache</a>库对内存读写, 二级缓存使用<a href="https://www.npmjs.com/package/redis" target="_blank">redis</a>.
<br>
<div class="screenshot">
<img src="/public/img/cache_1.jpg">
</div>
<br>
使用 <b>weroll/model/Model</b> 对象就可以进行缓存读写<br>
<table class="doc">
    <thead>
        <tr>
            <td>Method</td>
            <td>Description</td>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Model.cacheSave</td>
            <td><pre><code class="javascript">Model.cacheSave(key, value, [expireTime], [level], [callback])</code></pre>写缓存，指定一个key来存储value，返回一个Promise对象。value可以是JSON对象，数组或其他基本类型。expireTime, level和callback是可选参数，expireTime表示缓存过期时间，单位是秒。level指定缓存写到内存里还是redis里，默认值是1，1表示写到内存里，2表示写到redis里。</td>
        </tr>
        <tr>
            <td>Model.cacheRead</td>
            <td><pre><code class="javascript">Model.cacheRead(key, [level], [callback])</code></pre>读缓存，读取key对应的缓存值，返回一个Promise对象。level和callback是可选参数，level指定从哪里读取缓存，默认值是1，1表示从内存读取，2表示从redis读取。</td>
        </tr>
        <tr>
            <td>Model.cacheRemove</td>
            <td><pre><code class="javascript">Model.cacheRemove(key, [level], [callback])</code></pre>删除缓存，返回一个Promise对象。level和callback是可选参数，level指定从哪里删除缓存，默认值是1，1表示从内存删除，2表示从redis删除。</td>
        </tr>
        <tr>
            <td>Model.setExpireTime</td>
            <td><pre><code class="javascript">Model.setExpireTime(key, expireTime, [level])</code></pre>设置缓存过期时间。expireTime表示缓存过期时间，单位是秒。level是可选参数，level指定从哪里删除缓存，默认值是1，1表示从内存删除，2表示从redis删除。</td>
        </tr>
        <tr>
            <td>Model.refreshExpireTime</td>
            <td><pre><code class="javascript">Model.refreshExpireTime(key, level)</code></pre>刷新缓存过期时间。此方法仅对使用cache.config中配置的缓存有效，请参考<a href="#config">缓存配置说明</a>。</td>
        </tr>
    </tbody>
</table>

<br>
示例代码如下：<br>

```js
var Model = require("weroll/model/Model");

//callBack
Model.cacheSave("name", "Jay", function(err) {
    if (err) return console.error(err);
    //saved, then try to read
    Model.cacheRead("name", function(err, value) {
        if (err) return console.error(err);
        //read
        console.log(value);   //echo "Jay"
    });
});

//Promise
Model.cacheSave("name", "Jay").then(function() {
    //saved, then try to read
    Model.cacheRead("name").then(function(value) {
        //read
        console.log(value);   //echo "Jay"
    });
});

//async & await
async function() {
    //save
    var result = await Model.cacheSave("name", "Jay");
    console.log(result);   //echo "Jay"

    //read
    result = await Model.cacheRead("name");
    console.log(result);   //echo "Jay"
}


/********************* 二级缓存读写 *********************/
async function() {
    //save into Level-2, and will expire after 5 seconds
    var person = { name:"Jay" };
    await Model.cacheSave("person", person, 5, 2);

    //read from Level-2
    var result = await Model.cacheRead("person", 2);
    console.log(result);   //echo { "name":"Jay" }
    console.log(result.name);    //echo "Jay"

    //sleep 6 seconds, and read again
    setTimeout(function() {
        result = await Model.cacheRead("person", 2);
        console.log(result);   //echo undefined
    }, 6000);
}
```
<br>
<br>
<h4><a name="config">缓存配置</a></h4>
weroll的多级缓存配置可以实现一级和二级缓存联动刷新，即允许用户通过配置，缓存数据时，同时存储到一级和二级缓存里（即内存和redis里）并设置不同的失效时间；在读取缓存时，weroll会优先从一级缓存读取数据，若数据失效则自动从二级缓存读取数据，并将数据重新写到一级缓存中。
<br>
缓存配置文件是 <b>./server/config/%ENV%/cache.config</b>，示例如下：<br>

```
{
    "general": {
        "user_info": { "level":0, "expired.1":600, "expired.2":86400 },
        "key-1": { "level":1, "expired.1":600 },
        "key-2": { "level":2, "expired.2":600 }
    }
}
```

一个典型的缓存配置如下：

```
"key":{ "level":LEVEL, "expired.1":LEVEL_1_EXPIRE_TIME, "expired.2":LEVEL_2_EXPIRE_TIME }
```
<ul class="explain">
    <li><span>key</span><span>定义缓存的键值</span></li>
    <li><span>level</span><span>定义缓存的级别，1表示一级缓存，2表示二级缓存，0表示一、二级缓存同时使用</span></li>
    <li><span>expired.1</span><span>定义一级缓存过期时间，单位是秒</span></li>
    <li><span>expired.2</span><span>定义二级缓存过期时间，单位是秒</span></li>
</ul>

<br>
使用cache.config配置的缓存，在使用时可以不需要指定level，weroll将自动识别该键值使用的缓存等级。示例代码如下：

```
/* ./server/config/%ENV%/cache.config
   define a cache using Level-2
*/
"my_key": { "level":2, "expired.2":600 }
```

```js
/* somewhere */
var Model = require("weroll/model/Model");

//save to Level-2
await Model.cacheSave("my_key", "Jay");

//read
var result = await Model.cacheRead("my_key");
console.log(result);   //echo "Jay"
//or
result = await Model.cacheRead("my_key", 2);
console.log(result);   //echo "Jay"

//but no cache in Level-1
result = await Model.cacheRead("my_key", 1);
console.log(result);   //echo undefined
```
<br>
注意：在cache.config中，<b>user_info</b> 这个缓存配置被用来处理weroll的Session读写，如果要使用weroll原生的Session功能，请保留这个缓存配置。



