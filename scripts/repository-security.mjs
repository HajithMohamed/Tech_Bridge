import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Filename policy only. This deliberately never reads environment-file contents.
export function classifyPath(filename) {
  const parts = filename.replaceAll('\\', '/').toLowerCase().split('/');
  const name = parts.at(-1);
  if (parts.includes('node_modules')) return 'dependency';
  if (parts.includes('dist')) return 'build-output';
  if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example')) return 'environment';
  return null;
}

export function inspectPaths(filenames) {
  return filenames.flatMap((path) => {
    const category = classifyPath(path);
    return category ? [{ path, category }] : [];
  });
}

export function trackedPaths(cwd = process.cwd()) {
  // Scope the ownership exception to the explicitly selected workspace and call.
  return execFileSync('git', ['-c', `safe.directory=${resolve(cwd).replaceAll('\\', '/')}`, 'ls-files', '-z'], {
    cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const paths = trackedPaths();
    const findings = inspectPaths(paths);
    const counts = Object.fromEntries(['environment', 'dependency', 'build-output'].map((category) => [
      category, findings.filter((finding) => finding.category === category).length,
    ]));
    console.log(JSON.stringify({ trackedFiles: paths.length, forbiddenTrackedFiles: counts }, null, 2));
    process.exitCode = findings.length ? 1 : 0;
  } catch {
    console.error('Unable to inspect the Git index. Run this command from the repository root.');
    process.exitCode = 1;
  }
}
