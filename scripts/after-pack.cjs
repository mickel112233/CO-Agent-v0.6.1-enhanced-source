'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Bundle the optional, prebuilt Tauri pet into Electron's app resources.
 * A missing executable is allowed for local builds; CO-Agent then reports
 * the pet as not installed rather than shipping a fake placeholder.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const projectDir = context.packager.projectDir;
  const executable = path.join(projectDir, 'integrations', 'AI-Desktop-Pet', 'src-tauri', 'target', 'release', 'convai-desktop-pet.exe');
  const stat = await fs.stat(executable).catch(() => null);
  if (!stat?.isFile()) {
    console.warn('[CO-Agent] Desktop pet executable was not built; packaging CO-Agent without the optional pet runtime.');
    return;
  }
  const destinationDir = path.join(context.appOutDir, 'resources', 'pet');
  await fs.mkdir(destinationDir, { recursive: true });
  await fs.copyFile(executable, path.join(destinationDir, 'convai-desktop-pet.exe'));
  console.log('[CO-Agent] Bundled desktop pet executable into resources/pet/.');
};
