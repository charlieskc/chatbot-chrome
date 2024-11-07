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
            this.addMessage(`Error (${error.statusCode}): ${error.message}`, 'error');
            this.addMessage(`Details: ${error.details}`, 'error');
            if (error.responseData) {
                this.addMessage(`Full Response: ${JSON.stringify(error.responseData, null, 2)}`, 'debug');
            }
        }

        this.hideLoading();
    }

    async summarizeContent() {
        try {
            const content = this.getPageContent();
            const truncatedContent = content.substring(0, 4000);
            
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
            this.addMessage(`Error (${error.statusCode}): ${error.message}`, 'error');
            this.addMessage(`Details: ${error.details}`, 'error');
            if (error.responseData) {
                this.addMessage(`Full Response: ${JSON.stringify(error.responseData, null, 2)}`, 'debug');
            }
        } finally {
            this.hideLoading();
        }
    }

    getPageContent() {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = document.body.innerHTML;

        const elementsToRemove = [
            'script', 'style', 'iframe', 'nav', 'footer', 'header',
            'aside', 'noscript', 'img', 'svg', 'canvas', 'video', 'audio'
        ];

        elementsToRemove.forEach(tag => {
            const elements = tempDiv.getElementsByTagName(tag);
            while (elements[0]) {
                elements[0].parentNode.removeChild(elements[0]);
            }
        });

        let content = tempDiv.textContent || tempDiv.innerText;
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim();

        return content;
    }

    async callAIAPI(content) {
        if (!this.bearerToken) {
            throw {
                message: 'Bearer token not set',
                details: 'Please set your bearer token in the extension settings.',
                statusCode: 'AUTH_ERROR'
            };
        }

        try {
            this.addMessage('Making API request...', 'system');
            
            const requestBody = {
                model: 'gpt-4-turbo',
                messages: [{ role: 'user', content }],
                temperature: 0
            };

            const headers = {
                'accept': 'application/json',
                'Unique-Id': crypto.randomUUID(),
                'Authorization': `Bearer ${this.bearerToken}`,
                'Content-Type': 'application/json'
            };

            const endpoint = 'https://aigateway-dev.ms.com/openai/v1/chat/completions';

            // Log complete request details
            this.addMessage('Request details:', 'system');
            this.addMessage(`Method: POST`, 'debug');
            this.addMessage(`Endpoint: ${endpoint}`, 'debug');
            this.addMessage(`Request headers: ${JSON.stringify(headers, null, 2)}`, 'debug');
            this.addMessage(`Request body: ${JSON.stringify(requestBody, null, 2)}`, 'debug');

            // Log complete curl command for debugging
            const curlCommand = this.generateCurlCommand(endpoint, headers, requestBody);
            this.addMessage('Equivalent cURL command:', 'system');
            this.addMessage(curlCommand, 'debug');

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            const responseData = await response.json();

            // Log complete response details
            this.addMessage('Response received:', 'system');
            this.addMessage(`HTTP Status: ${response.status} (${response.statusText})`, 'debug');
            
            // Log response headers
            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            this.addMessage(`Response headers: ${JSON.stringify(responseHeaders, null, 2)}`, 'debug');
            
            // Log response body
            this.addMessage(`Response body: ${JSON.stringify(responseData, null, 2)}`, 'debug');

            if (!response.ok) {
                throw {
                    message: `HTTP Error ${response.status}`,
                    details: `Status: ${response.status} ${response.statusText}\nError: ${responseData.error?.message || 'Unknown error'}\nDetails: ${JSON.stringify(responseData.error || {}, null, 2)}`,
                    statusCode: response.status,
                    responseData: responseData
                };
            }

            if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
                throw {
                    message: 'Invalid Response Format',
                    details: `Expected 'choices' array with message content.\nReceived: ${JSON.stringify(responseData, null, 2)}`,
                    statusCode: 'INVALID_RESPONSE'
                };
            }

            return responseData.choices[0].message.content;
        } catch (error) {
            console.error('API call error:', error);
            
            if (error instanceof TypeError) {
                throw {
                    message: 'Network Error',
                    details: `Failed to connect to the API.\nError: ${error.message}`,
                    statusCode: 'NETWORK_ERROR'
                };
            }

            if (error.statusCode) {
                const statusMessages = {
                    400: 'Bad Request - The request was malformed or invalid',
                    401: 'Unauthorized - Invalid authentication credentials',
                    403: 'Forbidden - You don\'t have permission to access this resource',
                    404: 'Not Found - The requested resource was not found',
                    429: 'Too Many Requests - Rate limit exceeded',
                    500: 'Internal Server Error - Something went wrong on the server',
                    502: 'Bad Gateway - The server received an invalid response',
                    503: 'Service Unavailable - The server is temporarily unavailable',
                    504: 'Gateway Timeout - The server took too long to respond'
                };

                const statusMessage = statusMessages[error.statusCode] || `HTTP Error ${error.statusCode}`;
                throw {
                    message: statusMessage,
                    details: error.details || 'No additional details available',
                    statusCode: error.statusCode,
                    responseData: error.responseData
                };
            }

            throw {
                message: error.message || 'API Call Failed',
                details: error.details || 'An unexpected error occurred while calling the AI service',
                statusCode: 'UNKNOWN_ERROR'
            };
        }
    }

    generateCurlCommand(endpoint, headers, body) {
        const headerStrings = Object.entries(headers)
            .map(([key, value]) => `-H '${key}: ${value}'`)
            .join(' ');

        return `curl -X POST '${endpoint}' \\\n` +
               `${headerStrings} \\\n` +
               `-d '${JSON.stringify(body, null, 2)}'`;
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
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
