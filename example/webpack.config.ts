import { CleanWebpackPlugin } from "clean-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import { Configuration, ModuleOptions, ResolveOptions } from "webpack";

const mode = "development";

const resolve: ResolveOptions = {
  extensions: [".js", ".ts", ".jsx", ".tsx"],
  extensionAlias: {
    // https://stackoverflow.com/questions/64796952/webpack-ts-loader-import-with-js-extension-not-resolving
    ".js": [".ts", ".js"],
  },
  alias: {
    "@foxglove/electron-socket": path.resolve(__dirname, "../src"),
  },
};

const output: Configuration["output"] = {
  path: path.resolve(__dirname, "./dist"),
};

const moduleOptions: ModuleOptions = {
  rules: [
    {
      test: /\.tsx?$/,
      use: "ts-loader",
      exclude: /node_modules/,
    },
  ],
};

const mainConfig: Configuration = {
  mode,
  context: __dirname,
  target: "electron-main",
  entry: "./main.ts",
  output: { ...output, filename: "main.js" },
  resolve,
  module: moduleOptions,
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [], // https://github.com/johnagan/clean-webpack-plugin/issues/122#issuecomment-480340987
    }),
  ],
};

const preloadConfig: Configuration = {
  mode,
  context: __dirname,
  target: "electron-preload",
  entry: "./preload.ts",
  output: { ...output, filename: "preload.js" },
  resolve,
  module: moduleOptions,
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [], // https://github.com/johnagan/clean-webpack-plugin/issues/122#issuecomment-480340987
    }),
  ],
};

const rendererConfig: Configuration = {
  mode,
  context: __dirname,
  target: "electron-renderer",
  entry: "./renderer.ts",
  output: { ...output, filename: "renderer.js" },
  resolve,
  module: moduleOptions,
  plugins: [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [], // https://github.com/johnagan/clean-webpack-plugin/issues/122#issuecomment-480340987
    }),
    new HtmlWebpackPlugin({
      templateContent: `
<!doctype html>
<html>
  <body>
  </body>
</html>
`,
    }),
  ],
};

export default [mainConfig, preloadConfig, rendererConfig];
