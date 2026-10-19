const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

/**
 * The Expo Router lives in `app/` and the shared code in `src/`. Metro must
 * not try to bundle the web client or any of the backend services, which live
 * in sibling workspaces.
 */
const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const blocked = [
  path.join(projectRoot, "..", "web", "src"),
  path.join(projectRoot, "..", "gateway", "src"),
  path.join(projectRoot, "..", "svc-auth", "src"),
  path.join(projectRoot, "..", "svc-catalog", "src"),
  path.join(projectRoot, "..", "svc-planner", "src"),
  path.join(projectRoot, "..", "svc-health", "src"),
];

const existing = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : [];

config.resolver.blockList = [
  ...existing,
  ...blocked.map((dir) => new RegExp(`${escapeForRegExp(dir)}[\\\\/].*$`)),
];

module.exports = withNativeWind(config, { input: "./global.css" });
