// ==================== Database.js ====================
// JSON 文件存储 - 支持 Railway Volume 持久化

const fs = require('fs');
const path = require('path');

// ==================== 数据目录配置 ====================
// Railway Volume 挂载点: /data
// 本地开发: 项目目录
// 优先检查环境变量 RAILWAY_VOLUME_MOUNT_PATH
const VOLUME_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data';
const DATA_DIR = fs.existsSync(VOLUME_PATH) ? VOLUME_PATH : __dirname;

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 数据库文件路径
const DB_FILE = path.join(DATA_DIR, 'keys.json');
const LOG_FILE = path.join(DATA_DIR, 'usage.log');

// 启动时显示数据存储位置
console.log(`[Database] 数据存储位置: ${DATA_DIR}`);

// ==================== 数据结构 ====================
let db = {
    keys: [],
    initialized: false
};

// ==================== 加载/保存数据库 ====================
function loadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        try {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            db = JSON.parse(data);
        } catch (e) {
            console.error('Database file corrupted, creating new one');
            db = { keys: [], initialized: false };
        }
    }
}

function saveDatabase() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function logUsage(keyData, req) {
    const logEntry = {
        key: keyData.key,
        timestamp: new Date().toISOString(),
        ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
        userAgent: req?.headers?.['user-agent'] || 'unknown'
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n', 'utf8');
}

// ==================== 数据库初始化 ====================
function initDatabase() {
    loadDatabase();

    if (!db.initialized) {
        db.initialized = true;
        // 生成演示密钥
        const demoKey = generateKeyString();
        db.keys.push({
            key: demoKey,
            createdAt: new Date().toISOString(),
            expiresAt: null,
            maxUses: 999,
            usedCount: 0,
            note: '演示密钥 - 可永久使用',
            status: 'active'
        });
        saveDatabase();

        console.log('Database initialized at:', DB_FILE);
        console.log('\n========================================');
        console.log('演示密钥已生成:');
        console.log(demoKey);
        console.log('========================================\n');
    }

    // 清理过期密钥
    cleanupExpiredKeys();
}

function cleanupExpiredKeys() {
    const now = new Date().toISOString();
    let cleaned = false;
    db.keys = db.keys.filter(k => {
        if (k.expiresAt && k.expiresAt < now && k.status === 'active') {
            k.status = 'expired';
            cleaned = true;
        }
        return true;
    });
    if (cleaned) saveDatabase();
}

// ==================== 密钥生成 ====================
function generateKeyString() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符
    const segments = [];
    for (let i = 0; i < 4; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            segment += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(segment);
    }
    return segments.join('-');
}

function createKey(options = {}) {
    const {
        maxUses = 1,
        expiresDays = null,
        note = ''
    } = options;

    loadDatabase();

    const key = generateKeyString();
    let expiresAt = null;

    if (expiresDays) {
        const date = new Date();
        date.setDate(date.getDate() + expiresDays);
        expiresAt = date.toISOString();
    }

    const keyData = {
        key,
        createdAt: new Date().toISOString(),
        expiresAt,
        maxUses,
        usedCount: 0,
        note,
        status: 'active'
    };

    db.keys.push(keyData);
    saveDatabase();

    return keyData;
}

// ==================== 密钥验证 ====================
function verifyKey(key, req) {
    loadDatabase();

    const now = new Date().toISOString();

    // 查找密钥
    const keyData = db.keys.find(k =>
        k.key === key &&
        k.status === 'active' &&
        (!k.expiresAt || k.expiresAt > now)
    );

    if (!keyData) {
        return { valid: false, error: '密钥无效或已过期' };
    }

    // 检查使用次数
    if (keyData.usedCount >= keyData.maxUses) {
        return { valid: false, error: '密钥使用次数已达上限' };
    }

    // 更新使用计数
    keyData.usedCount++;
    saveDatabase();

    // 记录使用日志
    try {
        logUsage(keyData, req);
    } catch (e) {
        // 忽略日志错误
    }

    return {
        valid: true,
        remainingUses: keyData.maxUses - keyData.usedCount
    };
}

// ==================== 密钥管理 ====================
function listKeys() {
    loadDatabase();
    return db.keys.map(k => ({
        ...k,
        created: k.createdAt,
        expires: k.expiresAt
    }));
}

function revokeKey(key) {
    loadDatabase();
    const keyData = db.keys.find(k => k.key === key);
    if (keyData) {
        keyData.status = 'revoked';
        saveDatabase();
        return true;
    }
    return false;
}

function deleteKey(key) {
    loadDatabase();
    const index = db.keys.findIndex(k => k.key === key);
    if (index !== -1) {
        db.keys.splice(index, 1);
        saveDatabase();
        return true;
    }
    return false;
}

// ==================== 命令行工具 ====================
const command = process.argv[2];

switch (command) {
    case 'init':
        initDatabase();
        break;

    case 'generate':
    case 'gen':
        const keyData = createKey({
            maxUses: parseInt(process.argv[3]) || 1,
            expiresDays: parseInt(process.argv[4]) || null,
            note: process.argv[5] || ''
        });
        console.log('\n========================================');
        console.log('新密钥已生成:');
        console.log(keyData.key);
        console.log('========================================');
        console.log('最大使用次数:', keyData.maxUses);
        console.log('过期时间:', keyData.expiresAt || '永不过期');
        console.log('备注:', keyData.note || '无');
        console.log('========================================\n');
        break;

    case 'list':
    case 'ls':
        const keys = listKeys();
        console.log('\n========================================');
        console.log('密钥列表:');
        console.log('========================================');
        keys.forEach(k => {
            console.log(`\n密钥: ${k.key}`);
            console.log(`状态: ${k.status}`);
            console.log(`使用: ${k.usedCount}/${k.maxUses}`);
            console.log(`过期: ${k.expires || '永不过期'}`);
            console.log(`备注: ${k.note || '无'}`);
            console.log(`创建: ${k.created}`);
            console.log('----------------------------------------');
        });
        console.log(`总计: ${keys.length} 个密钥\n`);
        break;

    case 'revoke':
        const keyToRevoke = process.argv[3];
        if (keyToRevoke && revokeKey(keyToRevoke)) {
            console.log('密钥已吊销:', keyToRevoke);
        } else {
            console.log('吊销失败，密钥不存在:', keyToRevoke);
        }
        break;

    case 'delete':
        const keyToDelete = process.argv[3];
        if (keyToDelete && deleteKey(keyToDelete)) {
            console.log('密钥已删除:', keyToDelete);
        } else {
            console.log('删除失败，密钥不存在:', keyToDelete);
        }
        break;

    default:
        console.log(`
密钥管理工具
============

命令:
  npm run init-db        初始化数据库
  npm run generate-key   生成新密钥
  npm run list-keys      列出所有密钥

使用方法:
  npm run generate-key [最大使用次数] [过期天数] [备注]

示例:
  npm run generate-key 1 30 "测试密钥"
  npm run generate-key 999     # 永久密钥
        `);
}

// ==================== 导出 ====================
module.exports = {
    initDatabase,
    verifyKey,
    createKey,
    listKeys,
    revokeKey,
    deleteKey,
    DB_FILE
};
