import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { CleanWebpackPlugin } from "clean-webpack-plugin";

const entry = {
  entry: {},
  mode: "development",
  output: {
    publicPath: "",
    path: path.resolve(__dirname, "..", ".webpack"),
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      filename: "package.json",
      templateContent: JSON.stringify({
        main: "main.js",
        name: "test",
      }),
    }),
  ],
};

const main = {
  entry: "./main.ts",
  context: path.join(__dirname, "app"),
  target: "electron-main",
  mode: "development",

  output: {
    publicPath: "",
    path: path.resolve(__dirname, "..", ".webpack"),
  },
};

function makeConfig(folderPath: string) {
  const preload = {
    entry: "./preload.ts",
    context: folderPath,
    target: "electron-preload",
    mode: "development",

    output: {
      publicPath: "",
      filename: "preload.js",
      path: path.resolve(__dirname, "..", ".webpack"),
    },
  };

  const renderer = {
    entry: "./renderer.ts",
    context: folderPath,
    target: "electron-renderer",
    mode: "development",

    output: {
      publicPath: "",
      filename: "renderer.js",
      path: path.resolve(__dirname, "..", ".webpack"),
    },

    plugins: [new HtmlWebpackPlugin()],
  };

  return [entry, main, preload, renderer];
}

export { makeConfig };
