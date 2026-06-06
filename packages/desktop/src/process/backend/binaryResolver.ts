/**
 * Resolve the ByteTensorCore binary path.
 *
 * Search order:
 *  1. Bundled with app (production)
 *  2. Checked-out resources directory (development)
 *  3. System PATH
 */

import { existsSync, readdirSync } from 'node:fs';
import { cwd } from 'node:process';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const BINARY_NAME = 'bytetensorcore';
const LEGACY_BINARY_NAME = 'aioncore';
const BUNDLED_DIR = 'bundled-bytetensorcore';
const LEGACY_BUNDLED_DIR = 'bundled-aioncore';
const MAX_DIR_ENTRIES = 20;
const MAX_LOOKUP_TEXT_LENGTH = 1000;

type BackendBinaryResolveDiagnostics = {
  resourcesPath?: string;
  runtimeKey: string;
  binaryName: string;
  checkedBundledPath?: string;
  bundledDirExists?: boolean;
  runtimeDirExists?: boolean;
  legacyBinaryName?: string;
  legacyCheckedBundledPath?: string;
  legacyBundledDirExists?: boolean;
  legacyRuntimeDirExists?: boolean;
  resourcesDirEntries?: string[];
  runtimeDirEntries?: string[];
  legacyRuntimeDirEntries?: string[];
  pathLookupCommand: string;
  pathLookupResult?: string;
  pathLookupError?: string;
};

class BackendBinaryResolveError extends Error {
  readonly diagnostics: BackendBinaryResolveDiagnostics;

  constructor(message: string, diagnostics: BackendBinaryResolveDiagnostics) {
    super(message);
    this.name = 'BackendBinaryResolveError';
    this.diagnostics = diagnostics;
  }
}

function getBinaryName(binaryName = BINARY_NAME): string {
  return process.platform === 'win32' ? `${binaryName}.exe` : binaryName;
}

function getRuntimeKey(): string {
  return `${process.platform}-${process.arch}`;
}

function listDirEntries(dirPath: string): string[] | undefined {
  try {
    return readdirSync(dirPath, { withFileTypes: true })
      .slice(0, MAX_DIR_ENTRIES)
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`);
  } catch {
    return undefined;
  }
}

function trimLookupText(text: string): string {
  return text.trim().slice(0, MAX_LOOKUP_TEXT_LENGTH);
}

/**
 * Resolve the ByteTensorCore binary path.
 * Returns the absolute path to the binary, or throws if not found.
 */
export function resolveBinaryPath(): string {
  const runtimeKey = getRuntimeKey();
  const binaryName = getBinaryName();
  const diagnostics: BackendBinaryResolveDiagnostics = {
    runtimeKey,
    binaryName,
    pathLookupCommand: process.platform === 'win32' ? `where ${BINARY_NAME}` : `which ${BINARY_NAME}`,
  };

  const bundled = bundledPath(runtimeKey, binaryName, diagnostics);
  if (bundled) return bundled;

  const fromPath = resolveFromSystemPATH(diagnostics);
  if (fromPath) return fromPath;

  throw new BackendBinaryResolveError(
    `Cannot find "${BINARY_NAME}" binary. Checked bundled location, legacy bundled location, and system PATH.`,
    diagnostics
  );
}

type BundledCandidate = {
  bundledDir: string;
  runtimeDir: string;
  candidate: string;
};

function getBundledCandidate(
  resourcesPath: string,
  bundledDirName: string,
  runtimeKey: string,
  binaryName: string
): BundledCandidate {
  const bundledDir = join(resourcesPath, bundledDirName);
  const runtimeDir = join(bundledDir, runtimeKey);
  return { bundledDir, runtimeDir, candidate: join(runtimeDir, binaryName) };
}

/**
 * Check bundled binary in resources directory.
 * Preferred layout: bundled-bytetensorcore/{platform}-{arch}/bytetensorcore[.exe]
 * Legacy layout: bundled-aioncore/{platform}-{arch}/aioncore[.exe]
 */
function bundledPath(
  runtimeKey: string,
  binaryName: string,
  diagnostics: BackendBinaryResolveDiagnostics
): string | null {
  const resourcesPath = resolveResourcesPath();
  if (!resourcesPath) return null;
  diagnostics.resourcesPath = resourcesPath;
  diagnostics.resourcesDirEntries = listDirEntries(resourcesPath);

  const preferred = getBundledCandidate(resourcesPath, BUNDLED_DIR, runtimeKey, binaryName);
  diagnostics.checkedBundledPath = preferred.candidate;
  diagnostics.bundledDirExists = existsSync(preferred.bundledDir);
  diagnostics.runtimeDirExists = existsSync(preferred.runtimeDir);
  diagnostics.runtimeDirEntries = listDirEntries(preferred.runtimeDir);
  if (existsSync(preferred.candidate)) return preferred.candidate;

  const legacyBinaryName = getBinaryName(LEGACY_BINARY_NAME);
  const legacy = getBundledCandidate(resourcesPath, LEGACY_BUNDLED_DIR, runtimeKey, legacyBinaryName);
  diagnostics.legacyBinaryName = legacyBinaryName;
  diagnostics.legacyCheckedBundledPath = legacy.candidate;
  diagnostics.legacyBundledDirExists = existsSync(legacy.bundledDir);
  diagnostics.legacyRuntimeDirExists = existsSync(legacy.runtimeDir);
  diagnostics.legacyRuntimeDirEntries = listDirEntries(legacy.runtimeDir);
  if (existsSync(legacy.candidate)) return legacy.candidate;

  return null;
}

function hasKnownBundledDir(resourcesPath: string): boolean {
  return existsSync(join(resourcesPath, BUNDLED_DIR)) || existsSync(join(resourcesPath, LEGACY_BUNDLED_DIR));
}

function resolveResourcesPath(): string | undefined {
  const packagedResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (packagedResourcesPath && hasKnownBundledDir(packagedResourcesPath)) return packagedResourcesPath;
  const devResourcesPath = join(cwd(), 'resources');
  if (hasKnownBundledDir(devResourcesPath)) return devResourcesPath;
  return packagedResourcesPath;
}

/**
 * Try to find the binary on the system PATH.
 */
function resolveFromSystemPATH(diagnostics: BackendBinaryResolveDiagnostics): string | null {
  try {
    const result = execSync(diagnostics.pathLookupCommand, { encoding: 'utf-8', timeout: 5000 }).trim();
    diagnostics.pathLookupResult = trimLookupText(result);
    const firstMatch = result.split(/\r?\n/).find((line) => line.trim());
    if (firstMatch && existsSync(firstMatch.trim())) return firstMatch.trim();
  } catch (error) {
    diagnostics.pathLookupError = error instanceof Error ? trimLookupText(error.message) : String(error);
    return null;
  }
  return null;
}

export type { BackendBinaryResolveDiagnostics };
