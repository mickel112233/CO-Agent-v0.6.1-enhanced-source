'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const ocr = require('./ocr.cjs');
const hyperframesService = require('./hyperframes.cjs');

const TOOLS = Object.freeze({
  ollama: Object.freeze({ id: 'ollama', name: 'Ollama', kind: 'local-runtime', required: true, description: 'Local model runtime used by CO-Agent chat and model downloads.', install: 'winget', command: 'winget', args: ['install', '--id', 'Ollama.Ollama', '--exact', '--accept-package-agreements', '--accept-source-agreements'], docs: 'https://ollama.com/download/windows' }),
  tesseract: Object.freeze({ id: 'tesseract', name: 'Tesseract OCR', kind: 'native', required: false, description: 'Local image-to-text extraction for screenshots, scans, and still images.', install: 'winget', command: 'winget', args: ['install', '--id', 'UB-Mannheim.TesseractOCR', '--exact', '--accept-package-agreements', '--accept-source-agreements'], docs: 'https://tesseract-ocr.github.io/tessdoc/Installation.html' }),
  hyperframes: Object.freeze({ id: 'hyperframes', name: 'Hyperframes', kind: 'npm-cli', required: false, description: 'Create and render HTML/CSS/animation compositions as video.', install: 'npm', command: 'npm', args: ['install', '--global', 'hyperframes'], docs: 'https://hyperframes.app/docs/5-packages/cli' }),
  luxtts: Object.freeze({ id: 'luxtts', name: 'LuxTTS', kind: 'python-runtime', required: false, description: 'Local text-to-speech for generated voiceovers and audio assets. Use the dedicated CO-Agent LuxTTS setup flow.', install: null, command: null, args: [], docs: 'https://github.com/ysharma3501/LuxTTS' }),
});
const MAX_REPO_FILES = 10000;
const MAX_REPO_FILE_BYTES = 25 * 1024 * 1024;
const MAX_REPO_TOTAL_BYTES = 250 * 1024 * 1024;
async function validateRepositoryTree(root) {
  const base = await fs.realpath(root);
  const pending = [base];
  let fileCount = 0, totalBytes = 0;
  while (pending.length) {
    const directory = pending.pop();
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (directory === base && entry.name === '.git') continue;
      const full = path.join(directory, entry.name);
      const stat = await fs.lstat(full);
      if (stat.isSymbolicLink()) throw new Error('Imported repositories containing symbolic links are not accepted for review-only import: ' + path.relative(base, full).slice(0, 240));
      if (stat.isDirectory()) { pending.push(full); continue; }
      if (!stat.isFile()) throw new Error('Repository contains a non-regular filesystem entry: ' + path.relative(base, full).slice(0, 240));
      fileCount++;
      if (fileCount > MAX_REPO_FILES) throw new Error('Repository exceeds the 10,000-file review limit.');
      if (stat.size > MAX_REPO_FILE_BYTES) throw new Error('Repository file exceeds 25 MB: ' + path.relative(base, full).slice(0, 240));
      totalBytes += stat.size;
      if (totalBytes > MAX_REPO_TOTAL_BYTES) throw new Error('Repository exceeds the 250 MB total review limit.');
    }
  }
  return { fileCount, totalBytes };
}
const GITHUB_HTTPS = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;
const REF_RE = /^(?!-)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._/-]{1,128}$/;
function commandFor(name) {
  if (process.platform !== 'win32') return name;
  return name;
}
async function runFixedCommand(file, args, options = {}) {
  if (process.platform === 'win32' && ['npm', 'hyperframes', 'winget'].includes(file)) {
    const command = [file, ...args].join(' ');
    return execFileAsync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], { windowsHide: true, ...options });
  }
  return execFileAsync(commandFor(file), args, { windowsHide: true, ...options });
}
async function executableVersion(file, args = ['--version']) {
  try {
    const result = await runFixedCommand(file, args, { timeout: 8000, maxBuffer: 1024 * 1024 });
    return { available: true, version: String(result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] };
  } catch (error) {
    return { available: false, version: '', error: String(error.message || 'Not found').slice(0, 240) };
  }
}
async function getStatus() {
  const [ollamaExecutable, tesseract, hyperframes, git] = await Promise.all([
    executableVersion('ollama'),
    ocr.getStatus(),
    hyperframesService.getStatus(),
    executableVersion('git')
  ]);
  return {
    tools: [
      { ...TOOLS.ollama, ...ollamaExecutable, installed: ollamaExecutable.available, installAvailable: process.platform === 'win32' && !!(await executableVersion('winget')).available },
      { ...TOOLS.tesseract, ...tesseract, installed: tesseract.available, installAvailable: process.platform === 'win32' && !!(await executableVersion('winget')).available },
      { ...TOOLS.hyperframes, ...hyperframes, installed: hyperframes.available, installAvailable: !!(await executableVersion('npm')).available },
      { id: 'git', name: 'Git', kind: 'repository-runtime', required: false, description: 'Needed to import public GitHub repositories and skills.', docs: 'https://git-scm.com/downloads', ...git, installed: git.available, installAvailable: false }
    ],
    gitAvailable: git.available,
    extensionDirectory: ''
  };
}
async function installTool(id) {
  const tool = TOOLS[id];
  if (!tool || !tool.install) throw new Error('This integration has no supported one-click installer. Follow its official setup guide instead.');
  if (tool.install === 'winget' && process.platform !== 'win32') throw new Error('The one-click Tesseract installer is available on Windows only. Use the official installation guide for this operating system.');
  const { stdout, stderr } = await runFixedCommand(tool.command, tool.args, { timeout: 15 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 });
  return { ok: true, id, message: String(stdout || stderr || (tool.name + ' installer completed.')).trim().slice(-5000) };
}
function repoDetails(root, slug, url, ref, manifest = {}) {
  const packageInfo = manifest.package || {};
  return {
    name: String(packageInfo.displayName || packageInfo.name || manifest.plugin?.name || manifest.skill?.name || slug).slice(0, 120),
    slug, url, ref: ref || 'default branch',
    path: root,
    type: manifest.skill ? 'skill' : manifest.plugin ? 'plugin' : packageInfo.name ? 'Node.js repository' : 'repository',
    hasPackageJson: !!manifest.package,
    hasSkill: !!manifest.skill,
    hasPluginManifest: !!manifest.plugin,
    description: String(packageInfo.description || manifest.plugin?.description || manifest.skill?.description || 'No description found.').slice(0, 500),
    installScripts: Object.keys(packageInfo.scripts || {}).filter(key => /install|postinstall|prepare|preinstall/i.test(key)),
    dependencies: Object.keys(packageInfo.dependencies || {}).length,
    note: 'Repository files were cloned for review only. CO-Agent has not executed its code or installed its dependencies.'
  };
}
async function readSafeFile(root, name) {
  const base = await fs.realpath(root);
  const file = path.join(base, name);
  const stat = await fs.lstat(file).catch(() => null);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) return null;
  const real = await fs.realpath(file).catch(() => null);
  if (!real || path.dirname(real) !== base) return null;
  return fs.readFile(real, 'utf8').catch(() => null);
}
async function inspectRepo(root, url, ref, slug) {
  const [pkgText, pluginText, skillText] = await Promise.all([
    readSafeFile(root, 'package.json'),
    readSafeFile(root, 'openclaw.plugin.json'),
    readSafeFile(root, 'SKILL.md')
  ]);
  const parse = (value, label) => {
    if (!value) return null;
    try { return JSON.parse(value); } catch { throw new Error('The repository contains an invalid ' + label + '.'); }
  };
  const skill = skillText ? { name: slug, description: skillText.split(/\r?\n/).find(line => /^description\s*:/i.test(line))?.split(':').slice(1).join(':').trim() || '' } : null;
  return repoDetails(root, slug, url, ref, { package: parse(pkgText, 'package.json'), plugin: parse(pluginText, 'openclaw.plugin.json'), skill });
}
async function listRepos(userDataPath) {
  const root = path.join(userDataPath, 'extensions');
  await fs.mkdir(root, { recursive: true });
  const entries = await fs.readdir(root, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const manifest = await fs.readFile(path.join(root, entry.name, '.co-agent-source.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (!manifest) continue;
    try { result.push(await inspectRepo(path.join(root, entry.name), manifest.url, manifest.ref, entry.name)); } catch { result.push({ slug: entry.name, name: entry.name, type: 'repository', url: manifest.url, ref: manifest.ref || 'default branch', path: path.join(root, entry.name), note: 'Could not read the repository manifest.' }); }
  }
  return result;
}
async function installRepo({ url, ref = '' } = {}, userDataPath) {
  if (typeof url !== 'string' || url.length > 500 || !GITHUB_HTTPS.test(url.trim())) throw new Error('Enter a public GitHub repository URL in the form https://github.com/owner/repo. Other hosts and local paths are not supported yet.');
  const cleanUrl = url.trim().replace(/\/$/, '');
  if (ref && (typeof ref !== 'string' || !REF_RE.test(ref) || ref.startsWith('-') || ref.includes('..') || ref.includes('//'))) throw new Error('Branch, tag, or commit reference contains unsupported characters.');
  const match = cleanUrl.match(GITHUB_HTTPS);
  const owner = match[1], repository = match[2].replace(/\.git$/, '');
  const slug = (owner + '-' + repository).toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 100);
  const root = path.join(userDataPath, 'extensions');
  await fs.mkdir(root, { recursive: true });
  const destination = path.join(root, slug);
  const exists = await fs.access(destination).then(() => true).catch(() => false);
  if (exists) throw new Error('This repository is already imported. Remove or rename its existing folder before importing it again.');
  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push('--', cleanUrl, destination);
  try {
    await execFileAsync('git', args, { windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
    throw new Error('Could not clone the repository. Check the URL, branch/tag, Git installation, and network access. ' + String(error.stderr || error.message || '').slice(-1000));
  }
  try {
    const size = await validateRepositoryTree(destination);
    const details = await inspectRepo(destination, cleanUrl, ref, slug);
    details.reviewLimits = { ...size, maxFiles: MAX_REPO_FILES, maxFileBytes: MAX_REPO_FILE_BYTES, maxTotalBytes: MAX_REPO_TOTAL_BYTES };
    await fs.writeFile(path.join(destination, '.co-agent-source.json'), JSON.stringify({ url: cleanUrl, ref, importedAt: new Date().toISOString() }, null, 2), { flag: 'wx' });
    return { ok: true, repository: details };
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
async function getSkillContents(slugs, userDataPath) {
  if (!Array.isArray(slugs)) return [];
  const root = path.resolve(userDataPath, 'extensions');
  const selected = [...new Set(slugs)].slice(0, 8);
  const result = [];
  for (const slug of selected) {
    if (typeof slug !== 'string' || !/^[a-z0-9._-]{1,100}$/.test(slug)) continue;
    const repoRoot = path.resolve(root, slug);
    if (path.dirname(repoRoot) !== root) continue;
    const metadata = await fs.readFile(path.join(repoRoot, '.co-agent-source.json'), 'utf8').then(JSON.parse).catch(() => null);
    if (!metadata) continue;
    const skillPath = path.join(repoRoot, 'SKILL.md');
    const content = await readSafeFile(repoRoot, 'SKILL.md');
    if (!content || content.length > 30000) continue;
    result.push({ slug, content: content.slice(0, 30000), url: metadata.url });
  }
  return result;
}
async function removeRepo(slug, userDataPath) {
  if (typeof slug !== 'string' || !/^[a-z0-9._-]{1,100}$/.test(slug)) throw new Error('Invalid extension identifier.');
  const root = path.join(userDataPath, 'extensions');
  const target = path.resolve(root, slug);
  if (path.dirname(target) !== path.resolve(root)) throw new Error('Invalid extension path.');
  const metadata = await fs.readFile(path.join(target, '.co-agent-source.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (!metadata) throw new Error('This folder is not a repository imported by CO-Agent.');
  await fs.rm(target, { recursive: true, force: false });
  return { ok: true, removed: slug };
}
module.exports = { TOOLS, getStatus, installTool, installRepo, listRepos, inspectRepo, getSkillContents, removeRepo, GITHUB_HTTPS, REF_RE, MAX_REPO_FILES, MAX_REPO_FILE_BYTES, MAX_REPO_TOTAL_BYTES, validateRepositoryTree };
