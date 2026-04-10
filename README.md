# 📚 AI 智能小说生成器

基于大语言模型的在线小说生成器，支持流式输出、续写连载，可自定义类型、主题、篇幅。

## ✨ 功能特性

- 🎨 **多种小说类型** - 奇幻/科幻/武侠/都市/历史/悬疑/言情
- 🔄 **流式输出** - 边生成边阅读，流畅不等待
- 📖 **支持续写** - 生成一半想继续往下写？点击续写即可连载
- 🎯 **智能分段** - 按照自然语义分段，阅读舒适
- ⚙️ **自定义提示词** - 支持自定义创作要求，想写什么写什么
- 🌐 **Web 界面** - 开箱即用的网页界面
- 🚫 **无数据库依赖** - 纯API服务，不需要数据库

## 🚀 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/你的用户名/novel-generator.git
cd novel-generator/webapp

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 API Key

# 启动服务
node app.js

# 访问
http://localhost:3000/novel-generator
```

### 🔧 环境变量配置

在 `.env` 文件中配置：

```env
# 智谱AI / 火山引擎方舟 API 配置
ZHIPU_AI_API_KEY=your_api_key_here
ZHIPU_AI_API_BASE=https://ark.cn-beijing.volces.com/api/coding/v3/
ZHIPU_AI_MODEL=doubao-seed-2.0-pro

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 🚀 一键部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/novel-generator)

1. 点击上方按钮部署
2. 在 Vercel 项目设置 → Environment Variables 填入环境变量：
   - `ZHIPU_AI_API_KEY` - 你的 API Key
   - `ZHIPU_AI_API_BASE` - `https://ark.cn-beijing.volces.com/api/coding/v3/`
   - `ZHIPU_AI_MODEL` - `doubao-seed-2.0-pro`
   - `PORT` - `3000`
   - `NODE_ENV` - `production`
3. 等待部署完成即可访问

## 📖 使用说明

1. **生成小说**
   - 选择小说类型、主题、篇幅
   - 可选：输入自定义提示词
   - 点击「✨ 生成小说」
   - 等待生成，可边生成边阅读，不会滚动到底，方便看前面内容

2. **续写小说**
   - 生成完成后，「📖 继续续写」按钮会自动启用
   - 点击即可基于当前内容继续创作
   - 支持无限续写，想写多长写多长，轻松实现长篇连载

3. **重新生成**
   - 点击「🔄 重新生成」使用相同设置重新生成

## 🛠 技术栈

- **后端**：Node.js + Express
- **前端**：原生JavaScript + EJS模板
- **AI**：OpenAI兼容接口（火山引擎方舟 / 智谱AI / 豆包）
- **数据库**：无依赖，纯API服务

## 📝 项目结构

```
novel-generator/
└── webapp/
    ├── app.js              # 入口文件
    ├── vercel.json         # Vercel 部署配置
    ├── .gitignore          # git 忽略文件
    ├── package.json        # 依赖配置
    ├── public/             # 静态资源
    ├── routes/
    │   └── novelGenerator.js  # 小说生成/续写API
    └── views/
        ├── footer.ejs
        ├── header.ejs
        └── novel-generator.ejs  # 小说生成页面
```

## 🎯 优化记录

- [x] 修复API端点URL拼接错误
- [x] 修复模板路径问题
- [x] 优化流式输出，批量更新DOM，减少跳动
- [x] 移除自动滚动，允许自由滚动阅读前面内容
- [x] 优化提示词，避免生成目录大纲，强制正确分段，给出示例
- [x] 添加续写功能，支持无限连载长篇小说
- [x] 移除数据库依赖，纯API服务，更方便部署

## 🔑 获取 API Key

本项目使用火山引擎方舟平台的豆包模型，你需要：

1. 注册 [火山引擎](https://www.volcengine.com/)
2. 创建方舟推理接入点
3. 获取 API Key 填入配置

也可以修改为其他兼容OpenAI接口的AI服务。

## 📄 许可证

MIT License

## 🎉 效果展示

> 点击生成，创作属于你的精彩故事 ✨
