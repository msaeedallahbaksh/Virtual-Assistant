const electron = require('electron');
const express = require('express');
const path = require('path');
const app = express();
const session = require('express-session');
const routes = require('./routes');
const { BrowserWindow } = electron;

const electronApp = electron.app;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadURL('http://localhost:3000/');
}

electronApp.whenReady().then(createWindow);

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});

electronApp.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));


routes(app);
app.use('/public', express.static(path.join(__dirname, 'public')));


const server = app.listen(3000, function () {
  console.log('Server listening on port 3000');
});
