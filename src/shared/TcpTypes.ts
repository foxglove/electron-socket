export type TcpAddress = {
  port: number;
  family?: string;
  address: string;
};

export interface TcpSocketConnectOptions {
  port: number;
  host?: string | undefined;
  localAddress?: string | undefined;
  localPort?: number | undefined;
  hints?: number | undefined;
  family?: number | undefined;
  noDelay?: boolean | undefined;
  keepAlive?: boolean | undefined;
  keepAliveInitialDelay?: number | undefined;
}