require('dotenv').config();

async function processImage(imageFile, form) {
  const formData = new FormData();
  formData.append('image', imageFile);

  try {
    const response = await fetch('/api/process-image', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();

    if (data.processedImageInfo) {
      form.dispatchEvent(
        new CustomEvent("imageSubmit", { detail: { message: data.processedImageInfo } })
      );
    }

    return data; // Add this line to return the data object
  } catch (error) {
    console.error('There was a problem with the fetch operation:', error);
  }
}



window.addEventListener('load', async () => {
  const form = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const conversationHistoryElement = document.getElementById('chat-messages');
  const imageInput = document.getElementById('image-input');
  const imageUploadForm = document.getElementById('image-upload-form');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const userMessage = userInput.value.trim();
    const hasImage = imageInput.files.length > 0;
    
    if (!userMessage && !hasImage) {
      return;
    }

    if (hasImage) {
      const imageFile = imageInput.files[0];
      const imageResponse = await processImage(imageFile, form);
      const imageMessage = imageResponse.processedImageInfo || '';
      const combinedMessage = userMessage + (imageMessage ? '\n' + imageMessage : '');

      await handleMessageSending(combinedMessage, userId);
    } else {
      await handleMessageSending(userMessage, userId);
    }

    userInput.value = '';
    imageInput.value = '';
  });

  const userId = document.body.dataset.userId;

  async function fetchChatHistory() {
    try {
      const response = await fetch(`/api/chatgpt/history/${userId}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      for (const { sender, message } of data.chatHistory) {
        appendMessage(message, sender);
      }
    } catch (error) {
      console.error('There was a problem with the fetch operation:', error);
    }
  }

  function appendMessage(message, sender) {
    const messageElement = document.createElement('li');
    messageElement.classList.add(sender);

    const formattedMessage = message.replace(/<br>/g, '\n');

    if (formattedMessage.includes('\n')) {
      const lines = formattedMessage.split('\n');
      for (const line of lines) {
        const lineElement = document.createElement('div');
        lineElement.textContent = line;
        messageElement.appendChild(lineElement);
      }
    } else {
      messageElement.textContent = formattedMessage;
    }

    conversationHistoryElement.appendChild(messageElement);
    conversationHistoryElement.scrollTop = conversationHistoryElement.scrollHeight;
  }

  async function handleMessageSending(userMessage, userId) {
    saveChatHistory(userId, userMessage, 'user');
    appendMessage(userMessage, 'user');

    try {
      const response = await fetch('/api/chatgpt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, userId: userId }), // Replace 'message' with 'userMessage' here
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      
      appendMessage(data.response, 'assistant');
      saveChatHistory(userId, data.response, 'assistant');
    } catch (error) {
      console.error('There was a problem with the fetch operation:', error);
    }
}

  async function saveChatHistory(userId, message, sender) {
    const response = await fetch('/api/chatgpt/history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, message, sender }),
    });

    if (!response.ok) {
      console.error('There was a problem with the fetch operation:', await response.text());
    }
  }

  // Fetch chat history when the page loads
  fetchChatHistory();
});

