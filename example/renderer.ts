import { Sockets } from "@foxglove/electron-socket/renderer";

async function main() {
  // Change this delay to test initializing the renderer after the preloader
  // await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log("initializing renderer sockets...");
  await Sockets.Create();
  console.log("initialized renderer sockets");
}

void main();
