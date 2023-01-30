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

    const CreateSocketMessagePort = (window as any).CreateSocketMessagePort;
    const promise = CreateSocketMessagePort(channel)
    .then((messagePort: MessagePort) => {
        const sockets = new Sockets(messagePort);
        Sockets.registeredSockets.set(channel, sockets);
        return sockets;
    });

    Sockets.registeredSockets.set(channel, promise);
    return await promise;
  }
}
