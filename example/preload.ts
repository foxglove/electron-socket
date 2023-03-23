import { PreloaderSockets } from "@foxglove/electron-socket/preloader";

async function main() {
  // Change this delay to test initializing the preloader after the renderer
  // await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log("initializing preloader sockets...");
  await PreloaderSockets.Create();
  console.log("initialized preloader sockets");
}

void main();
