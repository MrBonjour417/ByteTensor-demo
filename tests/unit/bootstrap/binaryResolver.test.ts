import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBinaryPath } from '@process/backend/binaryResolver';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;

function setResourcesPath(resourcesPath: string | undefined): void {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: resourcesPath,
  });
}

function dirEntry(name: string, isDirectory = false): ReturnType<typeof readdirSync>[number] {
  return {
    name,
    isDirectory: () => isDirectory,
  } as unknown as ReturnType<typeof readdirSync>[number];
}

describe('resolveBinaryPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setResourcesPath(originalResourcesPath);
  });

  it('uses checked-out ByteTensorCore resources when Electron dev resources do not include the bundle', () => {
    const electronResourcesPath = '/electron/dist';
    const devResourcesPath = join(process.cwd(), 'resources');
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'bytetensorcore.exe' : 'bytetensorcore';
    const devBundledDir = join(devResourcesPath, 'bundled-bytetensorcore');
    const devRuntimeDir = join(devBundledDir, runtimeKey);
    const devBinaryPath = join(devRuntimeDir, binaryName);

    setResourcesPath(electronResourcesPath);
    vi.mocked(existsSync).mockImplementation((path) => {
      const normalizedPath = String(path);
      return normalizedPath === devBundledDir || normalizedPath === devRuntimeDir || normalizedPath === devBinaryPath;
    });
    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === devResourcesPath) return [dirEntry('bundled-bytetensorcore', true)];
      if (path === devRuntimeDir) return [dirEntry(binaryName)];
      return [] as ReturnType<typeof readdirSync>;
    });

    expect(resolveBinaryPath()).toBe(devBinaryPath);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('falls back to checked-out legacy aioncore resources during local transition', () => {
    const electronResourcesPath = '/electron/dist';
    const devResourcesPath = join(process.cwd(), 'resources');
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
    const devBundledDir = join(devResourcesPath, 'bundled-aioncore');
    const devRuntimeDir = join(devBundledDir, runtimeKey);
    const devBinaryPath = join(devRuntimeDir, binaryName);

    setResourcesPath(electronResourcesPath);
    vi.mocked(existsSync).mockImplementation((path) => {
      const normalizedPath = String(path);
      return normalizedPath === devBundledDir || normalizedPath === devRuntimeDir || normalizedPath === devBinaryPath;
    });

    expect(resolveBinaryPath()).toBe(devBinaryPath);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('attaches bundled path diagnostics when ByteTensorCore cannot be resolved', () => {
    const resourcesPath = '/app/resources';
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'bytetensorcore.exe' : 'bytetensorcore';
    const legacyBinaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
    const bundledDir = join(resourcesPath, 'bundled-bytetensorcore');
    const runtimeDir = join(bundledDir, runtimeKey);
    const checkedBundledPath = join(runtimeDir, binaryName);
    const legacyBundledDir = join(resourcesPath, 'bundled-aioncore');
    const legacyRuntimeDir = join(legacyBundledDir, runtimeKey);
    const legacyCheckedBundledPath = join(legacyRuntimeDir, legacyBinaryName);

    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockImplementation((path) => [legacyBundledDir, legacyRuntimeDir].includes(String(path)));
    vi.mocked(readdirSync).mockImplementation((path) => {
      if (path === resourcesPath) return [dirEntry('bundled-aioncore', true)];
      if (path === runtimeDir) return [] as ReturnType<typeof readdirSync>;
      if (path === legacyRuntimeDir) return [dirEntry('manifest.json')];
      return [] as ReturnType<typeof readdirSync>;
    });
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error('not found on PATH');
    });

    expect(() => resolveBinaryPath()).toThrow('Cannot find "bytetensorcore" binary');

    try {
      resolveBinaryPath();
    } catch (error) {
      expect(error).toMatchObject({
        name: 'BackendBinaryResolveError',
        diagnostics: expect.objectContaining({
          resourcesPath,
          runtimeKey,
          binaryName,
          checkedBundledPath,
          bundledDirExists: false,
          runtimeDirExists: false,
          legacyBinaryName,
          legacyCheckedBundledPath,
          legacyBundledDirExists: true,
          legacyRuntimeDirExists: true,
          resourcesDirEntries: ['bundled-aioncore/'],
          runtimeDirEntries: [],
          legacyRuntimeDirEntries: ['manifest.json'],
          pathLookupCommand: process.platform === 'win32' ? 'where bytetensorcore' : 'which bytetensorcore',
          pathLookupError: expect.stringContaining('not found on PATH'),
        }),
      });
    }
  });
});
