// ==================== Configuration ====================
const CONFIG = {
    // 后端 API 地址
    // 本地开发: '/api/verify'
    // 生产环境: 改为你的服务器地址，如 'https://your-domain.com/api/verify'
    API_URL: '/api/verify',

    // 演示模式：true = 使用模拟数据（无需后端），false = 连接真实 API
    // 启动服务器后，将此值改为 false
    DEMO_MODE: false,

    // 演示用的有效密钥（仅用于测试）
    DEMO_KEYS: ['DEMO-1234-5678-ABCD']
};

// ==================== DOM Elements ====================
const elements = {
    keyInput: document.getElementById('keyInput'),
    verifyBtn: document.getElementById('verifyBtn'),
    btnText: document.querySelector('.btn-text'),
    btnLoading: document.querySelector('.btn-loading'),
    errorMessage: document.getElementById('errorMessage'),
    errorText: document.querySelector('.error-text'),
    contactLink: document.getElementById('contactLink')
};

// ==================== Key Validation ====================
function isValidKeyFormat(key) {
    // 支持 XXXX-XXXX-XXXX-XXXX 格式（X为字母或数字）
    const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
    return pattern.test(key);
}

function formatKey(input) {
    // 自动转换为大写并添加连字符
    let value = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length > 4) {
        value = value.slice(0, 4) + '-' + value.slice(4);
    }
    if (value.length > 9) {
        value = value.slice(0, 9) + '-' + value.slice(9);
    }
    if (value.length > 14) {
        value = value.slice(0, 14) + '-' + value.slice(14);
    }
    return value.slice(0, 19);
}

// ==================== API Call ====================
async function verifyKey(key) {
    if (CONFIG.DEMO_MODE) {
        // 演示模式：模拟 API 延迟
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (CONFIG.DEMO_KEYS.includes(key)) {
            return { success: true };
        }
        return { success: false, error: '密钥无效或已过期' };
    }

    // 生产模式：调用真实 API
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key })
        });

        const data = await response.json();
        return data;
    } catch (error) {
        return { success: false, error: '网络连接失败，请稍后重试' };
    }
}

// ==================== UI Functions ====================
function showLoading(isLoading) {
    elements.verifyBtn.disabled = isLoading;
    elements.btnText.classList.toggle('hidden', isLoading);
    elements.btnLoading.classList.toggle('hidden', !isLoading);
}

function showError(message) {
    elements.errorText.textContent = message;
    elements.errorMessage.classList.remove('hidden');
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}

function goToDownloadPage(key) {
    // 保存验证状态
    sessionStorage.setItem('verifiedKey', key);
    sessionStorage.setItem('verifiedAt', Date.now().toString());
    // 跳转到下载页
    window.location.href = 'download.html';
}

// ==================== Event Handlers ====================
elements.keyInput.addEventListener('input', (e) => {
    const cursorPos = e.target.selectionStart;
    const originalValue = e.target.value;
    const formatted = formatKey(originalValue);

    e.target.value = formatted;

    // 恢复光标位置
    const lengthDiff = formatted.length - originalValue.length;
    e.target.setSelectionRange(cursorPos + lengthDiff, cursorPos + lengthDiff);

    hideError();
});

elements.keyInput.addEventListener('paste', (e) => {
    setTimeout(() => {
        e.target.value = formatKey(e.target.value);
        hideError();
    }, 0);
});

elements.verifyBtn.addEventListener('click', async () => {
    const key = elements.keyInput.value.trim();

    // 基本验证
    if (!key) {
        showError('请输入安装密钥');
        elements.keyInput.focus();
        return;
    }

    if (!isValidKeyFormat(key)) {
        showError('密钥格式不正确，应为 XXXX-XXXX-XXXX-XXXX');
        return;
    }

    // 显示加载状态
    showLoading(true);
    hideError();

    // 调用验证 API
    const result = await verifyKey(key);

    showLoading(false);

    if (result.success) {
        goToDownloadPage(key);
    } else {
        showError(result.error || '密钥验证失败，请重试');
    }
});

// 支持按 Enter 键提交
elements.keyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.verifyBtn.click();
    }
});

// ==================== Page Load ====================
// 联系链接点击事件
elements.contactLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert('联系方式：\n请发送邮件至 your@email.com 购买密钥');
});

// 页面加载完成后聚焦输入框
window.addEventListener('DOMContentLoaded', () => {
    elements.keyInput.focus();

    // 检查是否从下载页返回
    const verifiedKey = sessionStorage.getItem('verifiedKey');
    if (verifiedKey) {
        elements.keyInput.value = verifiedKey;
    }
});

// ==================== Download Page Logic ====================
// 检查是否在下载页面
if (window.location.pathname.includes('download.html') || window.location.pathname.endsWith('download')) {
    (function initDownloadPage() {
        const verifiedKey = sessionStorage.getItem('verifiedKey');
        const verifiedAt = sessionStorage.getItem('verifiedAt');

        // 验证是否已通过验证（30分钟内有效）
        if (!verifiedKey || !verifiedAt || Date.now() - parseInt(verifiedAt) > 30 * 60 * 1000) {
            alert('请先验证密钥');
            window.location.href = 'index.html';
            return;
        }

        // 设置下载链接（添加密钥参数）
        const scriptPath = 'scripts/';
        const windowsBtn = document.getElementById('downloadWindows');
        const macBtn = document.getElementById('downloadMac');
        const linuxBtn = document.getElementById('downloadLinux');

        if (windowsBtn) {
            windowsBtn.href = scriptPath + 'install-clawdbot-windows.ps1';
        }
        if (macBtn) {
            macBtn.href = scriptPath + 'install-clawdbot-macos-linux.sh';
        }
        if (linuxBtn) {
            linuxBtn.href = scriptPath + 'install-clawdbot-macos-linux.sh';
        }
    })();
}
