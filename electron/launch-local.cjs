const { spawn } = require('node:child_process');
const electron = require('electron');
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, ATELIER_LOCAL_BUILD: '1' } });
child.on('exit', (code, signal) => { if (signal) process.kill(process.pid, signal); else process.exit(code ?? 0); });
child.on('error', (error) => { console.error('Failed to launch Electron:', error); process.exit(1); });
