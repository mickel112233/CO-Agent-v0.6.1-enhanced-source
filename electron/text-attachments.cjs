'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_FILES = 8;
const MAX_FILE_BYTES = 8 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.log', '.js', '.jsx', '.ts', '.tsx',
  '.py', '.html', '.css', '.yaml', '.yml', '.xml', '.toml', '.ini', '.sql', '.sh',
  '.ps1', '.bat', '.c', '.h', '.cpp', '.hpp', '.java', '.go', '.rs', '.php'
]);

async function readTextAttachments(filePaths) {
  if (!Array.isArray(filePaths)) throw new Error('Select text files using the file picker.');
  if (filePaths.length > MAX_FILES) throw new Error('Attach at most ' + MAX_FILES + ' text files at once.');
  const attachments = [];
  let totalBytes = 0;
  for (const value of filePaths) {
    if (typeof value !== 'string' || !value.trim() || value.length > 32768 || /[\x00-\x1f\x7f]/.test(value)) {
      throw new Error('A selected file path is invalid.');
    }
    const file = path.resolve(value);
    if (!ALLOWED_EXTENSIONS.has(path.extname(file).toLowerCase())) {
      throw new Error('Unsupported text attachment type: ' + path.extname(file) + '. Choose a text or source file.');
    }
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Attachments must be regular files.');
    if (stat.size > MAX_FILE_BYTES) throw new Error(path.basename(file) + ' exceeds the 8 KB per-file attachment limit.');
    const buffer = await fs.readFile(file);
    if (buffer.includes(0)) throw new Error(path.basename(file) + ' appears to be binary data, not a text file.');
    totalBytes += buffer.length;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Text attachments exceed the 12 KB total context limit.');
    attachments.push({
      name: path.basename(file).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180),
      content: buffer.toString('utf8'),
      size: buffer.length
    });
  }
  return attachments;
}

module.exports = { readTextAttachments, MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, ALLOWED_EXTENSIONS };
