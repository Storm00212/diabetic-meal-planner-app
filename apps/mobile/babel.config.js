module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // NativeWind v4 ships the JSX runtime through react-native-css-interop.
      ["babel-preset-expo", { jsxImportSource: "react-native-css-interop" }],
      "nativewind/babel",
    ],
  };
};
