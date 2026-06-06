/**
 * @license
 * Copyright 2025 ByteTensor (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const childProcess = require('node:child_process') as { execFileSync: unknown; execSync: unknown };
const originalExecFileSync = childProcess.execFileSync;
const originalExecSync = childProcess.execSync;

afterEach(() => {
  childProcess.execFileSync = originalExecFileSync;
  childProcess.execSync = originalExecSync;
});

describe('prepareByteTensorCore', () => {
  it('preserves an existing checked-in ByteTensorCore binary for packaging', () => {
    const projectRoot = join(tmpdir(), `bytetensor-prepare-${process.pid}-${Date.now()}`);
    const runtimeDir = join(projectRoot, 'resources', 'bundled-bytetensorcore', 'win32-x64');
    mkdirSync(runtimeDir, { recursive: true });
    const binaryPath = join(runtimeDir, 'bytetensorcore.exe');
    writeFileSync(binaryPath, 'local-bytetensorcore');

    childProcess.execFileSync = () => {
      throw new Error('download should not run when a checked-in runtime exists');
    };
    childProcess.execSync = () => {
      throw new Error('latest tag resolution should not run for explicit versions');
    };

    try {
      delete require.cache[require.resolve('../../../packages/shared-scripts/src/prepare-aioncore.js')];
      const { prepareByteTensorCore } = require('../../../packages/shared-scripts/src/prepare-aioncore.js') as {
        prepareByteTensorCore: (options: { projectRoot: string; platform: string; arch: string; version: string }) => {
          prepared: true;
          dir: string;
          sourceType: string;
        };
      };

      const result = prepareByteTensorCore({ projectRoot, platform: 'win32', arch: 'x64', version: 'v0.1.22' });

      expect(result.sourceType).toBe('existing');
      expect(readFileSync(binaryPath, 'utf8')).toBe('local-bytetensorcore');
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
