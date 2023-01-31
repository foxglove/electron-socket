import { HttpHandler } from "../shared/HttpTypes.js";
import { Cloneable, RpcCall, RpcResponse } from "../shared/Rpc.js";
import { HttpServerRenderer } from "./HttpServerRenderer.js";
import { TcpServerRenderer } from "./TcpServerRenderer.js";
import { TcpSocketRenderer } from "./TcpSocketRenderer.js";
import { UdpSocketRenderer } from "./UdpSocketRenderer.js";

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

  async createSocket(): Promise<TcpSocketRenderer> {
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

      const msg: RpcCall = ["createSocket", callId];
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

  // Initialize electron-socket on the renderer side. This method should be called
  // before the window is loaded
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
      const messageListener = (windowEv: MessageEvent<string>) => {
        if (windowEv.target !== window || windowEv.data !== channel) {
          return;
        }

        const messagePort = windowEv.ports[0];
        if (messagePort == undefined) {
          return;
        }
        const sockets = new Sockets(messagePort);
        Sockets.registeredSockets.set(channel, sockets);

        window.removeEventListener("message", messageListener);
        resolve(sockets);
      };
      window.addEventListener("message", messageListener);
    });

    Sockets.registeredSockets.set(channel, promise);
    return await promise;
  }
}
