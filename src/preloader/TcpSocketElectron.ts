import * as net from "net";
import { MessageChannelFactory, MessagePortLike } from "../shared/MessagePort.js";

import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc.js";
import { TcpAddress, TcpSocketConnectOptions } from "../shared/TcpTypes.js";
import { dnsLookup } from "./dns.js";

type MaybeHasFd = {
  _handle?: {
    fd?: number;
  };
};

export class TcpSocketElectron {
  readonly id: number;
  private _socket: net.Socket;
  private _messagePort: MessagePortLike;
  private _api = new Map<string, RpcHandler>([
    ["remoteAddress", (callId) => this._apiResponse(callId, this.remoteAddress())],
    ["localAddress", (callId) => this._apiResponse(callId, this.localAddress())],
    ["fd", (callId) => this._apiResponse(callId, this.fd())],
    [
      "setKeepAlive",
      (callId, args) => {
        const enable = args[0] as boolean | undefined;
        const initialDelay = args[1] as number | undefined;
        this.setKeepAlive(enable, initialDelay);
        this._apiResponse(callId);
      },
    ],
    [
      "setTimeout",
      (callId, args) => {
        const timeout = args[0] as number;
        this.setTimeout(timeout);
        this._apiResponse(callId);
      },
    ],
    [
      "setNoDelay",
      (callId, args) => {
        const noDelay = args[0] as boolean | undefined;
        this.setNoDelay(noDelay);
        this._apiResponse(callId);
      },
    ],
    ["connected", (callId) => this._apiResponse(callId, this.connected())],
    [
      "connect",
      (callId, args) => {
        this.connect((args[0] as unknown) as TcpSocketConnectOptions)
          .then(() => this._apiResponse(callId, undefined))
          .catch((err: Error) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
    ["close", (callId) => this._apiResponse(callId, this.close())],
    ["dispose", (callId) => this._apiResponse(callId, this.dispose())],
    [
      "write",
      (callId, args) => {
        const data = args[0] as Uint8Array;
        this.write(data)
          .then(() => this._apiResponse(callId, undefined))
          .catch((err: Error) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
  ]);

  constructor(messageChannelFactory: MessageChannelFactory,
    id: number,
    messagePort: MessagePortLike,
    socket: net.Socket,
  ) {
    messageChannelFactory;
    this.id = id;
    this._socket = socket;
    this._messagePort = messagePort;

    this._socket.on("close", () => this._emit("close"));
    this._socket.on("end", () => this._emit("end"));
    this._socket.on("data", this._handleData);
    this._socket.on("timeout", () => this._emit("timeout"));
    this._socket.on("error", (err) => this._emit("error", String(err.stack ?? err)));

    messagePort.addEventListener('message', (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId, ...args] = ev.data;
      const handler = this._api.get(methodName);
      handler?.(callId, args);
    });
    messagePort.start();
  }

  remoteAddress(): TcpAddress | undefined {
    const port = this._socket.remotePort;
    const family = this._socket.remoteFamily;
    const address = this._socket.remoteAddress;
    return port != undefined && address != undefined ? { port, family, address } : undefined;
  }

  localAddress(): TcpAddress | undefined {
    const port = this._socket.localPort;
    const family = this._socket.remoteFamily; // There is no localFamily
    const address = this._socket.localAddress;
    return port != undefined && address != undefined ? { port, family, address } : undefined;
  }

  fd(): number | undefined {
    // There is no public node.js API for retrieving the file descriptor for a
    // socket. This is the only way of retrieving it from pure JS, on platforms
    // where sockets have file descriptors. See
    // <https://github.com/nodejs/help/issues/1312>
    // eslint-disable-next-line no-underscore-dangle
    return (this._socket as unknown as MaybeHasFd)._handle?.fd;
  }

  setKeepAlive(enable?: boolean, initialDelay?: number): this {
    this._socket.setKeepAlive(enable, initialDelay);
    return this;
  }

  setTimeout(timeout: number): this {
    this._socket.setTimeout(timeout);
    return this;
  }

  setNoDelay(noDelay?: boolean): this {
    this._socket.setNoDelay(noDelay);
    return this;
  }

  connected(): boolean {
    return !this._socket.destroyed && this._socket.localAddress != undefined;
  }

  async connect(options: TcpSocketConnectOptions): Promise<void> {
    return await new Promise((resolve, reject) => {
      this._socket
        .connect({...options, lookup: dnsLookup }, () => {
          this._socket.removeListener("error", reject);
          resolve();
          this._emit("connect");
        })
        .on("error", reject);
    });
  }

  close(): void {
    this._socket.destroy();
  }

  dispose(): void {
    this._socket.removeAllListeners();
    this.close();
    this._messagePort.close();
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket.write(data, (err) => {
        if (err != undefined) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private _apiResponse(callId: number, ...args: Cloneable[]): void {
    const msg: RpcResponse = [callId, ...args];
    this._messagePort.postMessage(msg);
  }

  private _emit(eventName: string, ...args: Cloneable[]): void {
    const msg: Cloneable[] = [eventName, ...args];
    this._messagePort.postMessage(msg);
  }

  private _handleData = (data: Uint8Array): void => {
    const msg: Cloneable[] = ["data", data];
    this._messagePort.postMessage(msg);
  };
}
