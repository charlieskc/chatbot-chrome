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
          console.error('Send message error:', error);
          this.addMessage(`Error: ${error.message || 'Unable to get response'}`, 'error');
          if (error.details) {
              this.addMessage(`Details: ${error.details}`, 'error');
          }
      }

      this.hideLoading();
  }

  async summarizeContent() {
      try {
          // Get the main content of the page
          const content = this.getPageContent();
          
          // Limit and clean the content
          const truncatedContent = content.substring(0, 4000); // Limiting to 4000 characters
          
          // Show the extracted content in the chat
          this.addMessage('Extracted content from the page:', 'system');
          this.addMessage(truncatedContent, 'user');
          
          const prompt = `Please provide a concise summary of the following webpage content in 3-4 key points: ${truncatedContent}`;
          
          this.addMessage('Generating summary...', 'system');
          this.showLoading();
          
          const response = await this.callAIAPI(prompt);
          this.addMessage('Summary:', 'system');
          this.addMessage(response, 'ai');
      } catch (error) {
          console.error('Summarization error:', error);
          this.addMessage(`Error: ${error.message || 'Unable to summarize content'}`, 'error');
          if (error.details) {
              this.addMessage(`Details: ${error.details}`, 'error');
          }
      } finally {
          this.hideLoading();
      }
  }

  getPageContent() {
      // Create a copy of the body content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = document.body.innerHTML;

      // Remove unwanted elements
      const elementsToRemove = [
          'script',
          'style',
          'iframe',
          'nav',
          'footer',
          'header',
          'aside',
          'noscript',
          'img',
          'svg',
          'canvas',
          'video',
          'audio'
      ];

      elementsToRemove.forEach(tag => {
          const elements = tempDiv.getElementsByTagName(tag);
          while (elements[0]) {
              elements[0].parentNode.removeChild(elements[0]);
          }
      });

      // Get text content and clean it
      let content = tempDiv.textContent || tempDiv.innerText;
      
      // Clean the content
      content = content
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .replace(/\n+/g, ' ') // Replace multiple newlines with space
          .trim(); // Remove leading/trailing spaces

      return content;
  }

  async callAIAPI(content) {
      if (!this.bearerToken) {
          throw {
              message: 'Bearer token not set',
              details: 'Please set your bearer token in the extension settings.'
          };
      }

      try {
          this.addMessage('Making API request...', 'system');
          
          const requestBody = {
              model: 'gpt-4-turbo',
              messages: [{ role: 'user', content }],
              temperature: 0
          };

          // Log the request details
          this.addMessage('Request details:', 'system');
          this.addMessage(`Endpoint: https://aigateway-dev.ms.com/openai/v1/chat/completions`, 'debug');
          this.addMessage(`Request body: ${JSON.stringify(requestBody, null, 2)}`, 'debug');

          const response = await fetch('https://aigateway-dev.ms.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                  'accept': 'application/json',
                  'Unique-Id': crypto.randomUUID(),
                  'Authorization': `Bearer ${this.bearerToken}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
          });

          const responseData = await response.json();

          // Log the response
          this.addMessage('Response received:', 'system');
          this.addMessage(`Status: ${response.status} ${response.statusText}`, 'debug');
          this.addMessage(`Response data: ${JSON.stringify(responseData, null, 2)}`, 'debug');

          if (!response.ok) {
              throw {
                  message: 'API request failed',
                  details: `Status ${response.status}: ${responseData.error?.message || response.statusText}`
              };
          }

          if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
              throw {
                  message: 'Invalid response format',
                  details: 'The API response did not contain the expected data structure.'
              };
          }

          return responseData.choices[0].message.content;
      } catch (error) {
          console.error('API call error:', error);
          if (error instanceof TypeError) {
              throw {
                  message: 'Network error',
                  details: 'Failed to connect to the API. Please check your internet connection.'
              };
          }
          throw {
              message: error.message || 'API call failed',
              details: error.details || 'An unexpected error occurred while calling the AI service.'
          };
      }
  }

  addMessage(content, type) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${type}-message`;
      
      // For debug messages, use a monospace font and preserve formatting
      if (type === 'debug') {
          messageDiv.style.whiteSpace = 'pre-wrap';
          messageDiv.style.fontFamily = 'monospace';
          messageDiv.style.fontSize = '0.9em';
      }
      
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

// Initialize the chatbot
new AIChatbot();
