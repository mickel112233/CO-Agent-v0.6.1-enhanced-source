'use strict';

function isTrustedRendererUrl(value, options = {}) {
  if (typeof value !== 'string' || !value) return false;
  let actual;
  try { actual = new URL(value); } catch { return false; }

  if (options.isDev === true) {
    return actual.protocol === 'http:' &&
      actual.hostname === '127.0.0.1' &&
      actual.port === '5173' &&
      !actual.username &&
      !actual.password;
  }

  if (typeof options.appUrl !== 'string' || !options.appUrl) return false;
  let expected;
  try { expected = new URL(options.appUrl); } catch { return false; }
  if (actual.protocol !== 'file:' || expected.protocol !== 'file:') return false;

  // Permit in-app hash/query navigation, but never a different local file.
  const actualDocument = actual.href.split(/[?#]/, 1)[0];
  const expectedDocument = expected.href.split(/[?#]/, 1)[0];
  return actualDocument === expectedDocument;
}

module.exports = { isTrustedRendererUrl };
