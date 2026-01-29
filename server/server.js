// ==================== Server.js ====================
// Clawdbot 安装助手 - 后端服务

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { initDatabase, verifyKey, createKey, listKeys, revokeKey } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 安全配置 ====================
// 管理员密码（从环境变量读取，建议设置强密码）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeThisPassword!2024@Secure';
const ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

// IP 白名单（留空则允许所有 IP访问管理后台）
// 格式: ['192.168.1.1', '10.0.0.1'] 或单个 IP
const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST
    ? process.env.ADMIN_IP_WHITELIST.split(',').map(ip => ip.trim())
    : []; // 空数组 = 不限制

// 登录失败限制配置
const MAX_LOGIN_ATTEMPTS = 5;          // 最大失败次数
const LOCKOUT_DURATION = 30 * 60 * 1000; // 锁定时长（毫秒）
const loginAttempts = new Map();       // IP -> {count, lockUntil}

// Token 有效期（毫秒）
const TOKEN_EXPIRY = 2 * 60 * 60 * 1000; // 2 小时

// 管理后台随机路径（部署后可通过环境变量修改）
const ADMIN_PATH = process.env.ADMIN_PATH || generateRandomPath();

// 数据目录配置（与 database.js 保持一致）
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const DATA_DIR = fs.existsSync(VOLUME_PATH) ? VOLUME_PATH : path.join(__dirname);

// 操作日志文件
const ADMIN_LOG_FILE = path.join(DATA_DIR, 'admin.log');

// ==================== 辅助函数 ====================
function generateRandomPath() {
    // 生成 8 位随机字符串
    return crypto.randomBytes(4).toString('hex');
}

function getClientIp(req) {
    return req.ip ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           'unknown';
}

function isIpWhitelisted(ip) {
    if (ADMIN_IP_WHITELIST.length === 0) return true;
    return ADMIN_IP_WHITELIST.includes(ip);
}

function logAdminAction(action, details, req) {
    const ip = getClientIp(req);
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        details
    };
    fs.appendFileSync(ADMIN_LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');
}

// ==================== 中间件 ====================
app.use(cors());
app.use(express.json());

// 请求日志中间件（仅记录管理 API）
app.use('/api/admin', (req, res, next) => {
    const ip = getClientIp(req);
    logAdminAction('API_REQUEST', `${req.method} ${req.path}`, req);
    next();
});

app.use(express.static(path.join(__dirname, '..'))); // 托管前端静态文件

// ==================== 安全中间件 ====================

// IP 白名单检查
function checkIpWhitelist(req, res, next) {
    const ip = getClientIp(req);

    if (!isIpWhitelisted(ip)) {
        logAdminAction('IP_BLOCKED', `IP ${ip} 尝试访问管理接口`, req);
        return res.status(403).json({
            success: false,
            error: '访问被拒绝'
        });
    }
    next();
}

// 登录速率限制
function checkRateLimit(req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();

    if (!loginAttempts.has(ip)) {
        loginAttempts.set(ip, { count: 0, lockUntil: 0 });
    }

    const attempts = loginAttempts.get(ip);

    // 检查是否在锁定期内
    if (attempts.lockUntil > now) {
        const remaining = Math.ceil((attempts.lockUntil - now) / 1000 / 60);
        logAdminAction('RATE_LIMIT_BLOCKED', `IP ${ip} 被锁定，剩余 ${remaining} 分钟`, req);
        return res.status(429).json({
            success: false,
            error: `登录尝试过多，请 ${remaining} 分钟后再试`
        });
    }

    // 如果锁定期已过，重置计数
    if (attempts.lockUntil > 0 && attempts.lockUntil <= now) {
        attempts.count = 0;
        attempts.lockUntil = 0;
    }

    // 绑定到请求，供后续使用
    req.loginAttempts = attempts;
    req.clientIp = ip;
    next();
}

// Token 验证中间件
function verifyAdminToken(req, res, next) {
    const token = req.body.token || req.headers['x-admin-token'];

    if (!token) {
        return res.json({ success: false, error: '未授权' });
    }

    try {
        // Token 格式: sha256哈希:时间戳:签名
        const parts = token.split(':');
        if (parts.length !== 3) {
            return res.json({ success: false, error: 'Token 格式无效' });
        }

        const [hash, timestamp, signature] = parts;
        const now = Date.now();

        // 检查时间戳是否有效
        const tokenAge = now - parseInt(timestamp);
        if (tokenAge > TOKEN_EXPIRY) {
            return res.json({ success: false, error: 'Token 已过期，请重新登录' });
        }
        if (tokenAge < 0) {
            return res.json({ success: false, error: 'Token 时间戳无效' });
        }

        // 验证签名
        const expectedSignature = crypto.createHmac('sha256', ADMIN_PASSWORD)
            .update(`${hash}:${timestamp}`)
            .digest('hex');

        if (signature !== expectedSignature) {
            logAdminAction('AUTH_FAILED', 'Token 签名验证失败', req);
            return res.json({ success: false, error: 'Token 无效' });
        }

        // 验证密码哈希
        if (hash !== ADMIN_PASSWORD_HASH) {
            logAdminAction('AUTH_FAILED', '密码哈希不匹配', req);
            return res.json({ success: false, error: '认证失败' });
        }

        // 验证通过
        req.adminAuthenticated = true;
        next();

    } catch (error) {
        logAdminAction('AUTH_ERROR', error.message, req);
        return res.json({ success: false, error: '认证失败' });
    }
}

