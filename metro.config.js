const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// FORCE COMPLETE CACHE RESET - Use random value to bust cache every time
config.resetCache = true;
config.cacheStores = [];
config.cacheVersion = Math.random().toString();

// Disable all caching mechanisms
config.transformer = {
  ...config.transformer,
  enableBabelRCLookup: false,
  enableBabelRuntime: false,
  babelTransformerPath: undefined,
};

// Clear resolver cache completely
config.resolver = {
  ...config.resolver,
  useWatchman: false,
};

// Force Metro to always recompile
config.watchFolders = [__dirname];

module.exports = config;
