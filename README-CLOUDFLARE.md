# Cloudflare Pages 部署指南

本项目已适配 Cloudflare Pages Functions，可以直接部署到 Cloudflare 平台。

## 部署步骤

### 1. 连接 GitHub/GitLab 到 Cloudflare Pages

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 进入 Pages
2. 点击 "Create a project"
3. 连接你的 Git 仓库并选择这个项目
4. 在构建设置中配置：
   - **Build command**: `npm install`
   - **Output directory**: `public`

### 2. 配置环境变量

在 Cloudflare Pages 项目设置 → "Environment variables" 中添加以下环境变量：

- `ZHIPU_AI_API_KEY`: 你的智谱AI API 密钥（必填）
- `ZHIPU_AI_API_BASE`: API 端点（可选，默认：`https://open.bigmodel.cn/api/paas/v4/`）
- `ZHIPU_AI_MODEL`: 模型名称（可选，默认：`doubao-seed-2.0-pro`）

**对于火山引擎方舟，API_BASE 应该是：**
```
https://ark.cn-beijing.volces.com/api/v3/
```
并且模型名称使用你在方舟获得的模型ID。

### 3. 部署

点击 "Save and Deploy" 开始部署。

## 项目结构说明

```
novel-generator/
├── functions/
│   └── app.js          # Cloudflare Pages Functions 入口
├── public/             # 静态文件目录
│   ├── _routes.json   # Cloudflare 路由配置
│   └── ... (其他静态资源)
├── views/              # EJS 模板文件
├── routes/             # Express 路由
├── wrangler.toml       # Wrangler 配置
├── cloudflare-pages.config.js
└── README-CLOUDFLARE.md
```

## 路由说明

- `/*` - 静态文件由 Cloudflare Pages 自动处理
- `/api/*` - 由 Functions 处理（API 接口）
- `/health` - 健康检查接口

## 本地开发

使用 Wrangler 本地开发：

```bash
# 安装 Wrangler
npm install -g wrangler

# 本地开发
wrangler dev

# 或者使用 npm start
npm start
```

## 注意事项

1. **流式输出支持**：Cloudflare Pages Functions 支持流式输出，本项目已做适配
2. **Node.js 兼容性**：需要启用 `nodejs_compat` 兼容性标志（已在 `wrangler.toml` 中配置）
3. **环境变量**：必须在 Cloudflare Dashboard 配置 `ZHIPU_AI_API_KEY`
4. **冷启动**：Cloudflare 有冷启动，首次访问可能稍慢

## 故障排查

### 500 错误

- 检查环境变量是否正确配置
- 查看 Cloudflare 函数日志，通常会显示具体错误信息

### 流式输出不工作

- 确保使用的是 Cloudflare Pages Functions，并且 `_routes.json` 配置正确
- 检查是否有 CORS 问题

### 依赖安装失败

- 在 Cloudflare Pages 构建设置中，确保 Node.js 版本 >= 18
- 可以尝试在 "Build command" 中使用 `npm ci` 代替 `npm install`
