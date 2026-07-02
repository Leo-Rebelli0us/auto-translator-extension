// background/background.js
class TranslationService {
  constructor() {
    this.cache = new Map();
    this.cacheSize = 100;
    this.cacheTTL = 60 * 60 * 1000; // 1小时
  }

  async translate(text, targetLang = 'zh', sourceLang = 'auto') {
    const cacheKey = `${text}_${sourceLang}_${targetLang}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }

    try {
      const result = await this.callTranslationAPI(text, targetLang, sourceLang);

      // 更新缓存
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // 限制缓存大小
      if (this.cache.size > this.cacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return result;
    } catch (error) {
      console.error('翻译失败:', error);
      throw error;
    }
  }

  async callTranslationAPI(text, targetLang, sourceLang) {
    const src = sourceLang === 'auto' ? 'autodetect' : sourceLang;
    const tgt = targetLang || 'zh';

    // 用 Google Translate 非官方接口（免费、快、支持 auto detect）
    const googlePromise = this.translateWithGoogle(text, tgt, src);

    try {
      return await googlePromise;
    } catch (e) {
      // Google 失败回退到 MyMemory
      return this.translateWithMyMemory(text, tgt, src);
    }
  }

  async translateWithGoogle(text, targetLang, sourceLang) {
    const sl = sourceLang === 'autodetect' ? 'auto' : sourceLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Google Translate 请求失败');

    const data = await response.json();
    // 响应格式: [[["翻译结果","原文",null,null,N],...],...]
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0].map(seg => seg[0]).join('');
    }
    throw new Error('Google Translate 返回格式异常');
  }

  async translateWithMyMemory(text, targetLang, sourceLang) {
    const source = sourceLang === 'autodetect' ? 'autodetect' : sourceLang;
    const target = targetLang || 'zh';
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`翻译API错误: ${response.status}`);

    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    }
    throw new Error('翻译API返回异常: ' + (data.responseDetails || '未知错误'));
  }
}

class ConfigManager {
  constructor() {
    this.defaultConfig = {
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

  async getConfig() {
    const stored = await chrome.storage.sync.get(null);
    return { ...this.defaultConfig, ...stored };
  }

  async updateConfig(updates) {
    await chrome.storage.sync.set(updates);

    // 发送配置更新通知
    chrome.runtime.sendMessage({
      type: 'configUpdated',
      updates: updates
    }).catch(() => {
      // 忽略错误（popup可能未打开）
    });
  }

  async resetConfig() {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(this.defaultConfig);

    // 发送配置重置通知
    chrome.runtime.sendMessage({
      type: 'configReset'
    }).catch(() => {
      // 忽略错误
    });

    return { success: true };
  }

  async resetToDefaults() {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set(this.defaultConfig);
  }
}

// 全局实例
const translationService = new TranslationService();
const configManager = new ConfigManager();

// 消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'translate') {
    translationService.translate(request.text, request.targetLang, request.sourceLang)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开放
  }

  if (request.type === 'getConfig') {
    configManager.getConfig()
      .then(config => sendResponse({ success: true, config }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'updateConfig') {
    configManager.updateConfig(request.updates)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.type === 'resetConfig') {
    configManager.resetConfig()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  // 初始化配置
  configManager.getConfig().then(config => {
    console.log('翻译插件已安装，配置:', config);
  });

  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻译选中文本',
    contexts: ['selection']
  });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    // 获取选中文本并翻译，添加错误处理避免 "Receiving end does not exist"
    chrome.tabs.sendMessage(tab.id, {
      type: 'contextMenuTranslate',
      text: info.selectionText
    }).catch(() => {
      // 目标页面没有加载 content script（如 chrome:// 页面），忽略错误
      console.log('无法发送消息到页面，可能页面未加载翻译脚本');
    });
  }
});

// 导出以供测试
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationService, ConfigManager };
}