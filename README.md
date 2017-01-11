# magicfish_web
## 一个很好用的Node.js应用程序框架 (●′ω`●) 
### 基于MongoDB, Redis, Express 4.X和Swig模板引擎
经过了N个商业项目的打磨, 感觉可以拿出来见见人了. 主要特点如下：
* 配置简单, 支持多环境配置, 可根据启动参数切换配置环境, 如dev, test, production等, 由开发者自由定义
* 对MongoDB和Redis进行了简单的封装, 方便小白使用, 喜欢的话可以用Mongoose等更好的库
* 没有ORM, 没有集成用户管理等乱七八糟的东西, 完全由开发者自由发挥
* 支持web页面路由和http post API定义
* 通过配置对每一个路由和API接口进行权限验证
* 通过配置对每一个API接口进行请求参数验证
* 提供一个简单API测试页面
-- 2016年5月的某一天 --
* 新增 Ecosystem 可实现多个magicfish_web应用程序之间进行交互 (调用api或者建立socket连接), 通过配置即可实现基于各种微服务的应用程序架构


一个最精简的magicfish_web应用程序骨架如下：
<pre>
<code>
+ 项目目录
    <i>+ node_modules
        + magicfish_web</i>
    + client --------------- web前端
        + res ---------------- 杂七杂八的东西
            - js
            - css
    + views ----------------- html页面
        - template --------------- swig模板
    + server --------------- 数据&逻辑&服务
        + config ----------------- 配置文件
            - localdev --------------- 本地开发环境的配置
                cache.config ------------ 缓存配置
                setting.js ----------- 全局配置
            - test
            - prod
        + router ----------------- 页面路由
        + service ------------------- API接口
    main.js ------------------ 入口
    package.json
</code>
</pre>

