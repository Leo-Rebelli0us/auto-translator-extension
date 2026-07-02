// popup/popup.js
class PopupController {
  constructor() {
    this.translationStartTime = null;
    this.init();
  }

  async init() {
    this.cacheElements();
    this.loadConfig();
    this.setupEventListeners();
    this.checkAPIStatus();
  }

  cacheElements() {
    this.elements = {
      sourceLang: document.getElementById('source-lang'),
      targetLang: document.getElementById('target-lang'),
      originalText: document.getElementById('original-text'),
      translatedText: document.getElementById('translated-text'),
      translateBtn: document.getElementById('translate-btn'),
      swapBtn: document.getElementById('swap-languages'),
      copyBtn: document.getElementById('copy-translation'),
      speakBtn: document.getElementById('speak-translation'),
      clearBtn: document.getElementById('clear-original'),
      autoTranslateToggle: document.getElementById('auto-translate-toggle'),
      showPopupToggle: document.getElementById('show-popup-toggle'),
      settingsBtn: document.getElementById('settings-btn'),
      viewHistory: document.getElementById('view-history'),
      originalCharCount: document.getElementById('original-char-count'),
      translationStatus: document.getElementById('translation-status'),
      translationTime: document.getElementById('translation-time'),
      apiStatus: document.getElementById('api-status')
    };
  }

  async loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getConfig' });

