module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required by react-native-reanimated v4 -- must be listed last.
      // Exclude node_modules: only source files need worklet transforms.
      // Skipping 6171 packages saves big time on cold start.
      ['react-native-worklets/plugin', { exclude: /node_modules/ }],
    ],
  };
};