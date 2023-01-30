import { ipcRenderer } from "electron";

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
    const apis = {
      Create: PreloaderSocketsMain.Create
    };
    (window as any).electronSocket = apis;
  }
}
