import { SocketOptions as UdpSocketOptions, createSocket as createNodejsUdpSocket } from "dgram";
import { Socket } from "net";

import { HttpServerElectron } from "./HttpServerElectron.js";
import { TcpServerElectron } from "./TcpServerElectron.js";
import { TcpSocketElectron } from "./TcpSocketElectron.js";
import { UdpSocketElectron } from "./UdpSocketElectron.js";
import { dnsLookup } from "./dns.js";
import { nextId, registerEntity } from "./registry.js";

export function createHttpServer(): MessagePort {
  const channel = new MessageChannel();
  const id = nextId();
  const server = new HttpServerElectron(id, channel.port2);
  registerEntity(id, server);
  return channel.port1;
}

export function createSocket(host: string, port: number): MessagePort | undefined {
  const channel = new MessageChannel();
  const id = nextId();
  const socket = new TcpSocketElectron(id, channel.port2, host, port, new Socket());
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

export function createUdpSocket(): MessagePort | undefined {
  const SOCKET_OPTS: UdpSocketOptions = { type: "udp4", reuseAddr: true, lookup: dnsLookup };

  const channel = new MessageChannel();
  const id = nextId();
  const socket = new UdpSocketElectron(id, channel.port2, createNodejsUdpSocket(SOCKET_OPTS));
  registerEntity(id, socket);
  return channel.port1;
}
