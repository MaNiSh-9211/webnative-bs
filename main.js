const { app } = require('electron');
const { startDriveHttpServer } = require('./drive-service/http-server');

app.whenReady().then(() => {
  startDriveHttpServer();
  console.log('Electron native bridge started in background.');

  // Prevent the app from quitting when all windows are closed
  // Since we have no windows, this ensures app stays alive
  app.on('window-all-closed', (e) => {
    e.preventDefault();
  });
});
