import electronPath from "electron";
import { _electron as electron } from "playwright";
import path from "path";

import { buildTest } from "./build";

describe("electron-socket", () => {
  it.each([
    { name: "some test", path: "some-test" },
    { name: "another test", path: "another-test" },
  ])(
    "$name",
    async (opt) => {
      const appPath = await buildTest(path.join(__dirname, opt.path));

      // In node.js the electron import gives us the path to the electron binary
      // Our type definitions don't realize this so cast the variable to a string
      const electronApp = await electron.launch({
        args: [appPath],
        executablePath: electronPath as unknown as string,
      });

      // Get the first window that the app opens, wait if necessary.
      const electronWindow = await electronApp.firstWindow();

      // Direct Electron console to Node terminal.
      await new Promise<void>((resolve, reject) => {
        electronWindow.on("console", (message) => {
          if (message.type() === "error") {
            reject(new Error(message.text()));
            return;
          }
          console.log(message.text());

          if (message.text().includes("success")) {
            resolve();
          }
        });
      });

      await electronApp.close();
    },
    10_000
  );
});
