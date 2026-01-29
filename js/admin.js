// ==================== Admin.js ====================
// 管理后台逻辑

const CONFIG = {
    API_BASE: '/api/admin',
    LOGIN_URL: '/api/admin/login'
    // 管理员密码在服务端配置（server/server.js）
    // 默认密码: ChangeThisPassword!2024@Secure
};

// ==================== SHA-256 工具函数 ====================
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== DOM Elements ====================
const elements = {
    // Login
    loginCard: document.getElementById('loginCard'),
    adminPanel: document.getElementById('adminPanel'),
    passwordInput: document.getElementById('passwordInput'),
    loginBtn: document.getElementById('loginBtn'),
    loginError: document.getElementById('loginError'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Admin Panel
    generateKeyBtn: document.getElementById('generateKeyBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    generateForm: document.getElementById('generateForm'),
    keyList: document.getElementById('keyList'),
    maxUses: document.getElementById('maxUses'),
    expiresDays: document.getElementById('expiresDays'),
    keyNote: document.getElementById('keyNote'),
    cancelGenerate: document.getElementById('cancelGenerate'),
    confirmGenerate: document.getElementById('confirmGenerate'),

    // Modal
    keyModal: document.getElementById('keyModal'),
    modalKey: document.getElementById('modalKey'),
    modalStatus: document.getElementById('modalStatus'),
    modalUsage: document.getElementById('modalUsage'),
    modalCreated: document.getElementById('modalCreated'),
    modalExpires: document.getElementById('modalExpires'),
    modalNote: document.getElementById('modalNote'),
    closeModal: document.getElementById('closeModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    copyKeyBtn: document.getElementById('copyKeyBtn'),
    revokeKeyBtn: document.getElementById('revokeKeyBtn')
};

// ==================== State ====================
let currentKey = null;
let authToken = sessionStorage.getItem('adminToken') || null;

// ==================== API Calls ====================
async function apiCall(endpoint, data = {}) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...data, token: authToken })
    });

    return await response.json();
}

// 检查 token 是否即将过期（提前 10 分钟提示）
function checkTokenExpiry() {
    if (!authToken) return false;

    const parts = authToken.split(':');
    if (parts.length !== 3) return false;

    const timestamp = parseInt(parts[1]);
    const now = Date.now();
    const age = now - timestamp;
    const expiry = 2 * 60 * 60 * 1000; // 2 小时

    // 如果即将过期（剩余时间少于 10 分钟）
    if (age > expiry - 10 * 60 * 1000) {
        return true;
    }
    return false;
}

