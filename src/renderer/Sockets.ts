import { HttpServerRenderer } from "./HttpServerRenderer.js";
import { TcpServerRenderer } from "./TcpServerRenderer.js";
import { TcpSocketRenderer } from "./TcpSocketRenderer.js";
import { UdpSocketRenderer } from "./UdpSocketRenderer.js";
import { HttpHandler } from "../shared/HttpTypes.js";
import { Message } from "../shared/Message.js";
import { Cloneable, RpcCall, RpcResponse } from "../shared/Rpc.js";

export class Sockets {
  // The renderer ("main world") side of the original message channel connecting
  // the renderer to the preloader ("isolated world"). Function calls such as
  // createSocket() and createServer() are sent over this port, and function
  // call return values are received back over it
  private _messagePort: MessagePort;
  // Completion callbacks for any in-flight RPC calls
  private _callbacks = new Map<
    number,
    (args: Cloneable[], ports?: readonly MessagePort[]) => void
  >();
  // Asynchronous RPC calls are tracked using a callId integer
  private _nextCallId = 0;

  // A map of created `Sockets` instances, or a promise if creation is in progress
  static registeredSockets = new Map<string, Sockets | Promise<Sockets>>();

  constructor(messagePort: MessagePort) {
    this._messagePort = messagePort;

    messagePort.onmessage = (ev: MessageEvent<RpcResponse>) => {
      const callId = ev.data[0];
      const args = ev.data.slice(1);
      const callback = this._callbacks.get(callId);
      if (callback != undefined) {
        this._callbacks.delete(callId);
        callback(args, ev.ports);
      }
    };
  }

  async createHttpServer(requestHandler?: HttpHandler): Promise<HttpServerRenderer> {
    return await new Promise((resolve, reject) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, (_, ports) => {
        const port = ports?.[0];
        if (port == undefined) {
          return reject(new Error("no port returned"));
        }

        resolve(new HttpServerRenderer(port, requestHandler));
      });

      const msg: RpcCall = ["createHttpServer", callId];
      this._messagePort.postMessage(msg);
    });
  }

  async createSocket(host: string, port: number): Promise<TcpSocketRenderer> {
    return await new Promise((resolve, reject) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, (args, ports) => {
        const msgPort = ports?.[0];
        if (msgPort == undefined) {
          const err = args[0] as string | undefined;
          return reject(new Error(err ?? "no port returned"));
        }

        resolve(new TcpSocketRenderer(msgPort));
      });

      const msg: RpcCall = ["createSocket", callId, host, port];
      this._messagePort.postMessage(msg);
    });
  }

  async createServer(): Promise<TcpServerRenderer> {
    return await new Promise((resolve, reject) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, (args, ports) => {
        const port = ports?.[0];
        if (port == undefined) {
          const err = args[0] as string | undefined;
          return reject(new Error(err ?? "no port returned"));
        }

        resolve(new TcpServerRenderer(port));
      });

      const msg: RpcCall = ["createServer", callId];
      this._messagePort.postMessage(msg);
    });
  }

  async createUdpSocket(): Promise<UdpSocketRenderer> {
    return await new Promise((resolve, reject) => {
      const callId = this._nextCallId++;
      this._callbacks.set(callId, (args, ports) => {
        const msgPort = ports?.[0];
        if (msgPort == undefined) {
          const err = args[0] as string | undefined;
          return reject(new Error(err ?? "no port returned"));
        }

        resolve(new UdpSocketRenderer(msgPort));
      });

      const msg: RpcCall = ["createUdpSocket", callId];
      this._messagePort.postMessage(msg);
    });
  }

  // Initialize electron-socket on the renderer side. This method will not resolve until the
  // preloader side has also been initialized.
  static async Create(channel = "__electron_socket"): Promise<Sockets> {
    const entry = Sockets.registeredSockets.get(channel);
    if (entry != undefined) {
      return await entry;
    }

    const promise = new Promise<Sockets>((resolve, reject) => {
      const messageListener = (event: MessageEvent<Message>) => {
        if (event.target !== window || event.data.channel !== channel) {
          return;
        }

        if (event.data.type === "preloaderReady") {
          // The renderer was initialized before the preloader. Inform the preloader (again) that
          // the renderer is ready.
          window.postMessage({ channel, type: "rendererReady" } satisfies Message, "*");
          return;
        }

        if (event.data.type === "preloaderInitialized") {
          const messagePort = event.ports[0];
          if (!messagePort) {
            reject(new Error("Received preloaderInitialized message with no port"));
            return;
          }
          const sockets = new Sockets(messagePort);
          Sockets.registeredSockets.set(channel, sockets);

          window.removeEventListener("message", messageListener);
          resolve(sockets);
        }
      };
      window.addEventListener("message", messageListener);
    });

    // Notify the preloader that we are ready to initialize.
    // - If it has not yet invoked Create(), it will send a preloaderReady message when it does.
    //   Then we will send a rendererReady message.
    // - If the preloader has already invoked Create(), it will send a preloaderInitialized message.
    window.postMessage({ channel, type: "rendererReady" } satisfies Message, "*");

    Sockets.registeredSockets.set(channel, promise);
    return await promise;
  }
}
