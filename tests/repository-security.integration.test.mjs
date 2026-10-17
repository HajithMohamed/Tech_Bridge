import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { inspectPaths, trackedPaths } from '../scripts/repository-security.mjs';

const root = resolve(import.meta.dirname, '..');
const gitOptions = ['-c', `safe.directory=${root.replaceAll('\\', '/')}`];

test('real Git index excludes local environments, dependencies, and compiled output', () => {
  const paths = trackedPaths(root);
  assert.ok(paths.includes('backend/src/server.ts'));
  assert.ok(paths.includes('frontend/src/App.tsx'));
  assert.deepEqual(inspectPaths(paths), []);
});
test('Git ignore rules protect future environment variants and generated files', () => {
  const paths = ['backend/.env', 'frontend/.env.production', 'backend/node_modules/future/index.js', 'backend/dist/server.js', 'frontend/coverage/result.json'];
  const ignored = execFileSync('git', [...gitOptions, 'check-ignore', '--no-index', '--stdin'], {
    cwd: root, input: paths.join('\n') + '\n', encoding: 'utf8',
  }).trim().split(/\r?\n/);
  assert.deepEqual(ignored, paths);
  const example = spawnSync('git', [...gitOptions, 'check-ignore', '--no-index', 'backend/.env.example'], { cwd: root });
  assert.equal(example.status, 1);
});
test('environment example contains no database authentication or signing secret', () => {
  const example = readFileSync(resolve(root, 'backend/.env.example'), 'utf8');
  assert.match(example, /^JWT_SECRET=\s*$/m);
  assert.match(example, /^MONGODB_URI=mongodb:\/\/127\.0\.0\.1:/m);
});
test('audit CLI completes successfully and emits counts only', () => {
  const output = execFileSync(process.execPath, ['scripts/repository-security.mjs'], { cwd: root, encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.deepEqual(report.forbiddenTrackedFiles, { environment: 0, dependency: 0, 'build-output': 0 });
  assert.ok(report.trackedFiles > 0);
});
