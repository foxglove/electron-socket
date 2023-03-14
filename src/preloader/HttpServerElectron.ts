import * as http from "http";

import { HttpRequest, HttpResponse } from "../shared/HttpTypes.js";
import { MessageChannelFactory, MessagePortLike } from "../shared/MessagePort.js";
import { Cloneable, RpcCall, RpcHandler, RpcResponse } from "../shared/Rpc.js";
import { TcpAddress } from "../shared/TcpTypes.js";

export class HttpServerElectron {
  readonly id: number;
  private _server: http.Server;
  private _messagePort: MessagePortLike;
  private _nextRequestId = 0;
  private _requests = new Map<number, (response: HttpResponse) => Promise<void>>();
  private _api = new Map<string, RpcHandler>([
    ["address", (callId) => this._apiResponse([callId, this.address()])],
    [
      "listen",
      (callId, args) => {
        const port = args[0] as number | undefined;
        const hostname = args[1] as string | undefined;
        const backlog = args[2] as number | undefined;
        this.listen(port, hostname, backlog)
          .then(() => this._apiResponse([callId, undefined]))
          .catch((err: Error) => this._apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    [
      "response",
      (callId, args) => {
        const requestId = args[0] as number;
        const response = args[1] as HttpResponse;
        const handler = this._requests.get(requestId);
        if (handler == undefined) {
          this._apiResponse([callId, `unknown requestId ${requestId}`]);
          return;
        }
        this._requests.delete(requestId);
        handler(response)
          .then(() => this._apiResponse([callId, undefined]))
          .catch((err: Error) => this._apiResponse([callId, String(err.stack ?? err)]));
      },
    ],
    ["close", (callId) => this._apiResponse([callId, this.close()])],
    ["dispose", (callId) => this._apiResponse([callId, this.dispose()])],
  ]);

  constructor(messageChannelFactory: MessageChannelFactory, id: number, messagePort: MessagePortLike) {
    messageChannelFactory;
    this.id = id;
    this._server = http.createServer(this._handleRequest);
    this._messagePort = messagePort;

    this._server.on("close", () => this._emit("close"));
    this._server.on("error", (err) => this._emit("error", String(err.stack ?? err)));

    messagePort.addEventListener('message', (ev: MessageEvent<RpcCall>) => {
      const [methodName, callId, ...args] = ev.data;
      const handler = this._api.get(methodName);
      handler?.(callId, args);
    });
    messagePort.start();
  }

  address(): TcpAddress | undefined {
    const addr = this._server.address();
    if (addr == undefined || typeof addr === "string") {
      // Address will only be a string for an IPC (named pipe) server, which
      // should never happen here
      return undefined;
    }
    return addr;
  }

  async listen(port?: number, hostname?: string, backlog?: number): Promise<void> {
    return await new Promise((resolve, reject) => {
      this._server.listen(port, hostname, backlog, () => {
        this._server.removeListener("error", reject);
        resolve();
      });
    });
  }

  close(): void {
    this._server.close();
  }

  dispose(): void {
    this._server.removeAllListeners();
    this.close();
    this._messagePort.close();
  }

  private _apiResponse(message: RpcResponse, transfer?: Transferable[]): void {
    if (transfer != undefined) {
      this._messagePort.postMessage(message, transfer);
    } else {
      this._messagePort.postMessage(message);
    }
  }

  private _emit(eventName: string, ...args: Cloneable[]): void {
    const msg = [eventName, ...args];
    this._messagePort.postMessage(msg);
  }

  private _handleRequest = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();

      const requestId = this._nextRequestId++;
      this._requests.set(requestId, async (out): Promise<void> => {
        res.shouldKeepAlive = out.shouldKeepAlive ?? res.shouldKeepAlive;
        res.statusCode = out.statusCode;
        res.statusMessage = out.statusMessage ?? "";
        res.sendDate = out.sendDate ?? res.sendDate;
        let hasContentLength = false;
        for (const [key, value] of Object.entries(out.headers ?? {})) {
          if (!hasContentLength && key.toLowerCase() === "content-length") {
            hasContentLength = true;
          }
          res.setHeader(key, value);
        }
        if (out.body != undefined && !hasContentLength) {
          res.setHeader("Content-Length", Buffer.byteLength(out.body));
        }
        res.end(out.body);
      });

      const request: HttpRequest = {
        body,
        aborted: req.aborted,
        httpVersion: req.httpVersion,
        httpVersionMajor: req.httpVersionMajor,
        httpVersionMinor: req.httpVersionMinor,
        complete: req.complete,
        headers: req.headers,
        rawHeaders: req.rawHeaders,
        trailers: req.trailers,
        rawTrailers: req.rawTrailers,
        method: req.method,
        url: req.url,
        socket: {
          localAddress: req.socket.localAddress,
          localPort: req.socket.localPort,
          remoteAddress: req.socket.remoteAddress,
          remotePort: req.socket.remotePort,
        },
      };
      this._emit("request", requestId, request);
    });
  };
}
