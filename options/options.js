// options/options.js
class OptionsController {
  constructor() {
    this.currentConfig = null;
    this.init();
  }

  async init() {
    this.cacheElements();
    await this.loadConfig();
    this.setupEventListeners();
  }

  cacheElements() {
    this.elements = {
      form: document.getElementById('settings-form'),
      apiService: document.getElementById('api-service'),
      apiEndpoint: document.getElementById('api-endpoint'),
      apiKey: document.getElementById('api-key'),
      targetLanguage: document.getElementById('target-language'),
      autoTranslate: document.getElementById('auto-translate'),
      showPopup: document.getElementById('show-popup'),
      cacheEnabled: document.getElementById('cache-enabled'),
      contextMenuEnabled: document.getElementById('context-menu-enabled'),
      shortcutsEnabled: document.getElementById('shortcuts-enabled'),
      debounceDelay: document.getElementById('debounce-delay'),
      cacheSize: document.getElementById('cache-size'),
      testApiBtn: document.getElementById('test-api-btn'),
      saveBtn: document.getElementById('save-btn'),
      resetBtn: document.getElementById('reset-btn'),
      statusMessage: document.getElementById('status-message'),
      apiStatus: document.getElementById('api-status')
    };
  }

  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getConfig' });

      if (response.success) {
        this.currentConfig = response.config;
        this.populateForm(this.currentConfig);
        this.showStatus('配置已加载', 'success');
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      this.showStatus('加载配置失败: ' + error.message, 'error');
    }
  }

  populateForm(config) {
    // API设置
    this.elements.apiService.value = config.apiService || 'libretranslate';
    this.elements.apiEndpoint.value = config.apiEndpoint || 'https://libretranslate.com/translate';
    this.elements.apiKey.value = config.apiKey || '';
    this.elements.targetLanguage.value = config.targetLanguage || 'zh';

    // 功能开关
    this.elements.autoTranslate.checked = config.autoTranslateEnabled !== false;
    this.elements.showPopup.checked = config.showPopup !== false;
    this.elements.cacheEnabled.checked = config.cacheEnabled !== false;
    this.elements.contextMenuEnabled.checked = config.contextMenuEnabled !== false;
    this.elements.shortcutsEnabled.checked = config.shortcutsEnabled !== false;

    // 高级设置
    this.elements.debounceDelay.value = config.debounceDelay || 300;
    this.elements.cacheSize.value = config.cacheSize || 100;

    // 根据选择的API服务更新端点
    this.updateApiEndpoint();
  }

  getFormData() {
    return {
      apiService: this.elements.apiService.value,
      apiEndpoint: this.elements.apiEndpoint.value,
      apiKey: this.elements.apiKey.value,
      targetLanguage: this.elements.targetLanguage.value,
      autoTranslateEnabled: this.elements.autoTranslate.checked,
      showPopup: this.elements.showPopup.checked,
      cacheEnabled: this.elements.cacheEnabled.checked,
      contextMenuEnabled: this.elements.contextMenuEnabled.checked,
      shortcutsEnabled: this.elements.shortcutsEnabled.checked,
      debounceDelay: parseInt(this.elements.debounceDelay.value) || 300,
      cacheSize: parseInt(this.elements.cacheSize.value) || 100
    };
  }

  setupEventListeners() {
    // 保存按钮
    this.elements.saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.saveConfig();
    });

    // 重置按钮
    this.elements.resetBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('确定要恢复默认设置吗？所有自定义设置将会丢失。')) {
        await this.resetToDefaults();
      }
    });

    // API测试按钮
    this.elements.testApiBtn.addEventListener('click', async () => {
      await this.testApiConnection();
    });

    // API服务选择变化
    this.elements.apiService.addEventListener('change', () => {
      this.updateApiEndpoint();
    });

    // 表单输入变化
    this.elements.form.addEventListener('input', () => {
      this.elements.saveBtn.disabled = false;
    });

    this.elements.form.addEventListener('change', () => {
      this.elements.saveBtn.disabled = false;
    });
  }

  updateApiEndpoint() {
    const service = this.elements.apiService.value;

    switch (service) {
      case 'libretranslate':
        this.elements.apiEndpoint.value = 'https://libretranslate.com/translate';
        this.elements.apiEndpoint.placeholder = 'https://libretranslate.com/translate';
        break;
      case 'google':
        this.elements.apiEndpoint.value = 'https://translation.googleapis.com/language/translate/v2';
        this.elements.apiEndpoint.placeholder = 'https://translation.googleapis.com/language/translate/v2';
        break;
      case 'deepl':
        this.elements.apiEndpoint.value = 'https://api-free.deepl.com/v2/translate';
        this.elements.apiEndpoint.placeholder = 'https://api-free.deepl.com/v2/translate';
        break;
    }
  }

  async saveConfig() {
    const formData = this.getFormData();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'updateConfig',
        updates: formData
      });

      if (response && response.success) {
        this.currentConfig = { ...this.currentConfig, ...formData };
        this.elements.saveBtn.disabled = true;
        this.showStatus('设置已保存', 'success');

        setTimeout(() => this.loadConfig(), 1000);
      } else {
        this.showStatus('保存失败: ' + (response?.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      this.showStatus('保存失败: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'resetConfig'
      });

      if (response && response.success) {
        await this.loadConfig();
        this.showStatus('已恢复默认设置', 'success');
      } else {
        this.showStatus('恢复默认设置失败', 'error');
      }
    } catch (error) {
      console.error('恢复默认设置失败:', error);
      this.showStatus('恢复默认设置失败: ' + error.message, 'error');
    }
  }

  async testApiConnection() {
    const formData = this.getFormData();
    const testText = 'Hello';

    this.showApiStatus('测试中...', 'testing');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'translate',
        text: testText,
        targetLang: formData.targetLanguage,
        sourceLang: 'auto'
      });

      if (response.success) {
        this.showApiStatus('API连接正常', 'online');
        this.showStatus('API连接测试成功', 'success');
      } else {
        this.showApiStatus('API连接失败: ' + response.error, 'offline');
        this.showStatus('API连接测试失败: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('API测试失败:', error);
      this.showApiStatus('网络连接失败', 'offline');
      this.showStatus('API测试失败: ' + error.message, 'error');
    }
  }

  showApiStatus(message, status) {
    this.elements.apiStatus.style.display = 'flex';

    const statusDot = this.elements.apiStatus.querySelector('.status-dot');
    const statusText = this.elements.apiStatus.querySelector('.status-text');

    statusText.textContent = message;

    if (status === 'online') {
      statusDot.className = 'status-dot online';
      statusText.style.color = '#2e7d32';
    } else if (status === 'offline') {
      statusDot.className = 'status-dot offline';
      statusText.style.color = '#f44336';
    } else {
      statusDot.className = 'status-dot';
      statusText.style.color = '#666';
    }
  }

  showStatus(message, type) {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message ${type}`;

    setTimeout(() => {
      this.elements.statusMessage.className = 'status-message';
    }, 3000);
  }
}

// 初始化选项页面
document.addEventListener('DOMContentLoaded', () => {
  const controller = new OptionsController();
});
