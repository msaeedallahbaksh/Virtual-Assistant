require('dotenv').config();
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY);

const mysql = require('mysql2');
const path = require('path');
let fetch;

(async () => {
  fetch = await import('node-fetch').then((module) => module.default);
})();

const session = require('express-session');
const bodyParser = require('body-parser');
const FormData = require('form-data');
const express = require('express');

const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const fs = require('fs');
const Tesseract = require('tesseract.js');


const { execFile } = require('child_process');

module.exports = function (app) {
  app.set('views', path.join(__dirname, './views'));
  app.set('view engine', 'ejs');

  app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
  }));

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  const connection = mysql.createConnection({
    host: 'containers-us-west-131.railway.app',
    user: 'root',
    password: 'WedbISZYoMFlFTgX0eGR',
    port: 6383,
    database: 'railway',
    protocol: 'TCP'
  }).promise();

  function shortenConversationHistory(conversationHistory, maxLength) {
    let shortenedHistory = conversationHistory.slice();
  
    while (shortenedHistory.join(' ').length > maxLength) {
      shortenedHistory.shift();
    }
  
    return shortenedHistory;
  }

  app.get('/', function (req, res) {
    res.render('login');
  });

  app.get('/login', function (req, res) {
    res.render('login');
  });

  app.get('/register', function (req, res) {
    res.render('register');
  });

  app.get('/chat', function (req, res) {
    if (req.session.loggedin) {
      res.render('chat', { username: req.session.username, userId: req.session.userId });
    } else {
      res.send('Please login to view this page!');
      res.end();
    }
  });


  app.post('/auth', async function (req, res) {
    const username = req.body.username;
    const password = req.body.password;

    try {
      const [results] = await connection.execute('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
      console.log('Query results:', results);
      if (results.length > 0) {
        req.session.loggedin = true;
        req.session.username = username;
        req.session.userId = results[0].id;
        res.redirect('/chat');
      } else {
        res.send('Incorrect username and/or password!');
      }
      res.end();
    } catch (error) {
      console.error('Error while querying the database:', error);
      res.send('An error occurred while querying the database.');
      res.end();
    }
  });

  app.post('/register', async function (req, res) {
    const email = req.body.email;
    const username = req.body.username;
    const password = req.body.password;

    try {
      const [results] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
      if (results.length > 0) {
        res.send('Email already exists!');
      } else {
        await connection.execute('INSERT INTO users (email, username, password) VALUES (?, ?, ?)', [email, username, password]);
        res.redirect('/login');
      }
      res.end();
    } catch (error) {
      console.error('Error while querying the database:', error);
      res.send('An error occurred while querying the database.');
      res.end();
    }
  });

  app.get('/welcome', function (req, res) {
    if (req.session.loggedin) {
      res.render('welcome', { username: req.session.username });
    } else {
      res.send('Please login to view this page!');
      res.end();
    }
  });

  app.post('/api/chatgpt/history', async (req, res) => {
    console.log('Saving chat history...');
    const userId = req.body.userId;
    const message = req.body.message;
    const sender = req.body.sender;
  
    try {
      console.log("userId:", userId);
      console.log("message:", message);
      console.log("sender:", sender);

      await connection.execute('INSERT INTO chat_history (user_id, message, sender) VALUES (?, ?, ?)', [userId, message, sender]);
      res.status(200).send({ message: 'Chat history saved successfully.' });
    } catch (error) {
      console.error('Error while saving chat history:', error);
      res.status(500).send({ error: 'An error occurred while saving chat history.' });
    }
  });
  

  app.get('/api/chatgpt/history/:userId', async (req, res) => {
    const userId = req.params.userId; // Replace this with the user ID from the URL parameter

    try {
      const [results] = await connection.execute('SELECT * FROM chat_history WHERE user_id = ? ORDER BY id ASC', [userId]);
      res.status(200).send({ chatHistory: results });
    } catch (error) {
      console.error('Error while retrieving chat history:', error);
      res.status(500).send({ error: 'An error occurred while retrieving chat history.' });
    }
});



  
app.post('/api/chatgpt', async (req, res) => {
  const userMessage = req.body.message;
  const userId = req.body.userId;

  // Fetch chat history from the database
  let conversationHistory = [];
  try {
    const [results] = await connection.execute('SELECT * FROM chat_history WHERE user_id = ? ORDER BY id ASC', [userId]);
    conversationHistory = results.map(result => {
      return `${result.sender}: ${result.message}`;
    });
    // Shorten the conversation history
    conversationHistory = shortenConversationHistory(conversationHistory, 2048);
  } catch (error) {
    console.error('Error while retrieving chat history:', error);
    res.status(500).send({ error: 'An error occurred while retrieving chat history.' });
    return;
  }

  const prompt = conversationHistory.join('\n') + `\nUser: ${userMessage}\nAssistant:`;

  console.log('conversationHistory:', JSON.stringify(conversationHistory, null, 2));
  console.log('userMessage:', userMessage);
  console.log('Generated prompt:', prompt);
  try {
    console.log("Prompt:", prompt);

    const response = await fetch('https://api.openai.com/v1/engines/text-davinci-003/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: prompt,
        max_tokens: 200,
        n: 1,
        stop: ['User:', 'Assistant:'],
        temperature: 0.8,
      }),
    });
    
    if (!response.ok) {
      console.error('API error:', response.status, response.statusText);
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    let responseText = data.choices[0].text.trim();
    responseText = responseText.replace(/(\d+\.) /g, '<br>$1 ');

    console.log("API Response: " + JSON.stringify(data));
    console.log("Assistant Text: " + responseText);

    res.json({ response: responseText });
  } catch (error) {
    console.error('There was a problem with the fetch operation:', error);
    console.error('API error:', error.response ? error.response.status : null, error.response ? error.response.statusText : null);
    res.status(500).json({ error: 'An error occurred while processing the request' });
  }
  
});

app.post('/api/process-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }

  const buffer = req.file.buffer;

  try {
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => console.log(m),
    });

    const extractedText = data.text;
    res.json({ processedImageInfo: extractedText });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process image.' });
  }
});
  
  app.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('/login');
  });
};
