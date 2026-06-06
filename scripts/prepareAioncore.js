/**
 * CLI wrapper for preparing ByteTensorCore.
 *
 * Reads environment variables and invokes the shared module.
 *
 * Version resolution order:
 *  1. BYTETENSOR_BACKEND_VERSION env (for ad-hoc overrides)
 *  2. "aioncoreVersion" field in repo-root package.json (the upstream release pin)
 *  3. 'latest' (fallback; not recommended for reproducible builds)
 *
 * Environment variables:
 *  - BYTETENSOR_BACKEND_VERSION: override the pinned version
 *  - BYTETENSOR_BACKEND_ARCH: target architecture (default: process.arch)
 *  - GH_TOKEN / GITHUB_TOKEN: GitHub API token (for rate limiting)
 */

const path = require('path');
const { prepareByteTensorCore } = require('../packages/shared-scripts/src/prepare-aioncore.js');
const { resolveAioncoreVersion } = require('./resolveAioncoreVersion.js');

const projectRoot = path.resolve(__dirname, '..');
const platform = process.platform;
// Support cross-compilation: BYTETENSOR_BACKEND_ARCH > npm_config_target_arch > process.arch
const arch = process.env.BYTETENSOR_BACKEND_ARCH || process.env.npm_config_target_arch || process.arch;
const version = resolveAioncoreVersion(projectRoot);

try {
  prepareByteTensorCore({ projectRoot, platform, arch, version });
} catch (error) {
  console.error('❌ prepareByteTensorCore failed:', error.message);
  process.exit(1);
}

module.exports = function () {
  try {
    return prepareByteTensorCore({ projectRoot, platform, arch, version });
  } catch (error) {
    console.error('❌ prepareByteTensorCore failed:', error.message);
    throw error;
  }
};
