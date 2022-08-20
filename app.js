const electron = require('electron');
const Positioner = require('electron-positioner');
const { IpcServer } = require('./ipc.js');
const { POSITIONS } = require('./constants.js');

// more useragents here: https://developers.whatismybrowser.com/useragents/explore/operating_platform/smart-tv/
const userAgent = 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebkit/538.1 (KHTML, like Gecko) SamsungBrowser/1.1 TV Safari/538.1';
const ipcInstance = new IpcServer();
const app = electron.app;

ipcInstance.on('QUIT', (data, socket) => {
  ipcInstance.emit(socket, 'QUIT_HEARD', {});
  app.quit();
  process.exit();
});

app.once('ready', () => {
  electron.session.defaultSession.setUserAgent(userAgent);

  ipcInstance.on('SEND_CONFIG', (data, socket) => {
    const { url, position, width, height, x, y } = data;

    const usingXY = x && y;
    
    // electron
    const windowOptions = {
      maxHeight: height,
      maxWidth: width,
      resize: false,
      width: width,
      height: height,
      darkTheme: true,
      alwayOnTop: true,
      show: false,
      frame: false,
      zoomFactor: 1.0,
      focusable: false,
      ...(usingXY ? { x, y } : {})
    };

    const screenCastWindow = new electron.BrowserWindow(windowOptions);

    if (!usingXY && POSITIONS[position]) {
      const positioner = new Positioner(screenCastWindow);
      positioner.move(POSITIONS[position]);
    }

    screenCastWindow.loadURL(url);

     // Show window when page is ready
    screenCastWindow.once('ready-to-show', () => {

      // this is messy for autoplay but youtube, due to chrome no longer supports
      // autoplay
      const autoPlayScript = `
        const videoEle = document.getElementsByTagName('video');
        if (!!videoEle && videoEle.length > 1) videoEle[0].play();
      `;

      const autoCloseScript = `
        window.setInterval(function() {
          if (document.getElementsByClassName('WEB_PAGE_TYPE_ACCOUNT_SELECTOR').length >= 1) {
            console.log("Exited..");
          } 
        }, 1000);
      `;
 
        screenCastWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
         if (message === "Exited..") {
            console.log("from --> I am done..");
            ipcInstance.server.emit(socket, 'quit');
            app.quit();
            // process.exit();
         }
        });


      screenCastWindow.webContents.executeJavaScript(autoCloseScript, true);

      screenCastWindow.show();
      screenCastWindow.webContents.openDevTools();
      screenCastWindow.webContents.executeJavaScript(autoPlayScript, true);
      ipcInstance.emit(socket, 'APP_READY', {});
    });
  });
});

