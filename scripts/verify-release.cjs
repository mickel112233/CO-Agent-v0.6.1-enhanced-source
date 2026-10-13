'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readJson = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
async function exists(file) {
  try { return (await fs.stat(path.join(root, file))).isFile(); }
  catch { return false; }
}
async function main() {
  const pkg = await readJson('package.json');
  const required = ['dist/index.html', 'electron/main.cjs', 'electron/preload.cjs'];
  const missing = [];
  for (const file of required) if (!await exists(file)) missing.push(file);
  if (missing.length) throw new Error('Release is missing required runtime files: ' + missing.join(', '));
  if (!pkg.version || !pkg.build?.appId || !pkg.build?.productName) throw new Error('package.json is missing release identity metadata.');
  if (process.platform === 'win32') {
    const releaseDir = path.join(root, pkg.build.directories?.output || 'release');
    const entries = await fs.readdir(releaseDir, { withFileTypes: true }).catch(() => []);
    const installers = entries.filter(entry => entry.isFile() && /^CO-Agent.*Setup.*\.exe$/i.test(entry.name));
    if (!installers.length) throw new Error('Windows packaging completed without a CO-Agent Setup .exe in ' + releaseDir);
    for (const installer of installers) {
      const stat = await fs.stat(path.join(releaseDir, installer.name));
      if (stat.size < 1024 * 1024) throw new Error('Windows installer is unexpectedly small: ' + installer.name + ' (' + stat.size + ' bytes)');
      process.stdout.write('Verified Windows installer: ' + installer.name + ' (' + stat.size + ' bytes)\n');
    }
  }
  process.stdout.write('Release verification passed for CO-Agent ' + pkg.version + '. Required runtime files and package identity are present.\n');
}
main().catch(error => {
  process.stderr.write('Release verification failed: ' + (error.message || String(error)) + '\n');
  process.exitCode = 1;
});
