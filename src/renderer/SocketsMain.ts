import { Sockets } from "./Sockets";

export class SocketsMain {
  // Initialize electron-socket on the Main side.
  static async Create(channel = "__electron_socket"): Promise<Sockets> {
    const entry = Sockets.registeredSockets.get(channel);
    if (entry != undefined) {
      const promise = entry as Promise<Sockets>;
      if (typeof promise.then === "function") {
        return await promise;
      }
      return await entry;
    }

    const promise = new Promise<Sockets>((resolve) => {
      const ipcRenderer: typeof import('electron').ipcRenderer = (window as any).socketIpcRenderer;
      ipcRenderer.send('__electron_socket_main', channel);
      ipcRenderer.once(channel, (ev) => {
        const messagePort = ev.ports[0];
        if (messagePort == undefined) {
          return;
        }
        const sockets = new Sockets(messagePort);
        Sockets.registeredSockets.set(channel, sockets);
        resolve(sockets);
       });
    });

    Sockets.registeredSockets.set(channel, promise);
    return await promise;
  }
}
