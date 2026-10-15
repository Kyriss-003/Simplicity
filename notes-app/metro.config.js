/**
 * Metro configuration for Expo with performance tuning.
 *
 * Key choices:
 * - stabilizeTransformCache - keeps cached transforms valid across restarts.
 * - enableBabelRCLookup = false - stops Babel scanning 6171 node_modules dirs.
 * - maxWorkers: 0 - use all available CPU cores for parallel transforms.
 */
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  maxWorkers: 0,
});

// .wasm files - used by expo-sqlite.
config.resolver.assetExts.push('wasm');

// Stabilise the transform cache key so a version-bump does not invalidate
// every cached transform - huge for second-and-third starts.
config.transformer.stabilizeTransformCache = true;

// Skip .babelrc lookup in node_modules so Babel does not scan 6171
// directories for packages that would never have one.
config.transformer.enableBabelRCLookup = false;



module.exports = config;