// 应用 IP 白名单到所有管理 API
app.use('/api/admin', checkIpWhitelist);

// ==================== API 路由 ====================

// 管理员登录 API（带速率限制）
app.post('/api/admin/login', checkRateLimit, (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.json({ success: false, error: '请输入密码' });
    }

    // 计算密码哈希
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    if (passwordHash === ADMIN_PASSWORD_HASH) {
        // 登录成功 - 生成 token
        const timestamp = Date.now();
        const signature = crypto.createHmac('sha256', ADMIN_PASSWORD)
            .update(`${passwordHash}:${timestamp}`)
            .digest('hex');

        const token = `${passwordHash}:${timestamp}:${signature}`;

        // 重置失败计数
        req.loginAttempts.count = 0;
        req.loginAttempts.lockUntil = 0;

        logAdminAction('LOGIN_SUCCESS', `IP ${req.clientIp} 登录成功`, req);

        res.json({
            success: true,
            token,
            expiresIn: TOKEN_EXPIRY
        });
    } else {
        // 登录失败 - 增加计数
        req.loginAttempts.count++;

        logAdminAction('LOGIN_FAILED', `IP ${req.clientIp} 密码错误 (${req.loginAttempts.count}/${MAX_LOGIN_ATTEMPTS})`, req);

        if (req.loginAttempts.count >= MAX_LOGIN_ATTEMPTS) {
            // 达到最大尝试次数，锁定
            req.loginAttempts.lockUntil = Date.now() + LOCKOUT_DURATION;
            logAdminAction('ACCOUNT_LOCKED', `IP ${req.clientIp} 被锁定 ${LOCKOUT_DURATION/60000} 分钟`, req);

            return res.status(429).json({
                success: false,
                error: `登录失败过多，已锁定 ${LOCKOUT_DURATION / 60000} 分钟`
            });
        }

        const remaining = MAX_LOGIN_ATTEMPTS - req.loginAttempts.count;
        return res.status(401).json({
            success: false,
            error: `密码错误，还剩 ${remaining} 次尝试机会`
        });
    }
});

// 密钥验证 API
app.post('/api/verify', (req, res) => {
    const { key } = req.body;

    // 基本验证
    if (!key) {
        return res.json({ success: false, error: '请提供密钥' });
    }

    // 格式验证
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
    if (!pattern.test(key)) {
        return res.json({ success: false, error: '密钥格式不正确' });
    }

    // 数据库验证
    const result = verifyKey(key, req);

    if (result.valid) {
        res.json({
            success: true,
            data: {
                remainingUses: result.remainingUses
            }
        });
    } else {
        res.json({
            success: false,
            error: result.error
        });
    }
});

// 管理后台 - 列出所有密钥
app.post('/api/admin/list', verifyAdminToken, (req, res) => {
    const keys = listKeys();
    res.json({ success: true, data: keys });
});

// 管理后台 - 生成新密钥
app.post('/api/admin/generate', verifyAdminToken, (req, res) => {
    const { maxUses = 1, expiresDays = null, note = '' } = req.body;

    const newKey = createKey({
        maxUses: parseInt(maxUses) || 1,
        expiresDays: expiresDays ? parseInt(expiresDays) : null,
        note
    });

    res.json({ success: true, data: newKey });
});

// 管理后台 - 吊销密钥
app.post('/api/admin/revoke', verifyAdminToken, (req, res) => {
    const { key } = req.body;

    if (!key) {
        return res.json({ success: false, error: '请提供密钥' });
    }

    const success = revokeKey(key);

    if (success) {
        res.json({ success: true });
    } else {
        res.json({ success: false, error: '密钥不存在' });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== 前端路由 ====================
// 所有其他路由返回 index.html（SPA 支持）
app.get('*', (req, res) => {
    // 如果是 API 请求但未匹配，返回 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    // 否则返回前端页面
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ==================== 启动服务器 ====================
// 确保数据库已初始化
initDatabase();

app.listen(PORT, () => {
    console.log('========================================');
    console.log('Clawdbot 安装助手服务已启动');
    console.log('========================================');
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log('');
    console.log('【安全配置】');
    console.log(`管理后台: http://localhost:${PORT}/admin.html`);
    console.log(`IP 白名单: ${ADMIN_IP_WHITELIST.length > 0 ? ADMIN_IP_WHITELIST.join(', ') : '未启用（所有 IP 可访问）'}`);
    console.log(`登录限制: ${MAX_LOGIN_ATTEMPTS} 次失败后锁定 ${LOCKOUT_DURATION / 60000} 分钟`);
    console.log(`Token 有效期: ${TOKEN_EXPIRY / 60000} 分钟`);
    console.log('');
    console.log('【管理员登录】');
    console.log(`默认密码: ${ADMIN_PASSWORD}`);
    console.log('⚠️  请尽快修改密码！设置环境变量: ADMIN_PASSWORD=你的密码');
    console.log('========================================');
});

// ==================== 优雅关闭 ====================
process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    process.exit(0);
});
