const express = require('express');
const path = require('path');
const { createCloudflareRequestHandler } = require('@cloudflare/expressjs-adapter');

// 环境变量在Cloudflare Pages中通过环境变量设置
// 本地开发时使用dotenv
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件 - 在Cloudflare Pages中，public目录会自动处理
// 所以这里只处理非静态路由
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
}

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
  res.json({ status: 'OK', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

// Cloudflare Pages Functions 使用 fetch 导出
const handler = createCloudflareRequestHandler(app);
module.exports = handler;