      if (response.success) {
        this.config = response.config;
        this.updateUIFromConfig();
      }
    } catch (error) {
      console.error('加载配置失败:', error);
      this.config = this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      apiService: 'libretranslate',
      apiEndpoint: 'https://libretranslate.com/translate',
      apiKey: '',
      sourceLanguage: 'auto',
      targetLanguage: 'zh',
      autoTranslateEnabled: true,
      showPopup: true,
      cacheEnabled: true,
      contextMenuEnabled: true,
      shortcutsEnabled: true
    };
  }

  updateUIFromConfig() {
    if (this.config.sourceLanguage) {
      this.elements.sourceLang.value = this.config.sourceLanguage;
    }

    if (this.config.targetLanguage) {
      this.elements.targetLang.value = this.config.targetLanguage;
    }

    if (this.config.autoTranslateEnabled !== undefined) {
      this.elements.autoTranslateToggle.checked = this.config.autoTranslateEnabled;
    }

    if (this.config.showPopup !== undefined) {
      this.elements.showPopupToggle.checked = this.config.showPopup;
    }
  }

  setupEventListeners() {
    // 翻译按钮
    this.elements.translateBtn.addEventListener('click', () => {
      this.translateText();
    });

    // 交换语言
    this.elements.swapBtn.addEventListener('click', () => {
      this.swapLanguages();
    });

    // 复制翻译结果
    this.elements.copyBtn.addEventListener('click', () => {
      this.copyTranslation();
    });

    // 发音
    this.elements.speakBtn.addEventListener('click', () => {
      this.speakTranslation();
    });

    // 清空原文
    this.elements.clearBtn.addEventListener('click', () => {
      this.clearOriginalText();
    });

    // 原文输入监听
    this.elements.originalText.addEventListener('input', (e) => {
      this.updateCharCount(e.target.value);
      this.elements.translateBtn.disabled = !e.target.value.trim();
    });

    // 设置切换
    this.elements.autoTranslateToggle.addEventListener('change', (e) => {
      this.saveConfig({ autoTranslateEnabled: e.target.checked });
    });

    this.elements.showPopupToggle.addEventListener('change', (e) => {
      this.saveConfig({ showPopup: e.target.checked });
    });

    // 语言选择变化
    this.elements.sourceLang.addEventListener('change', (e) => {
      this.saveConfig({ sourceLanguage: e.target.value });
    });

    this.elements.targetLang.addEventListener('change', (e) => {
      this.saveConfig({ targetLanguage: e.target.value });
    });

    // 设置按钮
    this.elements.settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 查看历史
    this.elements.viewHistory.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('查看翻译历史');
    });

    // 监听来自content script的消息（如果有选中文本）
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'selectedText') {
        this.elements.originalText.value = request.text;
        this.updateCharCount(request.text);
        this.elements.translateBtn.disabled = false;
        this.translateText();
      }
    });

    // 检查剪贴板中的文本
    this.checkClipboard();
  }

  async translateText() {
    const text = this.elements.originalText.value.trim();
    if (!text) return;

    const sourceLang = this.elements.sourceLang.value;
    const targetLang = this.elements.targetLang.value;

    this.setTranslationStatus('翻译中...');
    this.elements.translateBtn.disabled = true;
    this.translationStartTime = Date.now();

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'translate',
        text: text,
        targetLang: targetLang,
        sourceLang: sourceLang
      });

      if (response.success) {
        this.showTranslationResult(response.result);
        this.updateTranslationTime();
        this.setTranslationStatus('翻译完成');
        this.checkAPIStatus();
      } else {
        this.showError(`翻译失败: ${response.error}`);
        this.setTranslationStatus('翻译失败');
      }
    } catch (error) {
      this.showError(`请求失败: ${error.message}`);
      this.setTranslationStatus('网络错误');
    } finally {
      this.elements.translateBtn.disabled = false;
    }
  }

  showTranslationResult(text) {
    const translatedElement = this.elements.translatedText;
    translatedElement.innerHTML = '';
    translatedElement.textContent = text;
  }

  showError(message) {
    const translatedElement = this.elements.translatedText;
    translatedElement.innerHTML = `
      <div style="color: #f44336; padding: 8px; background: #ffebee; border-radius: 4px;">
        ${message}
      </div>
    `;
  }

  updateTranslationTime() {
    if (this.translationStartTime) {
      const elapsed = Date.now() - this.translationStartTime;
      this.elements.translationTime.textContent = `${elapsed}ms`;
    }
  }

  setTranslationStatus(status) {
    this.elements.translationStatus.textContent = status;
  }

  swapLanguages() {
    const sourceLang = this.elements.sourceLang.value;
    const targetLang = this.elements.targetLang.value;

    // 交换值
    this.elements.sourceLang.value = targetLang;
    this.elements.targetLang.value = sourceLang;

    // 保存配置
    this.saveConfig({
      sourceLanguage: targetLang,
      targetLanguage: sourceLang
    });

    // 如果有文本，重新翻译
    const text = this.elements.originalText.value.trim();
    if (text && this.elements.translatedText.textContent !== '') {
      this.translateText();
    }
  }

  async copyTranslation() {
    const text = this.elements.translatedText.textContent;
    if (!text || text.includes('翻译结果将显示在这里')) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.showToast('翻译结果已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      this.showToast('复制失败，请手动复制');
    }
  }

  speakTranslation() {
    const text = this.elements.translatedText.textContent;
    if (!text || text.includes('翻译结果将显示在这里')) {
      return;
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = this.elements.targetLang.value;
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      this.showToast('浏览器不支持文本转语音功能');
    }
  }

  clearOriginalText() {
    this.elements.originalText.value = '';
    this.elements.translatedText.innerHTML = '<div class="placeholder">翻译结果将显示在这里...</div>';
    this.updateCharCount('');
    this.elements.translateBtn.disabled = true;
    this.elements.translationTime.textContent = '';
    this.setTranslationStatus('就绪');
  }

  updateCharCount(text) {
    const count = text.length;
    this.elements.originalCharCount.textContent = count;
  }

  async saveConfig(updates) {
    try {
      await chrome.runtime.sendMessage({
        type: 'updateConfig',
        updates: updates
      });

      // 更新本地配置
      this.config = { ...this.config, ...updates };
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }

  async checkAPIStatus() {
    try {
      const testResponse = await fetch('https://libretranslate.com/languages');

      if (testResponse.ok) {
        this.setAPIStatus(true, 'API连接正常');
      } else {
        this.setAPIStatus(false, 'API连接异常');
      }
    } catch (error) {
      this.setAPIStatus(false, '网络连接失败');
    }
  }

  setAPIStatus(isOnline, message) {
    const statusDot = this.elements.apiStatus.querySelector('.status-dot');
    const statusText = this.elements.apiStatus.querySelector('.status-text');

    if (isOnline) {
      statusDot.style.backgroundColor = '#4caf50';
      statusText.textContent = message;
      statusText.style.color = '#666';
    } else {
      statusDot.style.backgroundColor = '#f44336';
      statusText.textContent = message;
      statusText.style.color = '#f44336';
    }
  }

  showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  async checkClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim() && !this.elements.originalText.value) {
        this.showPasteSuggestion(text);
      }
    } catch (error) {
      // 权限被拒绝或其他错误，忽略
    }
  }

  showPasteSuggestion(text) {
    const suggestion = document.createElement('div');
    suggestion.innerHTML = `
      <div style="padding: 8px; background: #e3f2fd; border-radius: 4px; margin-top: 8px; font-size: 12px;">
        检测到剪贴板中有文本，点击<span style="color: #2196f3; cursor: pointer; text-decoration: underline;">这里</span>粘贴并翻译
      </div>
    `;

    const clickable = suggestion.querySelector('span');
    clickable.addEventListener('click', () => {
      this.elements.originalText.value = text;
      this.updateCharCount(text);
      this.elements.translateBtn.disabled = false;
      suggestion.remove();
    });

    this.elements.originalText.parentNode.insertBefore(suggestion, this.elements.originalText.nextSibling);

    setTimeout(() => {
      if (suggestion.parentNode) {
        suggestion.remove();
      }
    }, 10000);
  }
}

// 初始化弹出窗口
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
});
