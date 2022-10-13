export type HttpHeaders = Record<string, number | string | string[]>;

export type IncomingHttpHeaders = Record<string, string | string[] | undefined>;

export type HttpRequest = {
  body: string;
  aborted: boolean;
  httpVersion: string;
  httpVersionMajor: number;
  httpVersionMinor: number;
  complete: boolean;
  headers: IncomingHttpHeaders;
  rawHeaders: string[];
  trailers: IncomingHttpHeaders;
  rawTrailers: string[];
  method?: string;
  url?: string;
  socket: {
    localAddress: string;
  };
};

export type HttpResponse = {
  statusCode: number;
  statusMessage?: string;
  headers?: HttpHeaders;
  body?: string;
  shouldKeepAlive?: boolean;
  sendDate?: boolean;
};

export type HttpHandler = (req: HttpRequest) => Promise<HttpResponse>;
