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
    <li><a href="#ext">扩展N级缓存</a></li>
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


<br>
<h4><a name="ext">扩展N级缓存</a></h4>
如果开发者希望使用文件系统或其他方式来处理缓存, 可以自行扩展三级缓存或更高级别的缓存, 开发者需要实现一个缓存处理对象, 该对象需要实现以下方法:<br>

```js
/* cache handler */

exports.setExpireTime = function(key, val) {
    //实现设置缓存失效时间
}

exports.registerExpiredTime = function(key, expireTime) {
    //实现预先注册缓存失效时间, 方便在使用时可以不再显式指定失效时间
}

exports.save = function(key, val, expireTime, callBack) {
    //实现写缓存, 需要返回Promise对象
    return new Promise(function(resolve, reject) {
        //your codes
        //如果callBack存在, 则使用callBack, 不使用resolve和reject
    });
}

exports.read = function(key, callBack) {
    //实现读缓存, 需要返回Promise对象
    return new Promise(function(resolve, reject) {
        //your codes
        //如果callBack存在, 则使用callBack, 不使用resolve和reject
    });
}

exports.remove = function(key, callBack) {
    //实现删除缓存, 需要返回Promise对象
    return new Promise(function(resolve, reject) {
        //your codes
        //如果callBack存在, 则使用callBack, 不使用resolve和reject
    });
}

```
<br>
我们用文件系统缓存作为示例:<br>

```js
/* somewhere */
var Model = require("weroll/model/Model");

var FileCache = {};
FileCache.setExpireTime = function(key, val) {
    //暂不实现
}

FileCache.registerExpiredTime = function(key, expireTime) {
    //暂不实现
}

FileCache.save = function(key, val, expireTime, callBack) {
    return new Promise(function(resolve, reject) {
        if (key instanceof Array) key = key.join("-");
        var cache = typeof val == "object" ? JSON.stringify(val) : val;
        fs.writeFile(path.join(CACHE_FOLDER, key), cache, { encoding:"utf8" }, function(err) {
            if (callBack) return callBack(err, val);
            err ? reject(err) : resolve(val);
        });
    });
}

FileCache.read = function(key, callBack) {
    return new Promise(function(resolve, reject) {
        if (key instanceof Array) key = key.join("-");
        fs.readFile(path.join(CACHE_FOLDER, key), { encoding:"utf8" }, function(err, cache) {
            if (err && err.code == "ENOENT") {
                //file is not exist
                err = null;
                cache = null;
            }
            var val = cache;
            if (val) {
                try {
                    val = JSON.parse(cache);
                } catch (exp) {
                    //it is a non-object value
                    val = cache;
                }
            }
            if (callBack) return callBack(err, val);
            err ? reject(err) : resolve(val);
        });
    });
}

FileCache.remove = function(key, callBack) {
    return new Promise(function(resolve, reject) {
        if (key instanceof Array) key = key.join("-");
        fs.unlink(path.join(CACHE_FOLDER, key), function(err) {
            if (err && err.code == "ENOENT") {
                //no such file, ignores this error
                err = null;
            }
            if (callBack) return callBack(err);
            err ? reject(err) : resolve();
        });
    });
}

//注册为第三级缓存
Model.registerCacheSystem(3, FileCache);


/***************** Test *****************/

var val = { name:"Jay" };
var result = await Model.cacheSave("user", val, null, 3);
assert(result);
assert.equal(result, val);

result = await Model.cacheRead("user", 3);
assert(result);
assert.equal(result.name, val.name);

await Model.cacheRemove("user", 3);

result = await Model.cacheRead("user", 3);
assert.equal(result, undefined);
```

具体代码请参考<a href="https://github.com/jayliang701/weroll-kickstarter-test/blob/c6c1977af9d59eb1c5be415bfced1c6c7167e6a5/test/model/Model.js#L207" target="_blank">Model的测试用例</a>.
<br>
