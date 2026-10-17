import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPath, inspectPaths } from '../scripts/repository-security.mjs';

test('rejects environment variants at every depth and on Windows', () => {
  for (const path of ['.env', 'backend/.env', 'frontend/.env.production.local', 'backend\\.env.test', 'BACKEND/.ENV']) {
    assert.equal(classifyPath(path), 'environment');
  }
});
test('allows only the explicitly named environment example', () => {
  assert.equal(classifyPath('backend/.env.example'), null);
  assert.equal(classifyPath('backend/.env.example.local'), 'environment');
});
test('rejects nested dependency and compiled output directories', () => {
  assert.equal(classifyPath('backend/node_modules/a/index.js'), 'dependency');
  assert.equal(classifyPath('frontend/dist/assets/index.js'), 'build-output');
});
test('retains source, lockfiles, and similarly named legitimate files', () => {
  for (const path of ['backend/package-lock.json', 'frontend/src/main.tsx', 'docs/environment.md', 'src/distribution.ts']) {
    assert.equal(classifyPath(path), null);
  }
});
test('returns categorized paths without reading or reporting file contents', () => {
  assert.deepEqual(inspectPaths(['backend/.env', 'README.md']), [{ path: 'backend/.env', category: 'environment' }]);
});
