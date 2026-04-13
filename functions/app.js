const express = require('express');
const path = require('path');

// 环境变量在Cloudflare Pages中通过环境变量设置
// 本地开发时使用dotenv
if (typeof process !== 'undefined' && process.env && !process.env.CF_PAGES) {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
}

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 设置EJS模板引擎
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
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    environment: process.env.NODE_ENV || 'development',
    cloudflare: !!process.env.CF_PAGES
  });
});

// Cloudflare Pages Functions 适配
// 使用原生方式处理请求，不需要额外适配器
module.exports = async function onRequest(context) {
  const { request, env } = context;
  
  // 将 Cloudflare 环境变量暴露给 process.env
  Object.keys(env).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = env[key];
    }
  });

  // 适配 Cloudflare Request 到 Express Request
  return new Promise((resolve, reject) => {
    // 使用 Node.js 原生 http 模块处理
    const http = require('http');
    
    // 创建临时服务器处理请求
    const server = http.createServer(app);
    
    // Cloudflare Request 转换为 Node.js 请求
    let body = '';
    const reader = request.body.getReader();
    reader.read().then(function processChunk({ done, value }) {
      if (done) {
        // 构建模拟的 http.IncomingMessage
        const { URL } = require('url');
        const url = new URL(request.url);
        
        const fakeReq = {
          method: request.method,
          url: url.pathname + url.search,
          headers: Object.fromEntries(request.headers),
          body: body,
          // Express 所需的其他属性
          _parsedUrl: require('url').parse(url.pathname + url.search),
        };
        
        // 收集响应
        let responseChunks = [];
        let statusCode = 200;
        let responseHeaders = {};
        
        const fakeRes = {
          writeHead: (code, headers) => {
            statusCode = code;
            responseHeaders = headers;
            return fakeRes;
          },
          write: (chunk) => {
            responseChunks.push(Buffer.from(chunk));
            return true;
          },
          end: (chunk) => {
            if (chunk) {
              responseChunks.push(Buffer.from(chunk));
            }
            const responseBody = Buffer.concat(responseChunks);
            resolve(new Response(responseBody, {
              status: statusCode,
              headers: responseHeaders
            }));
          },
          json: (data) => {
            responseHeaders['Content-Type'] = 'application/json';
            fakeRes.end(JSON.stringify(data));
          },
          redirect: (location) => {
            responseHeaders['Location'] = location;
            statusCode = 302;
            fakeRes.end();
          },
          render: (view, data) => {
            // 使用 require 渲染 EJS
            const ejs = require('ejs');
            const filePath = path.join(__dirname, '../views', `${view}.ejs`);
            ejs.renderFile(filePath, data, (err, html) => {
              if (err) {
                statusCode = 500;
                responseHeaders['Content-Type'] = 'text/plain';
                fakeRes.end(err.message);
              } else {
                responseHeaders['Content-Type'] = 'text/html; charset=utf-8';
                fakeRes.end(html);
              }
            });
          },
          setHeader: (name, value) => {
            responseHeaders[name] = value;
          },
          getHeader: (name) => responseHeaders[name],
          headersSent: false,
          writableEnded: false,
          status: (code) => {
            statusCode = code;
            return fakeRes;
          }
        };
        
        app(fakeReq, fakeRes);
        return;
      }
      body += Buffer.from(value).toString('utf-8');
      reader.read().then(processChunk);
    });
  });
};