// ==================== Login ====================
async function login() {
    const password = elements.passwordInput.value.trim();

    if (!password) {
        showLoginError('请输入密码');
        return;
    }

    // 禁用按钮，防止重复提交
    elements.loginBtn.disabled = true;
    elements.loginBtn.textContent = '登录中...';

    try {
        // 调用新的登录 API
        const response = await fetch(CONFIG.LOGIN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (result.success) {
            // 保存 token
            authToken = result.token;
            sessionStorage.setItem('adminToken', authToken);
            sessionStorage.setItem('tokenExpiry', Date.now() + result.expiresIn);

            showAdminPanel();
            loadKeys();
            hideLoginError();
        } else {
            showLoginError(result.error || '登录失败');
            authToken = null;
            sessionStorage.removeItem('adminToken');
        }
    } catch (error) {
        showLoginError('网络错误，请稍后重试');
    } finally {
        elements.loginBtn.disabled = false;
        elements.loginBtn.textContent = '登录';
    }
}

function showLoginError(message) {
    elements.loginError.querySelector('.error-text').textContent = message;
    elements.loginError.classList.remove('hidden');
}

function hideLoginError() {
    elements.loginError.classList.add('hidden');
}

function showAdminPanel() {
    elements.loginCard.classList.add('hidden');
    elements.adminPanel.classList.remove('hidden');
}

function showLoginCard() {
    elements.adminPanel.classList.add('hidden');
    elements.loginCard.classList.remove('hidden');
    elements.passwordInput.value = '';
    hideLoginError();
}

function logout() {
    authToken = null;
    sessionStorage.removeItem('adminToken');
    showLoginCard();
}

// ==================== Key Management ====================
async function loadKeys() {
    elements.keyList.innerHTML = '<p class="loading">加载中...</p>';

    const result = await apiCall('/api/admin/list');

    if (result.success && result.data) {
        renderKeys(result.data);
    } else {
        elements.keyList.innerHTML = '<p class="loading">加载失败</p>';
    }
}

function renderKeys(keys) {
    if (keys.length === 0) {
        elements.keyList.innerHTML = '<p class="loading">暂无密钥</p>';
        return;
    }

    elements.keyList.innerHTML = keys.map(key => {
        const statusClass = key.status === 'active' ? 'active' :
                           key.usedCount >= key.maxUses ? 'used' : key.status;
        const statusText = key.status === 'active' && key.usedCount >= key.maxUses ? '已用完' :
                          key.status === 'active' ? '可用' :
                          key.status === 'revoked' ? '已吊销' :
                          key.status === 'expired' ? '已过期' : key.status;

        return `
            <div class="key-item" data-key="${key.key}" data-json='${JSON.stringify(key).replace(/'/g, "&#39;")}'>
                <div class="key-item-main">
                    <div class="key-item-key">${key.key}</div>
                    <div class="key-item-meta">${key.note || '无备注'} | ${new Date(key.createdAt).toLocaleDateString()}</div>
                </div>
                <span class="key-item-status ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');

    // 绑定点击事件
    document.querySelectorAll('.key-item').forEach(item => {
        item.addEventListener('click', () => {
            const keyData = JSON.parse(item.dataset.json.replace(/&#39;/g, "'"));
            openKeyModal(keyData);
        });
    });
}

async function generateKey() {
    const maxUses = parseInt(elements.maxUses.value) || 1;
    const expiresDays = elements.expiresDays.value ? parseInt(elements.expiresDays.value) : null;
    const note = elements.keyNote.value.trim();

    const result = await apiCall('/api/admin/generate', {
        maxUses,
        expiresDays,
        note
    });

    if (result.success && result.data) {
        hideGenerateForm();
        loadKeys();
        openKeyModal(result.data);
    } else {
        alert('生成失败: ' + (result.error || '未知错误'));
    }
}

function showGenerateForm() {
    elements.generateForm.classList.remove('hidden');
    elements.maxUses.value = '1';
    elements.expiresDays.value = '';
    elements.keyNote.value = '';
}

function hideGenerateForm() {
    elements.generateForm.classList.add('hidden');
}

async function revokeKey() {
    if (!currentKey) return;

    if (!confirm('确定要吊销此密钥吗？')) return;

    const result = await apiCall('/api/admin/revoke', { key: currentKey.key });

    if (result.success) {
        closeModal();
        loadKeys();
    } else {
        alert('吊销失败: ' + (result.error || '未知错误'));
    }
}

// ==================== Modal ====================
function openKeyModal(keyData) {
    currentKey = keyData;

    elements.modalKey.textContent = keyData.key;
    elements.modalStatus.textContent = keyData.status === 'active' ? '可用' : keyData.status;
    elements.modalUsage.textContent = `${keyData.usedCount}/${keyData.maxUses}`;
    elements.modalCreated.textContent = new Date(keyData.createdAt).toLocaleString();
    elements.modalExpires.textContent = keyData.expiresAt ?
        new Date(keyData.expiresAt).toLocaleString() : '永不过期';
    elements.modalNote.textContent = keyData.note || '无';

    // 更新吊销按钮状态
    if (keyData.status !== 'active') {
        elements.revokeKeyBtn.style.display = 'none';
    } else {
        elements.revokeKeyBtn.style.display = 'block';
    }

    elements.keyModal.classList.remove('hidden');
}

function closeModal() {
    elements.keyModal.classList.add('hidden');
    currentKey = null;
}

function copyKey() {
    if (!currentKey) return;

    navigator.clipboard.writeText(currentKey.key).then(() => {
        const originalText = elements.copyKeyBtn.textContent;
        elements.copyKeyBtn.textContent = '✓ 已复制';
        setTimeout(() => {
            elements.copyKeyBtn.textContent = originalText;
        }, 1500);
    }).catch(() => {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = currentKey.key;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        elements.copyKeyBtn.textContent = '✓ 已复制';
        setTimeout(() => {
            elements.copyKeyBtn.textContent = '📋 复制密钥';
        }, 1500);
    });
}

// ==================== Event Listeners ====================
elements.loginBtn.addEventListener('click', login);

elements.passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
});

elements.logoutBtn.addEventListener('click', logout);

elements.generateKeyBtn.addEventListener('click', showGenerateForm);

elements.cancelGenerate.addEventListener('click', hideGenerateForm);

elements.confirmGenerate.addEventListener('click', generateKey);

elements.refreshBtn.addEventListener('click', loadKeys);

elements.closeModal.addEventListener('click', closeModal);

elements.closeModalBtn.addEventListener('click', closeModal);

elements.copyKeyBtn.addEventListener('click', copyKey);

elements.revokeKeyBtn.addEventListener('click', revokeKey);

elements.keyModal.addEventListener('click', (e) => {
    if (e.target === elements.keyModal) closeModal();
});

// ==================== Init ====================
// 检查是否已登录
if (authToken) {
    // 验证token是否有效
    apiCall('/api/admin/list').then(result => {
        if (result.success) {
            showAdminPanel();
            loadKeys();

            // 检查是否即将过期
            if (checkTokenExpiry()) {
                // 显示过期提示
                const expiryWarning = document.createElement('div');
                expiryWarning.className = 'expiry-warning';
                expiryWarning.style.cssText = 'background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin-bottom: 16px; font-size: 14px;';
                expiryWarning.innerHTML = '⚠️ 登录即将过期，请重新登录以避免中断';
                elements.adminPanel.insertBefore(expiryWarning, elements.adminPanel.firstChild);
            }
        } else {
            // Token 无效或过期，清除并返回登录页
            sessionStorage.removeItem('adminToken');
            sessionStorage.removeItem('tokenExpiry');
            authToken = null;
            showLoginError('登录已过期，请重新登录');
        }
    }).catch(() => {
        // 网络错误或其他问题
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('tokenExpiry');
        authToken = null;
    });
}
