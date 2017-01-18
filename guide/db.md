---
layout: guide
title: MongoDB
level: 2.04
parent: guide
---

<h3>MongoDB</h3>
<h4>连接配置</h4>
在./server/config/%ENV%/setting.js里，model.db节点配置了MongoDB的连接设置：
<pre><code class="javascript">model: {
    //mongodb connection config
    db: {
        host:"127.0.0.1",
        port:27017,
        name:"weroll&#95;app",  //the name of database
        option: {
            driver:"mongoose",  //or "native"
            server: {
                reconnectTries: Number.MAX&#95;VALUE,
                poolSize: 5,
                socketOptions: { keepAlive: 120 }
            }
        }
    },
    //redis connection config
    //redis: { ... }
}</code></pre>
对于weroll应用来说，数据库并不是必须的，如果你不需要连接数据库，可以将model.db节点注释。<br>
weroll同时支持<a href="" target="_blank">MongoDB官方的Node.js版连接库</a>，和<a href="" target="_blank">Mongoose</a>库。设置model.db.option.driver，可以选择使用官方driver或Mongoose，option的其他参数请参考<a href="http://mongodb.github.io/node-mongodb-native/2.2/reference/connecting/connection-settings/" target="_blank">MongoDB官方文档</a>。
<br>
<br>
<h4>使用MongoDB Native Driver</h4>
配置setting.js中的model.db节点：
<pre><code class="javascript">{
    model: {
        db: {
            ...
            option: {
                driver: "native",
                ...
            }
        }
    }
}</code></pre>
在main.js入口文件中初始化Model对象，Model对象将根据setting.js中的配置连接MongDB数据库：
<pre><code class="javascript">//./main.js<br>
var Setting = global.SETTING;<br>
app.addTask(function(cb) {
    var Model = require("weroll/model/Model");
    Model.init(Setting.model, function(err) {
        cb(err);
    });
});</code></pre>
Model.DB对象封装了一些常用的CURD方法，我们以findOne为例子，示例代码如下：
<pre><code class="javascript">var Model = require("weroll/model/Model");<br>
//callback
//find(tableName, filter, fields, sort, pagination, callBack)
Model.DB.findOne("User", { name:"Jay" }, { &#95;id:1, name:1, phone:1 }, function(err, doc) {
    console.log(arguments);
});<br>
//Promise
Model.DB.findOne("User", { name:"Jay" }, { &#95;id:1, name:1, phone:1 }).then(function(doc) {
    console.log(doc);
}).catch(function(err) {
    console.error(err);
});<br>
//async & await
async function() {
    var doc = await Model.DB.findOne("User", { name:"Jay" }, { &#95;id:1, name:1, phone:1 });
    console.log(doc);
});</code></pre>
详细使用方法，请<a href="https://github.com/jayliang701/weroll-kickstarter-test/blob/master/test/model/MongoDB.js" target="_blank">参考test里的代码</a>。
<br>
<br>
<h4>使用Mongoose</h4>
配置setting.js中的model.db节点：
<pre><code class="javascript">{
    model: {
        db: {
            ...
            option: {
                driver: "mongoose",
                ...
            }
        }
    }
}</code></pre>
然后在main.js入口文件中初始化Model对象和DAOFactory对象：
<pre><code class="javascript">//./main.js<br>
var Setting = global.SETTING;<br>
app.addTask(function(cb) {
    var Model = require("weroll/model/Model");
    Model.init(Setting.model,
        function(err) {
            if (err)  return cb(err);
            var DAOFactory = require("weroll/dao/DAOFactory");
            DAOFactory.init(Model.getDBByName());
            //可以指定DAO文件的存放目录，默认是 server/dao 目录
            //var folder = require("path").join(global.APP&#95;ROOT, "server/dao");
            //DAOFactory.init(Model.getDBByName(), folder);
            cb();
        });
});</code></pre>
DAOFactory对象会遍历dao目录和其子目录，将文件名为 XXXSchema.js 的文件作为Schema注册到mongoose实例里。比如UserSchema.js文件，初始化之后，你就可以在应用程序的任何一个地方使用User（User是mongoose里的Model对象）来操作数据，不需要require来导入。<br>
在weroll中使用mongoose的Model来操作数据库和官方一样，没有什么区别，以下是一段查询的示例代码：<br>
<pre><code class="javascript">//findOne with callback
User.findOne({ phone:"123456" }, function(err, doc) {
    console.log(arguments);
});<br>
//findOne with async/await
async function() {
    var doc = await User.findOne({ phone:"123456" }).exec();
    console.log(doc);
}</code></pre>
一个典型的Schema文件的定义如下：<br>
<pre><code class="javascript">//./server/dao/StudentSchema
var Schema = require("weroll/dao/DAOFactory").Schema;<br>
var COLLECTION&#95;NAME = "Student";  //定义表名为Student<br>
module.exports = function() {
    var schema = new Schema({
        name: { type:String, index:true, required:true },
        head: "String"
    }, { collection:COLLECTION&#95;NAME, strict: false });<br>
    schema.pre("save", function(next) {
        //do something before save
        next();
    });<br>
    schema.static("queryByName", function(name, fields, callBack) {
        return this.find({ name:name }).select(fields).exec(function(err, doc) {
            callBack && callBack(err, doc);
        });
    });<br>
    return { name:COLLECTION&#95;NAME, ref:schema };
}</code></pre>
定义Schema和官方用法一致，请参考<a href="http://mongoosejs.com/docs/guide.html" target="_blank">mongoose文档</a>。当DAOFactory.init完成之后，直接使用Student即可引用mongoose的Model对象。
<br>
<br>
<h4>连接多个数据库</h4>
weroll应用允许同时连接多个MongoDB数据库，分为主连接（或者叫默认连接）和其他连接。mongoose库只允许用在主连接上，native driver可以则两者都可以使用。示例代码如下：<br>
<pre><code class="javascript">var Model = require("weroll/model/Model");<br>
//建立主连接
var db&#95;config&#95;default = {
    host:"127.0.0.1",
    port:27017,
    name:"mydb",
    option: { driver:"native" }
};
Model.openDB(db&#95;config&#95;default, true, function(err, db) {
    //default mongodb is connected with native driver
    //CURD example:
    Model.DB.findOne();
});<br>
//建立其他连接
var db&#95;config&#95;other = {
    host:"192.168.1.200",
    port:27017,
    name:"yourdb",
    option: { driver:"native" }
};
Model.openDB(db&#95;config&#95;other, false, function(err, db) {
    //another mongodb is connected with native driver
    //CURD example:
    Model.DB.yourdb.findOne();
    //or
    Model.DB["yourdb"].update();
    //"yourdb" is the name of database which defined in config above
});</code></pre>
关闭数据库连接<br>
<pre><code class="javascript">//关闭主连接
Model.closeDB(function(err) {
    err && console.error(err);
});<br>
//关闭某个连接
Model.closeDB("name of database in config", function(err) {
    err && console.error(err);
});</code></pre>