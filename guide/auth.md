---
layout: guide
title: Authorization
level: 2.06
parent: guide
---

<h3>Authorization</h3>
<h4>客户端授权</h4>
由于数据库操作对weroll应用不是必须的，因此weroll没有集成用户账户管理功能，需要开发者根据自己需要实现维护账户数据，登录验证，和密码修改等功能.
<br>
<br>
<h4>Session</h4>
weroll内置了Session管理功能，使用 weroll/model/Session 对象可以对用户的登录会话进行管理和校验.<br>
weroll的Session采用的是令牌校验的机制,即当用户登录成功之后,weroll生成一个16位的随机字符串作为令牌(以下我们称为token),并将token传递给客户端,客户端在随后每一次API请求或页面请求都会附带这个token,weroll会对它做验证,以维护用户会话的状态.<br>
对于WebApp来说,会话Token将存放在客户端的cookie中. <br>
对于APIServer来说,Token需要显式的返回给客户端(例如通过一个login的API响应Token给客户端),由客户端决定以何种方式存储它. 随后的每次API请求,客户端都需要将Token连同请求数据一起发送给服务器.<br>
<br>
创建登录会话:<br>

```js
//code
```

