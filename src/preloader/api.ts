import { Socket } from "net";

import { HttpServerElectron } from "./HttpServerElectron";
import { TcpServerElectron } from "./TcpServerElectron";
import { TcpSocketElectron } from "./TcpSocketElectron";
import { nextId, registerEntity } from "./registry";

export function createHttpServer(): MessagePort {
  const channel = new MessageChannel();
  const id = nextId();
  const server = new HttpServerElectron(id, channel.port2);
  registerEntity(id, server);
  return channel.port1;
}

export function createSocket(
  host: string,
  port: number
): MessagePort | undefined {
  const channel = new MessageChannel();
  const id = nextId();
  const socket = new TcpSocketElectron(
    id,
    channel.port2,
    host,
    port,
    new Socket()
  );
  registerEntity(id, socket);
  return channel.port1;
}

export function createServer(): MessagePort | undefined {
  const channel = new MessageChannel();
  const id = nextId();
  const server = new TcpServerElectron(id, channel.port2);
  registerEntity(id, server);
  return channel.port1;
}
