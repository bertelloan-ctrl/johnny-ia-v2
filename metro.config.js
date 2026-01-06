const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable all caching to force fresh builds
config.resetCache = true;
config.cacheStores = [];

// Force transformer to reprocess all files
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

// Clear resolver cache
config.resolver = {
  ...config.resolver,
  disableHierarchicalLookup: false,
};

module.exports = config;
