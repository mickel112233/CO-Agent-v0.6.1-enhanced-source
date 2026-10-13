'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Video Studio passes the selected local or API provider into chat-driven timeline planning', async () => {
  const app = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');
  const video = await fs.readFile(path.join(root, 'src', 'VideoEditor.jsx'), 'utf8');
  const timeline = await fs.readFile(path.join(root, 'src', 'TimelineEditor.jsx'), 'utf8');

  assert.match(app, /<VideoEditor chatConfig=\{chatProvider === 'ollama'/);
  assert.match(app, /providerConfig: \{ protocol: apiProtocol, baseUrl: apiBaseUrl\.trim\(\), model: apiModel\.trim\(\) \}, apiKey: apiKey\.trim\(\)/);
  assert.match(video, /function VideoEditor\(\{ chatConfig = \{ provider: 'ollama' \} \}\)/);
  assert.match(video, /<TimelineEditor chatConfig=\{chatConfig\}/);
  assert.match(timeline, /chatConfig\?\.provider === 'api' \? 'api' : 'ollama'/);
  assert.match(timeline, /providerConfig: chatConfig\.providerConfig, apiKey: chatConfig\.apiKey/);
  assert.match(timeline, /model: String\(chatConfig\?\.model \|\| ''\)\.trim\(\)/);
  assert.match(timeline, /Add your Cloud API key in Models & settings/);
  assert.match(timeline, /const baseSignature = JSON\.stringify\(projectRef\.current\)/);
  assert.match(timeline, /setEditPlan\(\{ actions: safe, baseSignature, summary:/);
  assert.match(timeline, /JSON\.stringify\(projectRef\.current\) !== editPlan\.baseSignature/);
  assert.match(timeline, /start \+ duration > 3600/);
  assert.match(timeline, /start \+ clip\.duration > 3600/);
  assert.match(timeline, /clip\.timelineStart \+ duration > 3600/);
  assert.match(timeline, /sourceStart \+ clip\.duration > 3600/);
});


test('first-run model setup verifies Ollama inventory before reporting ready', async () => {
  const app = await fs.readFile(path.join(root, 'src', 'App.jsx'), 'utf8');
  assert.match(app, /async function verifyModelReady\(model\)/);
  assert.match(app, /Ollama stopped responding after the download/);
  assert.match(app, /did not list .* as installed/);
  assert.match(app, /await verifyModelReady\(model\)/);
  assert.match(app, /await verifyModelReady\(modelToInstall\.trim\(\)\)/);
});

test('Video Studio offers request-scoped cancellation for LuxTTS voiceover', async () => {
  const timeline = await fs.readFile(path.join(root, 'src', 'TimelineEditor.jsx'), 'utf8');
  assert.match(timeline, /voiceRequestRef = useRef\(''\)/);
  assert.match(timeline, /event\.requestId !== voiceRequestRef\.current/);
  assert.match(timeline, /async function cancelVoiceover\(\)/);
  assert.match(timeline, /desktop\.luxTTS\.cancel\(requestId\)/);
  assert.match(timeline, /Cancel voiceover/);
  assert.match(timeline, /Voiceover generation cancelled\. No new clip was added\./);
});
