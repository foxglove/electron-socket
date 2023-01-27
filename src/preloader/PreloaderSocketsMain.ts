import { ipcRenderer } from "electron";

export class PreloaderSocketsMain {
  static Init(): void {
    (window as any).socketIpcRenderer = ipcRenderer;
  }
}
