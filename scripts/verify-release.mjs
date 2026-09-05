import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('.output/chrome-mv3');
const manifestPath = path.join(outputDir, 'manifest.json');

async function fail(message) {
  console.error(`Release verification failed: ${message}`);
  process.exitCode = 1;
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const expectedVersion = process.env.WXT_RELEASE_VERSION;

  if (manifest.manifest_version !== 3) {
    await fail('manifest_version must be 3.');
  }

  if (expectedVersion && manifest.version !== expectedVersion) {
    await fail(
      `manifest version ${manifest.version ?? '(missing)'} does not match ${expectedVersion}.`,
    );
  }

  for (const resource of manifest.web_accessible_resources ?? []) {
    for (const pattern of resource.matches ?? []) {
      if (pattern === '<all_urls>') continue;
      const originEnd = pattern.indexOf('/', pattern.indexOf('://') + 3);
      if (!pattern.includes('://') || pattern.slice(originEnd) !== '/*') {
        await fail('web-accessible resource match patterns must use the path /*.');
      }
    }
  }

  const requiredIcons = ['16', '32', '48', '128'];
  for (const size of requiredIcons) {
    const iconPath = manifest.icons?.[size];
    if (!iconPath) {
      await fail(`manifest icon ${size} is missing.`);
      continue;
    }
    try {
      await access(path.join(outputDir, iconPath));
    } catch {
      await fail(`manifest icon ${size} points to a missing file.`);
    }
  }

  const secretPatterns = [
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    /\bAIza[0-9A-Za-z_-]{30,}\b/g,
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  ];

  const files = await walk(outputDir);
  const unsafeFiles = [];
  for (const file of files) {
    const info = await stat(file);
    if (info.size > 10 * 1024 * 1024) continue;
    const contents = await readFile(file, 'utf8');
    if (secretPatterns.some((pattern) => pattern.test(contents))) {
      unsafeFiles.push(path.relative(outputDir, file));
    }
    for (const pattern of secretPatterns) pattern.lastIndex = 0;
  }

  if (unsafeFiles.length > 0) {
    await fail(
      `possible embedded credential found in ${unsafeFiles.length} generated file(s). Values were not printed.`,
    );
  }

  if (process.exitCode !== 1) {
    console.log(`Release verification passed for NAVI ${manifest.version}.`);
  }
} catch (error) {
  await fail(error instanceof Error ? error.message : String(error));
}
