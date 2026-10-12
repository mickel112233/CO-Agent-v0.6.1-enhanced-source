'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { desktopCapturer, screen } = require('electron');
const ocr = require('./ocr.cjs');
const ollama = require('./ollama.cjs');
const { isLoopbackHttpUrl } = require('./security.cjs');
const execFileAsync = promisify(execFile);

const KEY_CODES = Object.freeze({
  ENTER: 0x0D, TAB: 0x09, ESC: 0x1B, ESCAPE: 0x1B, SPACE: 0x20,
  BACKSPACE: 0x08, DELETE: 0x2E, UP: 0x26, DOWN: 0x28, LEFT: 0x25,
  RIGHT: 0x27, HOME: 0x24, END: 0x23, PAGEUP: 0x21, PAGEDOWN: 0x22,
  CTRL: 0x11, ALT: 0x12, SHIFT: 0x10, WIN: 0x5B, F1: 0x70, F2: 0x71,
  F3: 0x72, F4: 0x73, F5: 0x74, F6: 0x75, F7: 0x76, F8: 0x77,
  F9: 0x78, F10: 0x79, F11: 0x7A, F12: 0x7B
});

function assertApproved(payload) {
  if (payload?.approved !== true) throw new Error('This computer action requires explicit user approval.');
}
function assertWindows() {
  if (process.platform !== 'win32') throw new Error('Native mouse and keyboard control is currently supported on Windows only.');
}
function powershell(script, timeout = 10000) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true, timeout, maxBuffer: 1024 * 1024 });
}
async function captureScreen() {
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1600, height: 1000 }, fetchWindowIcons: false });
  if (!sources.length) throw new Error('No screen source is available.');
  const displays = screen.getAllDisplays();
  return sources.map((source, index) => {
    const display = displays.find(item => String(item.id) === String(source.display_id)) || displays[index] || displays[0];
    return {
      id: source.id, displayId: display ? String(display.id) : '',
      name: source.name || ('Screen ' + (index + 1)),
      width: source.thumbnail.getSize().width, height: source.thumbnail.getSize().height,
      bounds: display ? { x: display.bounds.x, y: display.bounds.y, width: display.bounds.width, height: display.bounds.height } : null,
      dataUrl: source.thumbnail.toDataURL()
    };
  });
}
async function readScreenText(payload = {}) {
  assertApproved(payload);
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1600, height: 1000 }, fetchWindowIcons: false });
  const source = sources.find(item => item.id === payload.sourceId) || sources[0];
  if (!source) throw new Error('No screen source is available.');
  const file = path.join(os.tmpdir(), 'co-agent-screen-ocr-' + process.pid + '-' + Date.now() + '.png');
  try {
    await fs.writeFile(file, source.thumbnail.toPNG());
    return await ocr.recognizeImage(file, payload.language || 'eng');
  } finally { await fs.rm(file, { force: true }).catch(() => {}); }
}
function validatePlanActions(parsed, width, height) {
  if (!Array.isArray(parsed?.actions) || parsed.actions.length > 8) throw new Error('The local model returned an unsupported plan. Maximum 8 actions.');
  return parsed.actions.map((action, index) => {
    const reason = String(action.reason || 'Review this suggested action.').slice(0, 240);
    if (action.type === 'click') {
      const x = Number(action.x), y = Number(action.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) throw new Error('Planned click ' + (index + 1) + ' is outside screenshot bounds.');
      return { id: index + 1, type: 'click', x, y, reason };
    }
    if (action.type === 'type') {
      const text = String(action.text || '');
      if (!text || text.length > 500 || /password|api[_ -]?key|secret|credit card/i.test(text)) throw new Error('Planned text action contains empty, long, or sensitive-looking text.');
      return { id: index + 1, type: 'type', text, reason };
    }
    if (action.type === 'key') {
      const key = String(action.key || '').toUpperCase();
      if (!(KEY_CODES[key] || /^[A-Z0-9]$/.test(key))) throw new Error('Planned key action is unsupported.');
      return { id: index + 1, type: 'key', key, reason };
    }
    throw new Error('Planned action ' + (index + 1) + ' uses unsupported type.');
  });
}
async function planActions(payload = {}) {
  const task = String(payload.task || '').trim();
  if (!task || task.length > 2000) throw new Error('Describe the desktop task in 1–2000 characters.');
  const width = Number(payload.width), height = Number(payload.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000) throw new Error('A valid screenshot size is required.');
  const status = await ollama.getOllamaStatus();
  if (!status.available) throw new Error('Local planning needs Ollama. Start Ollama and install a model first.');
  if (!isLoopbackHttpUrl(status.baseUrl)) throw new Error('Computer-use planning only sends screenshots to loopback Ollama (127.0.0.1, localhost, or ::1) to protect desktop privacy. Change ATELIER_OLLAMA_URL to a local endpoint and retry.');
  const model = ollama.validateModelName(payload.model || status.models?.[0]?.name);
  const imageBase64 = String(payload.imageBase64 || '');
  if (imageBase64.length > 8 * 1024 * 1024 || (imageBase64 && !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64))) throw new Error('Screenshot image is invalid or exceeds the 8 MB planning limit. Capture the screen again and retry.');
  const system = 'You are a conservative desktop action planner. Return ONLY JSON shaped as {"actions":[{"type":"click","x":12,"y":34,"reason":"..."},{"type":"type","text":"...","reason":"..."},{"type":"key","key":"ENTER","reason":"..."}]}. Supported types are click, type, key only. Maximum 8 actions. Click coordinates must be within the supplied screenshot dimensions. Never suggest entering passwords, API keys, financial details, or other secrets. Never suggest deleting files, purchases, sending messages/emails, submitting forms, or irreversible actions; ask the user to do those manually instead. Do not invent shell commands, scripts, URLs, or unsupported actions. Use the supplied screenshot image as primary visual evidence when present; use OCR text as supporting evidence. If no screenshot image is supplied, state uncertainty in each reason. Never assume a control exists if it is not visible.';
  const response = await fetch(status.baseUrl + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, stream: false, format: 'json', messages: [{ role: 'system', content: system }, { role: 'user', content: 'Task: ' + task + '\\nScreenshot dimensions: ' + width + 'x' + height + '\\nVisible OCR text (may be incomplete):\\n' + String(payload.screenText || '(OCR unavailable)') .slice(0, 12000), ...(imageBase64 ? { images: [imageBase64] } : {}) }] }), signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error('Local action planning failed (' + response.status + ').');
  const data = await response.json();
  let parsed;
  try { const raw = String(data.message?.content || '').replace(/^\s*\x60\x60\x60(?:json)?/i, '').replace(/\x60\x60\x60\s*$/, '').trim(); parsed = JSON.parse(raw); } catch { throw new Error('The local model returned an invalid action plan. Try a more specific task.'); }
  const actions = validatePlanActions(parsed, width, height);
  return { ok: true, model, actions, requiresApproval: true };
}
async function inspectAccessibility() {
  assertWindows();
  const script = String.raw`
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = [System.Windows.Automation.Condition]::TrueCondition
$items = @()
$controls = @()
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
foreach ($window in $windows) {
  try {
    $name = $window.Current.Name
    if (-not $name) { continue }
    $items += [pscustomobject]@{ name=$name; type=$window.Current.ControlType.ProgrammaticName; automationId=$window.Current.AutomationId; className=$window.Current.ClassName }
    if ($controls.Count -ge 400) { continue }
    $descendants = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    $limit = [Math]::Min($descendants.Count, 100)
    for ($i = 0; $i -lt $limit -and $controls.Count -lt 400; $i++) {
      try {
        $control = $descendants.Item($i)
        $current = $control.Current
        $type = $current.ControlType.ProgrammaticName
        $label = $current.Name
        $rect = $current.BoundingRectangle
        if (($label -or $type -match 'Button|Edit|ComboBox|TabItem|CheckBox|ListItem|MenuItem|Hyperlink|RadioButton') -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
          $controls += [pscustomobject]@{ name=$label; type=$type; automationId=$current.AutomationId; className=$current.ClassName; enabled=$current.IsEnabled; x=[int]$rect.X; y=[int]$rect.Y; width=[int]$rect.Width; height=[int]$rect.Height }
        }
      } catch {}
    }
  } catch {}
}
ConvertTo-Json -InputObject ([pscustomobject]@{ windows=@($items | Select-Object -First 150); controls=@($controls) }) -Depth 4 -Compress
`;
  const { stdout } = await powershell(script, 20000);
  let result;
  try { result = JSON.parse(stdout.trim() || '{}'); } catch { throw new Error('Windows UI Automation returned an unreadable result.'); }
  return {
    ok: true, platform: 'win32',
    windows: Array.isArray(result.windows) ? result.windows.slice(0, 150) : result.windows ? [result.windows] : [],
    controls: Array.isArray(result.controls) ? result.controls.slice(0, 400) : result.controls ? [result.controls] : []
  };
}
async function click(payload = {}) {
  assertApproved(payload); assertWindows();
  const x = Number(payload.x), y = Number(payload.y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 10000 || y > 10000) throw new Error('Click coordinates must be integers between 0 and 10000.');
  const displays = screen.getAllDisplays();
  const display = displays.find(item => String(item.id) === String(payload.displayId)) || displays[0];
  if (!display || x >= display.bounds.width || y >= display.bounds.height) throw new Error('Click coordinates are outside the selected display bounds.');
  const absoluteX = display.bounds.x + x, absoluteY = display.bounds.y + y;
  const script = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class COInput {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public MOUSEINPUT mi; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
}
"@
$x = __X__; $y = __Y__
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new($x,$y)
$down = New-Object COInput+INPUT; $down.type=0; $down.mi.dwFlags=0x0002
$up = New-Object COInput+INPUT; $up.type=0; $up.mi.dwFlags=0x0004
$size = [Runtime.InteropServices.Marshal]::SizeOf([type]'COInput+INPUT')
$downSent = [COInput]::SendInput(1,@($down),$size)
if ($downSent -ne 1) { throw 'Windows rejected the mouse button-down input.' }
try {
  Start-Sleep -Milliseconds 40
} finally {
  $upSent = [COInput]::SendInput(1,@($up),$size)
  if ($upSent -ne 1) { throw 'Windows rejected the mouse button-up input; check whether the mouse button remains held.' }
}
`.replace('__X__', String(absoluteX)).replace('__Y__', String(absoluteY));
  await powershell(script);
  return { ok: true, action: 'click', x, y, displayId: String(display.id) };
}
async function typeText(payload = {}) {
  assertApproved(payload); assertWindows();
  const value = String(payload.text ?? '');
  if (!value || value.length > 2000) throw new Error('Text must contain 1–2000 characters.');
  const b64 = Buffer.from(value, 'utf8').toString('base64');
  const script = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class COKeyboard {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
}
"@
$text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__TEXT__'))
foreach ($ch in $text.ToCharArray()) {
  $down = New-Object COKeyboard+INPUT; $down.type=1; $down.ki.wScan=[uint16][char]$ch; $down.ki.dwFlags=0x0004
  $up = New-Object COKeyboard+INPUT; $up.type=1; $up.ki.wScan=[uint16][char]$ch; $up.ki.dwFlags=0x0004 -bor 0x0002
  $size=[Runtime.InteropServices.Marshal]::SizeOf([type]'COKeyboard+INPUT')
  $downSent = [COKeyboard]::SendInput(1,@($down),$size)
  if ($downSent -ne 1) { throw 'Windows rejected a Unicode key-down input.' }
  $upSent = [COKeyboard]::SendInput(1,@($up),$size)
  if ($upSent -ne 1) { throw 'Windows rejected a Unicode key-up input; text entry may be incomplete.' }
}
`.replace('__TEXT__', b64);
  await powershell(script);
  return { ok: true, action: 'type', characters: value.length };
}
async function pressKey(payload = {}) {
  assertApproved(payload); assertWindows();
  const key = String(payload.key || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const code = KEY_CODES[key] ?? (/^[A-Z0-9]$/.test(key) ? key.charCodeAt(0) : null);
  if (!code) throw new Error('Unsupported key. Use a single letter/digit, F1–F12, or a documented navigation key.');
  const script = String.raw`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class COKey {
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
}
"@
$code=__KEY__
$down=New-Object COKey+INPUT; $down.type=1; $down.ki.wVk=$code
$up=New-Object COKey+INPUT; $up.type=1; $up.ki.wVk=$code; $up.ki.dwFlags=2
$size=[Runtime.InteropServices.Marshal]::SizeOf([type]'COKey+INPUT')
$downSent = [COKey]::SendInput(1,@($down),$size)
if ($downSent -ne 1) { throw 'Windows rejected the key-down input.' }
try {
  Start-Sleep -Milliseconds 35
} finally {
  $upSent = [COKey]::SendInput(1,@($up),$size)
  if ($upSent -ne 1) { throw 'Windows rejected the key-up input; check whether the key remains held.' }
}
`.replace('__KEY__', String(code));
  await powershell(script);
  return { ok: true, action: 'key', key };
}
module.exports = { captureScreen, readScreenText, planActions, inspectAccessibility, click, typeText, pressKey, KEY_CODES, assertApproved, validatePlanActions };
