import path from "path";
import webpack from "webpack";

import { makeConfig } from "./webpack.config";

const appPath = path.join(__dirname, "..", ".webpack");

function buildTest(folderPath: string) {
  const webpackConfig = makeConfig(folderPath);
  const compiler = webpack(
    webpackConfig.map((config) => {
      if (typeof config === "function") {
        return config(undefined, { mode: "production" });
      }

      return config;
    })
  );

  return new Promise<string>((resolve, reject) => {
    // eslint-disable-next-line no-restricted-syntax
    console.info("Building Webpack.");
    compiler.run((err, result) => {
      compiler.close(() => {});
      if (err) {
        reject(err);
        return;
      }
      if (!result || result.hasErrors()) {
        console.error(result?.toString());
        reject(new Error("webpack build failed"));
        return;
      }
      // eslint-disable-next-line no-restricted-syntax
      console.info("Webpack build complete");
      resolve(appPath);
    });
  });
}

export { buildTest };
