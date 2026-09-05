import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifier = fileURLToPath(new URL('./verify-release.mjs', import.meta.url));

async function verifyFixture(t, matches, script = '') {
  const directory = await mkdtemp(path.join(tmpdir(), 'navi-release-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, '.output/chrome-mv3');
  await mkdir(output, { recursive: true });
  const icons = Object.fromEntries(
    ['16', '32', '48', '128'].map((size) => [size, `icon-${size}.png`]),
  );
  await Promise.all([
    writeFile(path.join(output, 'manifest.json'), JSON.stringify({
      manifest_version: 3,
      version: '1.0.1.1',
      icons,
      web_accessible_resources: [{ resources: ['icons/*'], matches }],
    })),
    ...Object.values(icons).map((file) => writeFile(path.join(output, file), 'fixture')),
    writeFile(path.join(output, 'content.js'), script),
  ]);
  return spawnSync(process.execPath, [verifier], {
    cwd: directory,
    env: { ...process.env, WXT_RELEASE_VERSION: '1.0.1.1' },
    encoding: 'utf8',
  });
}

test('accepts Chrome origin-wide resource matches', async (t) => {
  const result = await verifyFixture(t, ['https://docs.google.com/*']);
  assert.equal(result.status, 0, result.stderr);
});

for (const documentType of ['document', 'presentation', 'spreadsheets']) {
  test(`rejects a resource match limited to a ${documentType} path`, async (t) => {
    const result = await verifyFixture(t, [`https://docs.google.com/${documentType}/*`]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /resource match patterns must use the path/);
  });
}

test('rejects a credential-shaped value without disclosing it', async (t) => {
  const fakeCredential = `sk-${'synthetic'.repeat(4)}`;
  const result = await verifyFixture(t, ['https://docs.google.com/*'], fakeCredential);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /possible embedded credential/);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(fakeCredential));
});
