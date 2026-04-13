/**
 * Cloudflare Workers 入口文件
 * 适配 Express app 到 Cloudflare Workers
 */

const express = require('express');
const path = require('path');

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 设置EJS模板引擎
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));

// 引入小说生成器路由
const novelGeneratorRoutes = require('./routes/novelGenerator');

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
    environment: 'cloudflare-workers',
    name: 'novel-generator'
  });
});

// Cloudflare Workers 导出默认处理器
export default {
  async fetch(request, env, ctx) {
    // 将环境变量暴露给 process.env
    Object.keys(env).forEach(key => {
      if (!process.env[key]) {
        process.env[key] = env[key];
      }
    });

    // 解析 URL
    const url = new URL(request.url);
    
    return new Promise((resolve, reject) => {
      // 构建模拟 Express 请求对象
      const fakeReq = {
        method: request.method,
        url: url.pathname + url.search,
        headers: Object.fromEntries(request.headers),
        _parsedUrl: require('url').parse(url.pathname + url.search),
      };

      // 收集响应
      let responseChunks = [];
      let statusCode = 200;
      let responseHeaders = new Headers();
      
      // 添加默认 headers
      responseHeaders.set('X-Powered-By', 'Cloudflare Workers');

      const fakeRes = {
        writeHead: (code, headers) => {
          statusCode = code;
          if (typeof headers === 'object') {
            Object.entries(headers).forEach(([key, value]) => {
              responseHeaders.set(key, value);
            });
          }
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
          responseHeaders.set('Content-Type', 'application/json');
          fakeRes.end(JSON.stringify(data));
        },
        redirect: (location) => {
          responseHeaders.set('Location', location);
          statusCode = 302;
          fakeRes.end();
        },
        render: (view, data) => {
          const ejs = require('ejs');
          const filePath = path.join(__dirname, 'views', `${view}.ejs`);
          ejs.renderFile(filePath, data, (err, html) => {
            if (err) {
              statusCode = 500;
              responseHeaders.set('Content-Type', 'text/plain; charset=utf-8');
              fakeRes.end(err.message);
            } else {
              responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
              fakeRes.end(html);
            }
          });
        },
        setHeader: (name, value) => {
          responseHeaders.set(name, value);
        },
        getHeader: (name) => responseHeaders.get(name),
        headersSent: false,
        writableEnded: false,
        status: (code) => {
          statusCode = code;
          return fakeRes;
        }
      };

      // 处理请求
      app(fakeReq, fakeRes);
    });
  }
};
