import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const verifier = fileURLToPath(new URL('./verify-release.mjs', import.meta.url));

async function verifyFixture({
  testContext,
  matches = ['https://docs.google.com/*'],
  script = '',
  manifestFields = {},
  outputDirectory,
}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'navi-release-test-'));
  testContext.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, outputDirectory ?? '.output/chrome-mv3');
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
      ...manifestFields,
    })),
    ...Object.values(icons).map((file) => writeFile(path.join(output, file), 'fixture')),
    writeFile(path.join(output, 'content.js'), script),
  ]);
  return spawnSync(process.execPath, [verifier, ...(outputDirectory ? [outputDirectory] : [])], {
    cwd: directory,
    env: { ...process.env, WXT_RELEASE_VERSION: '1.0.1.1' },
    encoding: 'utf8',
  });
}

test('accepts Chrome origin-wide resource matches', async (testContext) => {
  const result = await verifyFixture({ testContext });
  assert.equal(result.status, 0, result.stderr);
});

test('accepts an explicitly supplied extracted ZIP directory', async (testContext) => {
  const result = await verifyFixture({ testContext, outputDirectory: 'extracted-zip' });
  assert.equal(result.status, 0, result.stderr);
});

for (const key of ['development-public-key', '']) {
  test(`rejects a manifest key field with value ${JSON.stringify(key)}`, async (testContext) => {
    const result = await verifyFixture({ testContext, manifestFields: { key } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /manifest key is for local development/);
  });
}

for (const documentType of ['document', 'presentation', 'spreadsheets']) {
  test(`rejects a resource match limited to a ${documentType} path`, async (testContext) => {
    const result = await verifyFixture({
      testContext,
      matches: [`https://docs.google.com/${documentType}/*`],
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /resource match patterns must use the path/);
  });
}

test('rejects a credential-shaped value without disclosing it', async (testContext) => {
  const fakeCredential = `sk-${'synthetic'.repeat(4)}`;
  const result = await verifyFixture({ testContext, script: fakeCredential });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /possible embedded credential/);
  assert.ok(!`${result.stdout}${result.stderr}`.includes(fakeCredential));
});
