// content_scripts/content.js
class TextSelectionHandler {
  constructor() {
    this.lastSelection = '';
    this.popup = null;
    this.isPopupVisible = false;
    this.triggerBtn = null;
    this.config = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.btnClicked = false; // 标记按钮是否刚被点击过
  }

  init() {
    this.loadConfig();

    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === 'configUpdated') {
        this.config = { ...this.config, ...request.updates };
      }
      if (request.type === 'contextMenuTranslate') {
        this.requestTranslation(request.text);
      }
    });

    // 鼠标松开时才判断是否显示触发按钮
    document.addEventListener('mouseup', (e) => {
      if (!this.isContextValid()) return;

      // 如果刚点了翻译按钮，跳过本次
      if (this.btnClicked) {
        this.btnClicked = false;
        return;
      }

      this.mouseX = e.pageX;
      this.mouseY = e.pageY;

      // 弹窗已显示时不重新生成按钮
      if (this.isPopupVisible) return;

      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText && selectedText.length > 0) {
          this.lastSelection = selectedText;
          this.showTriggerBtn();
        }
      }, 10);
    });

    // 点击页面空白处关闭弹窗和按钮
    document.addEventListener('mousedown', (e) => {
      // 弹窗内部点击不关闭
      if (this.isPopupVisible && this.popup && this.popup.contains(e.target)) return;
      // 翻译按钮点击不关闭
      if (this.triggerBtn && this.triggerBtn.contains(e.target)) return;

      this.hideTriggerBtn();
      if (this.isPopupVisible) {
        this.hidePopup();
        this.lastSelection = '';
      }
    });

    console.log('划词翻译内容脚本已初始化');
  }

  isContextValid() {
    try {
      return !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  loadConfig() {
    if (!this.isContextValid()) {
      this.config = this.getDefaultConfig();
      return;
    }
    chrome.runtime.sendMessage({ type: 'getConfig' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        this.config = this.getDefaultConfig();
        return;
      }
      this.config = response.config;
    });
  }

  getDefaultConfig() {
    return {
      autoTranslateEnabled: true,
      showPopup: true,
      targetLanguage: 'zh',
      sourceLanguage: 'auto'
    };
  }

  getConfig() {
    if (this.config) return Promise.resolve(this.config);
    return new Promise(resolve => {
      if (!this.isContextValid()) {
        resolve(this.getDefaultConfig());
        return;
      }
      chrome.runtime.sendMessage({ type: 'getConfig' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          resolve(this.getDefaultConfig());
          return;
        }
        this.config = response.config;
        resolve(response.config);
      });
    });
  }

  showTriggerBtn() {
    this.hideTriggerBtn();

    this.triggerBtn = document.createElement('div');
    this.triggerBtn.className = 'translate-trigger-btn';
    this.triggerBtn.innerHTML = `
      <svg class="trigger-star" viewBox="0 0 24 24" width="22" height="22">
        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5Z" fill="#4A90D9"/>
      </svg>
      <span class="trigger-text">译</span>
    `;
    // 显示在选中文本的右上角
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      this.triggerBtn.style.left = `${rect.right + window.scrollX + 4}px`;
      this.triggerBtn.style.top = `${rect.top + window.scrollY}px`;
    } else {
      this.triggerBtn.style.left = `${this.mouseX + 8}px`;
      this.triggerBtn.style.top = `${this.mouseY + 8}px`;
    }

    // mousedown 阶段就设置标记，阻止 mouseup 重新生成按钮
    this.triggerBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.btnClicked = true;
    });

    this.triggerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = this.lastSelection;
      if (text) {
        this.hideTriggerBtn();
        this.requestTranslation(text);
      }
    });

    document.body.appendChild(this.triggerBtn);
  }

  hideTriggerBtn() {
    if (this.triggerBtn && this.triggerBtn.parentNode) {
      this.triggerBtn.parentNode.removeChild(this.triggerBtn);
      this.triggerBtn = null;
    }
  }

  async requestTranslation(text) {
    if (!this.isContextValid()) return;

    const config = await this.getConfig();
    this.showLoadingPopup(text, config);

    chrome.runtime.sendMessage({
      type: 'translate',
      text: text,
      targetLang: config.targetLanguage,
      sourceLang: config.sourceLanguage
    }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.success) {
        this.updatePopupWithResult(response.result, config);
      } else {
        this.updatePopupWithError(response ? response.error : '翻译失败');
      }
    });
  }

  showLoadingPopup(originalText, config) {
    const srcLabel = config.sourceLanguage === 'auto' ? 'AUTO' : config.sourceLanguage.toUpperCase();
    const tgtLabel = (config.targetLanguage || 'zh').toUpperCase();

    if (this.isPopupVisible && this.popup) {
      const originalDiv = this.popup.querySelector('.original-text .text-content');
      if (originalDiv) originalDiv.textContent = originalText;
      const langTag = this.popup.querySelector('.lang-tag');
      if (langTag) langTag.textContent = `${srcLabel} → ${tgtLabel}`;
      const translatedDiv = this.popup.querySelector('.translated-text .text-content');
      if (translatedDiv) {
        translatedDiv.textContent = '翻译中...';
        translatedDiv.classList.add('loading-text');
      }
      const oldBtns = this.popup.querySelector('.action-buttons');
      if (oldBtns) oldBtns.remove();
      this.positionPopup();
      return;
    }

    this.hidePopup();

    this.popup = document.createElement('div');
    this.popup.className = 'translation-popup';
    this.popup.innerHTML = `
      <button class="popup-close">&times;</button>
      <div class="original-line">
        <span class="original-text"><span class="text-content">${this.escapeHtml(originalText)}</span></span>
        <span class="lang-tag">${srcLabel} → ${tgtLabel}</span>
      </div>
      <div class="translated-text">
        <div class="text-content loading-text">翻译中...</div>
      </div>
    `;

    this.positionPopup();

    this.popup.querySelector('.popup-close').addEventListener('click', () => this.hidePopup());
    document.body.appendChild(this.popup);
    this.isPopupVisible = true;
  }

  positionPopup() {
    if (!this.popup) return;

    // 先显示才能拿到宽高
    this.popup.style.visibility = 'hidden';
    this.popup.style.left = '0px';
    this.popup.style.top = '0px';

    // 在下一帧计算位置
    requestAnimationFrame(() => {
      if (!this.popup) return;

      const pw = this.popup.offsetWidth;
      const ph = this.popup.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // 获取选中文本右上角位置（和图标同一位置）
      let anchorX, anchorY;
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        anchorX = rect.right + window.scrollX;
        anchorY = rect.top + window.scrollY;
      } else {
        anchorX = this.mouseX;
        anchorY = this.mouseY;
      }

      // 默认在锚点右下方
      let x = anchorX + 4;
      let y = anchorY + 4;

      // 右边超出 → 放到锚点左边
      if (x + pw > window.scrollX + vw) {
        x = anchorX - pw - 4;
      }
      // 下方超出 → 放到锚点上方
      if (y + ph > window.scrollY + vh) {
        y = anchorY - ph - 4;
      }
      // 左边兜底
      if (x < window.scrollX) x = window.scrollX + 4;
      // 上边兜底
      if (y < window.scrollY) y = window.scrollY + 4;

      this.popup.style.left = `${x}px`;
      this.popup.style.top = `${y}px`;
      this.popup.style.visibility = '';
    });
  }

  updatePopupWithResult(translatedText, config) {
    if (!this.popup) return;

    const translatedDiv = this.popup.querySelector('.translated-text .text-content');
    if (translatedDiv) {
      translatedDiv.textContent = translatedText;
      translatedDiv.classList.remove('loading-text');
    }

    if (!this.popup.querySelector('.action-buttons')) {
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'action-buttons';
      buttonsDiv.innerHTML = `
        <button class="action-btn copy-btn">复制</button>
        <button class="action-btn speak-btn">发音</button>
      `;
      this.popup.appendChild(buttonsDiv);

      buttonsDiv.querySelector('.copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(translatedText);
      });

      buttonsDiv.querySelector('.speak-btn').addEventListener('click', () => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(translatedText);
          utterance.lang = config.targetLanguage;
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      });
    }
  }

  updatePopupWithError(errorMsg) {
    if (!this.popup) return;
    const translatedDiv = this.popup.querySelector('.translated-text .text-content');
    if (translatedDiv) {
      translatedDiv.innerHTML = `<span style="color: #f44336;">${this.escapeHtml(errorMsg || '翻译失败')}</span>`;
      translatedDiv.classList.remove('loading-text');
    }
  }

  hidePopup() {
    if (this.popup && this.popup.parentNode) {
      this.popup.parentNode.removeChild(this.popup);
      this.popup = null;
      this.isPopupVisible = false;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const handler = new TextSelectionHandler();
handler.init();
