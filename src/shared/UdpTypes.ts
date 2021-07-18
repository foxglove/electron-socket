export type UdpAddress = {
  port: number;
  family: string;
  address: string;
};

export type UdpRemoteInfo = {
  address: string;
  family: "IPv4" | "IPv6";
  port: number;
  size: number;
};

export type UdpBindOptions = {
  port?: number;
  address?: string;
  exclusive?: boolean;
  fd?: number;
};
