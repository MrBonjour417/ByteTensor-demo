import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveBinaryPath } from './binaryResolver';

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

  it('prefers bundled ByteTensorCore binary', () => {
    const resourcesPath = '/app/resources';
    const runtimeKey = `${process.platform}-${process.arch}`;
    const binaryName = process.platform === 'win32' ? 'bytetensorcore.exe' : 'bytetensorcore';
    const checkedBundledPath = join(resourcesPath, 'bundled-bytetensorcore', runtimeKey, binaryName);

    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockImplementation((path) =>
      [
        join(resourcesPath, 'bundled-bytetensorcore'),
        join(resourcesPath, 'bundled-bytetensorcore', runtimeKey),
        checkedBundledPath,
      ].includes(String(path))
    );

    expect(resolveBinaryPath()).toBe(checkedBundledPath);
    expect(execSync).not.toHaveBeenCalled();
  });

  it('falls back to the legacy bundled aioncore binary during local transition', () => {
    const resourcesPath = '/app/resources';
    const runtimeKey = `${process.platform}-${process.arch}`;
    const legacyBinaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
    const legacyBundledPath = join(resourcesPath, 'bundled-aioncore', runtimeKey, legacyBinaryName);

    setResourcesPath(resourcesPath);
    vi.mocked(existsSync).mockImplementation((path) =>
      [
        join(resourcesPath, 'bundled-aioncore'),
        join(resourcesPath, 'bundled-aioncore', runtimeKey),
        legacyBundledPath,
      ].includes(String(path))
    );

    expect(resolveBinaryPath()).toBe(legacyBundledPath);
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
