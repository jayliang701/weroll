---
layout: guide
title: Cache
level: 2.10
parent: guide
---

<h3>Cache</h3>
<ul class="guide_index">
    <li><a href="#intro">多级缓存</a></li>
    <li><a href="#template">视图模板引擎</a></li>
    <li><a href="#data">传递数据到页面</a></li>
    <li><a href="#filter">自定义模板引擎过滤器</a></li>
</ul>
<br>
<h4><a name="intro">多级缓存</a></h4>
weroll中设计了一套多级缓存系统, 默认支持二级缓存, 一级缓存使用<a href="https://www.npmjs.com/package/memory-cache" target="_blank">memory-cache</a>库对内存读写, 二级缓存使用<a href="https://www.npmjs.com/package/redis" target="_blank">redis</a>.
<br>


