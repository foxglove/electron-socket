const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

const electronSocket = require('../../dist/main/MainSockets');

let done
let x = 100, y = 100
let idWindow  = 0;

function createWindow(page, title, webPreferences) {
    // Create the browser window.
    let win = new BrowserWindow({ x, y, width: 800, height: 800, webPreferences });
    win.webContents.on('preload-error', (event, preloadPath, error) => {
        console.log(error);
    });
    // win.loadFile(path.join(__dirname, page) + `?id=${idWindow}`);
    win.loadURL(`file://${path.join(__dirname, page)}?id=${idWindow}`);

    if (idWindow === 0) {
        // testIPC(idWindow);
    }

    ++idWindow;
    win.setTitle(`${page} - ${JSON.stringify(webPreferences)}`)

    // Open the DevTools.
    // win.webContents.openDevTools()

    // Emitted when the window is closed.
    win.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        win = null
    })

    y += 200
    if (y > 800) {
        y = 0
        x += 800
    }
    return win;
}


function createWindows() {
        createWindow('page.html', 'preload nodeIntegration: false', 
            { sandbox: false, nodeIntegration: false, contextIsolation: false, preload: path.join(__dirname, 'page-preload.bundle.js') })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    electronSocket.MainSockets.Init();
    createWindows();
});

app.on('quit', () => {
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (!done) {
        createWindows();
    }
})

  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.