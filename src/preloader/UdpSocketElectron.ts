import * as dgram from "dgram";
import { MessageChannelFactory, MessagePortLike } from "../shared/MessagePort.js";

import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc.js";
import { UdpAddress } from "../shared/UdpTypes.js";

type MaybeHasFd = {
  _handle?: {
    fd?: number;
  };
};

export class UdpSocketElectron {
  readonly id: number;
  private _socket: dgram.Socket;
  private _messagePort: MessagePortLike;
  private _api = new Map<string, RpcHandler>([
    ["remoteAddress", (callId) => this._apiResponse(callId, this.remoteAddress())],
    ["localAddress", (callId) => this._apiResponse(callId, this.localAddress())],
    ["fd", (callId) => this._apiResponse(callId, this.fd())],
    [
      "addMembership",
      (callId, args) => {
        const multicastAddress = args[0] as string;
        const multicastInterface = args[1] as string | undefined;
        this.addMembership(multicastAddress, multicastInterface);
        this._apiResponse(callId);
      },
    ],
    [
      "addSourceSpecificMembership",
      (callId, args) => {
        const sourceAddress = args[0] as string;
        const groupAddress = args[1] as string;
        const multicastInterface = args[2] as string | undefined;
        this.addSourceSpecificMembership(sourceAddress, groupAddress, multicastInterface);
        this._apiResponse(callId);
      },
    ],
    [
      "bind",
      (callId, args) => {
        const options = args[0] as {
          port?: number;
          address?: string;
          exclusive?: boolean;
          fd?: number;
        };
        this.bind(options)
          .then(() => this._apiResponse(callId, undefined))
          .catch((err: Error) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
    [
      "setBroadcast",
      (callId, args) => {
        const enable = args[0] as boolean;
        this.setBroadcast(enable);
        this._apiResponse(callId);
      },
    ],
    [
      "setMulticastInterface",
      (callId, args) => {
        const multicastInterface = args[0] as string;
        this.setMulticastInterface(multicastInterface);
        this._apiResponse(callId);
      },
    ],
    [
      "setMulticastLoopback",
      (callId, args) => {
        const enable = args[0] as boolean;
        this.setMulticastLoopback(enable);
        this._apiResponse(callId);
      },
    ],
    [
      "setMulticastTTL",
      (callId, args) => {
        const ttl = args[0] as number;
        this.setMulticastTTL(ttl);
        this._apiResponse(callId);
      },
    ],
    [
      "setRecvBufferSize",
      (callId, args) => {
        const size = args[0] as number;
        this.setRecvBufferSize(size);
        this._apiResponse(callId);
      },
    ],
    [
      "setSendBufferSize",
      (callId, args) => {
        const size = args[0] as number;
        this.setSendBufferSize(size);
        this._apiResponse(callId);
      },
    ],
    [
      "setTTL",
      (callId, args) => {
        const ttl = args[0] as number;
        this.setTTL(ttl);
        this._apiResponse(callId);
      },
    ],
    [
      "connect",
      (callId, args) => {
        const port = args[0] as number;
        const address = args[1] as string | undefined;
        this.connect(port, address)
          .then(() => this._apiResponse(callId, undefined))
          .catch((err: Error) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
    [
      "close",
      (callId) => {
        this.close()
          .then(() => this._apiResponse(callId, undefined))
          .catch((err: Error) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
    ["disconnect", (callId) => this._apiResponse(callId, this.disconnect())],
    [
      "dropMembership",
      (callId, args) => {
        const multicastAddress = args[0] as string;
        const multicastInterface = args[1] as string | undefined;
        this.dropMembership(multicastAddress, multicastInterface);
        this._apiResponse(callId);
      },
    ],
    [
      "dropSourceSpecificMembership",
      (callId, args) => {
        const sourceAddress = args[0] as string;
        const groupAddress = args[1] as string;
        const multicastInterface = args[2] as string | undefined;
        this.dropSourceSpecificMembership(sourceAddress, groupAddress, multicastInterface);
        this._apiResponse(callId);
      },
    ],
    ["dispose", (callId) => this._apiResponse(callId, this.dispose())],
    [
      "send",
      (callId, args) => {
        const msg = args[0] as Uint8Array;
        const offset = args[1] as number | undefined;
        const length = args[2] as number | undefined;
        const port = args[3] as number | undefined;
        const address = args[4] as string | undefined;
        this.send(msg, offset, length, port, address)
          .then(() => this._apiResponse(callId, undefined))
          .catch((err: Error) => this._apiResponse(callId, String(err.stack ?? err)));
      },
    ],
  ]);

  constructor(messageChannelFactory: MessageChannelFactory, id: number, messagePort: MessagePortLike, socket: dgram.Socket) {
    messageChannelFactory;
    this.id = id;
    this._socket = socket;
    this._messagePort = messagePort;

    this._socket.on("close", () => this._emit("close"));
    this._socket.on("connect", () => this._emit("connect"));
    this._socket.on("message", this._handleMessage);
    this._socket.on("listening", () => this._emit("listening"));
    this._socket.on("error", (err) => this._emit("error", String(err.stack ?? err)));

    messagePort.addEventListener('message', (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId, ...args] = ev.data;
      const handler = this._api.get(methodName);
      handler?.(callId, args);
    });
    messagePort.start();
  }

  remoteAddress(): UdpAddress | undefined {
    try {
      const { port, family, address } = this._socket.remoteAddress();
      return { port, family, address };
    } catch {
      return undefined;
    }
  }

  localAddress(): UdpAddress | undefined {
    try {
      const { port, family, address } = this._socket.address();
      return { port, family, address };
    } catch {
      return undefined;
    }
  }

  fd(): number | undefined {
    // There is no public node.js API for retrieving the file descriptor for a
    // socket. This is the only way of retrieving it from pure JS, on platforms
    // where sockets have file descriptors. See
    // <https://github.com/nodejs/help/issues/1312>
    // eslint-disable-next-line no-underscore-dangle
    return (this._socket as unknown as MaybeHasFd)._handle?.fd;
  }

  addMembership(multicastAddress: string, multicastInterface?: string): void {
    this._socket.addMembership(multicastAddress, multicastInterface);
  }

  addSourceSpecificMembership(
    sourceAddress: string,
    groupAddress: string,
    multicastInterface?: string,
  ): void {
    this._socket.addSourceSpecificMembership(sourceAddress, groupAddress, multicastInterface);
  }

  async bind(options: dgram.BindOptions): Promise<void> {
    return await new Promise((resolve, reject) => {
      this._socket.on("error", reject).bind(options, () => {
        this._socket.removeListener("error", reject);
        resolve();
      });
    });
  }

  async connect(port: number, address?: string): Promise<void> {
    return await new Promise((resolve, reject) => {
      this._socket.on("error", reject).connect(port, address, () => {
        this._socket.removeListener("error", reject);
        resolve();
        this._emit("connect");
      });
    });
  }

  async close(): Promise<void> {
    return await new Promise((resolve) => {
      this._socket.close(() => resolve);
    });
  }

  disconnect(): void {
    this._socket.disconnect();
  }

  dispose(): void {
    this._socket.removeAllListeners();
    void this.close();
    this._messagePort.close();
  }

  dropMembership(multicastAddress: string, multicastInterface?: string): void {
    this._socket.dropMembership(multicastAddress, multicastInterface);
  }

  dropSourceSpecificMembership(
    sourceAddress: string,
    groupAddress: string,
    multicastInterface?: string,
  ): void {
    this._socket.dropSourceSpecificMembership(sourceAddress, groupAddress, multicastInterface);
  }

  async send(
    msg: Uint8Array,
    offset = 0,
    length = msg.byteLength,
    port?: number,
    address?: string,
  ): Promise<void> {
    return await new Promise((resolve, reject) => {
      this._socket.send(msg, offset, length, port, address, (err) => {
        if (err != undefined) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  setBroadcast(flag: boolean): void {
    this._socket.setBroadcast(flag);
  }

  setMulticastInterface(multicastInterface: string): void {
    this._socket.setMulticastInterface(multicastInterface);
  }

  setMulticastLoopback(flag: boolean): void {
    this._socket.setMulticastLoopback(flag);
  }

  setMulticastTTL(ttl: number): void {
    this._socket.setMulticastTTL(ttl);
  }

  setRecvBufferSize(size: number): void {
    this._socket.setRecvBufferSize(size);
  }

  setSendBufferSize(size: number): void {
    this._socket.setSendBufferSize(size);
  }

  setTTL(ttl: number): void {
    this._socket.setTTL(ttl);
  }

  private _apiResponse(callId: number, ...args: Cloneable[]): void {
    const msg: RpcResponse = [callId, ...args];
    this._messagePort.postMessage(msg);
  }

  private _emit(eventName: string, ...args: Cloneable[]): void {
    const msg: Cloneable[] = [eventName, ...args];
    this._messagePort.postMessage(msg);
  }

  private _handleMessage = (data: Uint8Array, rinfo: dgram.RemoteInfo): void => {
    const cloneableRinfo = { ...rinfo } as Cloneable;
    const msg: Cloneable[] = ["message", data, cloneableRinfo];
    this._messagePort.postMessage(msg, [data.buffer]);
  };
}
