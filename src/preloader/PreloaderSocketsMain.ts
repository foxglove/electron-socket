import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld('myAPI', {
//   doAThing: () => {}
// })


export class PreloaderSocketsMain {

  static async Create(channel = "__electron_socket"): Promise<MessagePort> {
    return new Promise<MessagePort>((resolve, reject) => {
      ipcRenderer.send('__electron_socket_main', channel);
      ipcRenderer.once(channel, (ev) => {
        const messagePort = ev.ports[0];
        if (messagePort == undefined) {
          return reject('?');
        }
        resolve(messagePort);
      });
    });
  }

  static Init(): void {
    (window as any).CreateSocketMessagePort = PreloaderSocketsMain.Create;
  }
}
