import { app, BrowserWindow } from "electron";
import path from "path";

void app.whenReady().then(() => {
  const mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
    },
  });
  mainWindow.webContents.once("dom-ready", () => {
    mainWindow.webContents.openDevTools();
  });

  void mainWindow.loadFile("index.html");
});
