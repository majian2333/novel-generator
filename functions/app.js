const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 设置EJS作为模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// 引入小说生成器路由
const novelGeneratorRoutes = require('../routes/novelGenerator');

// 首页直接跳转到小说生成器
app.get('/', (req, res) => {
  res.redirect('/novel-generator');
});

// 小说生成器页面
app.get('/novel-generator', (req, res) => {
  res.render('novel-generator', { title: 'AI智能小说生成器' });
});

// 小说生成器API路由
app.use('/api/novels', novelGeneratorRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Cloudflare Pages Functions 使用 fetch 导出
module.exports = app;
