# Clawdbot 安装助手

一个简洁的密钥验证和安装脚本分发系统。

## 项目结构

```
clawdbot-installer/
├── index.html          # 密钥验证页面
├── download.html       # 下载页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   └── app.js          # 前端逻辑
├── scripts/
│   ├── install-clawdbot-windows.ps1    # Windows 安装脚本
│   └── install-clawdbot-macos-linux.sh # macOS/Linux 安装脚本
└── server/
    ├── server.js       # Express 服务器
    ├── database.js     # SQLite 数据库操作
    ├── package.json    # 后端依赖
    └── keys.db         # 数据库文件（运行后生成）
```

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 启动服务器

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 访问网站

打开浏览器访问 `http://localhost:3000`

## 密钥管理

### 生成新密钥

```bash
# 单次使用密钥
npm run generate-key

# 指定使用次数和有效期（天）
npm run generate-key 10 30 "客户A的密钥"

# 永久密钥（999次使用）
npm run generate-key 999
```

### 查看所有密钥

```bash
npm run list-keys
```

### 吊销/删除密钥

```bash
# 进入 server 目录
cd server
node database.js revoke XXXX-XXXX-XXXX-XXXX
node database.js delete XXXX-XXXX-XXXX-XXXX
```

## 部署

### 方式一：Vercel（推荐，免费）

1. 将代码上传到 GitHub
2. 在 Vercel 导入项目
3. 修改 `js/app.js` 中的 `API_URL` 为你的 Vercel 域名
4. 重新部署

### 方式二：自己的服务器

1. 安装 Node.js
2. 上传代码到服务器
3. 运行 `cd server && npm install && npm start`
4. 使用 PM2 保持服务运行：

```bash
npm install -g pm2
pm2 start server/server.js --name clawdbot-installer
pm2 save
pm2 startup
```

### 使用 Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 配置说明

### 前端配置 (`js/app.js`)

```javascript
const CONFIG = {
    API_URL: '/api/verify',     // API 地址
    DEMO_MODE: false             // 演示模式（测试时设为 true）
};
```

### 后端配置 (`server/server.js`)

```javascript
const PORT = process.env.PORT || 3000;  // 服务端口
```

## 注意事项

1. **数据库备份**：`server/keys.db` 包含所有密钥信息，请定期备份
2. **HTTPS**：生产环境建议使用 HTTPS
3. **密钥安全**：不要将 `keys.db` 提交到公开仓库
4. **演示密钥**：首次启动会自动生成一个演示密钥

## 技术栈

- 前端：HTML + CSS + 原生 JavaScript
- 后端：Node.js + Express.js
- 数据库：SQLite (better-sqlite3)
