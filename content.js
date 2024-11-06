class AIChatbot {
  constructor() {
    this.createUI();
    this.bearerToken = '';
    this.loadToken();
    this.setupEventListeners();
  }

  createUI() {
    const sidebar = document.createElement('div');
    sidebar.className = 'ai-chatbot-sidebar';
    sidebar.innerHTML = `
      <div class="chatbot-header">
        <h3>AI Chatbot</h3>
        <button class="close-button">&times;</button>
      </div>
      <div class="chat-container"></div>
      <div class="loading-spinner"></div>
      <div class="input-container">
        <textarea class="chat-input" placeholder="Type your message..."></textarea>
        <button class="send-button">Send</button>
        <button class="summarize-button">Summarize</button>
      </div>
    `;

    const toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-button';
    toggleButton.innerHTML = '💬';

    document.body.appendChild(sidebar);
    document.body.appendChild(toggleButton);

    this.sidebar = sidebar;
    this.toggleButton = toggleButton;
    this.chatContainer = sidebar.querySelector('.chat-container');
    this.chatInput = sidebar.querySelector('.chat-input');
    this.loadingSpinner = sidebar.querySelector('.loading-spinner');
  }

  setupEventListeners() {
    this.toggleButton.addEventListener('click', () => this.toggleSidebar());
    this.sidebar.querySelector('.close-button').addEventListener('click', () => this.toggleSidebar());
    this.sidebar.querySelector('.send-button').addEventListener('click', () => this.sendMessage());
    this.sidebar.querySelector('.summarize-button').addEventListener('click', () => this.summarizeContent());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  toggleSidebar() {
    this.sidebar.classList.toggle('visible');
  }

  async loadToken() {
    const result = await chrome.storage.local.get(['bearerToken']);
    this.bearerToken = result.bearerToken || '';
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    this.addMessage(message, 'user');
    this.chatInput.value = '';
    this.showLoading();

    try {
      const response = await this.callAIAPI(message);
      this.addMessage(response, 'ai');
    } catch (error) {
      this.addMessage('Error: Unable to get response', 'ai');
    }

    this.hideLoading();
  }

  async summarizeContent() {
    const content = document.body.innerText;
    const prompt = `Please summarize the following content: ${content.substring(0, 3000)}...`;
    
    this.showLoading();
    try {
      const response = await this.callAIAPI(prompt);
      this.addMessage('Page Summary:', 'user');
      this.addMessage(response, 'ai');
    } catch (error) {
      this.addMessage('Error: Unable to summarize content', 'ai');
    }
    this.hideLoading();
  }

  async callAIAPI(content) {
    if (!this.bearerToken) {
      throw new Error('Bearer token not set');
    }

    const response = await fetch('https://aigateway-dev.ms.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Unique-Id': crypto.randomUUID(),
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content }],
        temperature: 0
      })
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    messageDiv.textContent = content;
    this.chatContainer.appendChild(messageDiv);
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  showLoading() {
    this.loadingSpinner.style.display = 'block';
  }

  hideLoading() {
    this.loadingSpinner.style.display = 'none';
  }
}

new AIChatbot();