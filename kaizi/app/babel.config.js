module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Reanimated 4 worklets. babel-preset-expo auto-configures this when
    // react-native-worklets is installed, but we pin it explicitly so the
    // animation layer never silently degrades.
    plugins: ["react-native-worklets/plugin"],
  };
};
