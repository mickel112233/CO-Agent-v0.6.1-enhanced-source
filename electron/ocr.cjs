'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp']);
const DEFAULT_CANDIDATES = process.platform === 'win32' ? ['C:\\Program Files\\Tesseract-OCR\\tesseract.exe', 'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe', 'tesseract.exe'] : ['tesseract'];
function candidates() { return [process.env.TESSERACT_PATH, ...DEFAULT_CANDIDATES].filter(Boolean); }
async function findBinary() {
  for (const binary of candidates()) {
    try { await execFileAsync(binary, ['--version'], { windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 }); return binary; }
    catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EACCES') return binary; }
  }
  return null;
}
async function getStatus() {
  const binary = await findBinary();
  if (!binary) return { available: false, binary: null, error: 'Tesseract OCR was not found. Install it and restart CO-Agent, or set TESSERACT_PATH.' };
  try {
    const { stdout, stderr } = await execFileAsync(binary, ['--version'], { windowsHide: true, timeout: 5000, maxBuffer: 1024 * 1024 });
    return { available: true, binary, version: (stdout || stderr || '').split(/\r?\n/)[0].trim() };
  } catch (error) { return { available: true, binary, version: String(error.stdout || error.stderr || 'Tesseract detected').split(/\r?\n/)[0].trim() }; }
}
async function recognizeImage(inputPath, language = 'eng') {
  const imagePath = path.resolve(String(inputPath || ''));
  if (!inputPath) throw new Error('Choose an image for OCR.');
  if (!IMAGE_EXTENSIONS.has(path.extname(imagePath).toLowerCase())) throw new Error('OCR supports PNG, JPEG, TIFF, BMP, and WebP images.');
  const stat = await fs.stat(imagePath);
  if (!stat.isFile()) throw new Error('The OCR input must be a file.');
  if (stat.size > 100 * 1024 * 1024) throw new Error('The selected image is larger than the 100 MB OCR limit.');
  const lang = String(language || 'eng').trim();
  if (!/^[A-Za-z0-9_+-]{2,64}$/.test(lang)) throw new Error('Invalid OCR language code.');
  const status = await getStatus();
  if (!status.available) throw new Error(status.error);
  try {
    const { stdout } = await execFileAsync(status.binary, [imagePath, 'stdout', '-l', lang, '--psm', '3'], { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
    return { ok: true, text: String(stdout || '').trim(), language: lang, binary: status.binary };
  } catch (error) { throw new Error('Tesseract OCR failed: ' + String(error.stderr || error.message || 'Tesseract OCR failed.').slice(-1800)); }
}
module.exports = { getStatus, recognizeImage, IMAGE_EXTENSIONS };
