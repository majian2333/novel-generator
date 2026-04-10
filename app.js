const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 设置EJS作为模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 首页直接跳转到小说生成器
app.get('/', (req, res) => {
  res.redirect('/novel-generator');
});

// 小说生成器页面
app.get('/novel-generator', (req, res) => {
  res.render('novel-generator', { title: 'AI智能小说生成器' });
});

// 引入小说生成器路由
const novelGeneratorRoutes = require('./routes/novelGenerator');

// 小说生成器API路由
app.use('/api/novels', novelGeneratorRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📊 环境: ${process.env.NODE_ENV}`);
});

module.exports = app;
