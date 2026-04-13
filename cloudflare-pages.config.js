/**
 * Cloudflare Pages 构建配置
 * 对于 Node.js 项目，我们需要确保依赖正确安装
 */

module.exports = {
  build: {
    command: 'npm install',
    output: 'public',
  },
};
