// Development-only port cleanup for Windows
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3001;

function parsePids(output) {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const pids = new Set();

  for (const line of lines) {
    if (!line.includes('LISTENING')) continue;
    const parts = line.trim().split(/\s+/);
    const procId = parts[parts.length - 1];
    if (/^\d+$/.test(procId)) pids.add(procId);
  }

  return [...pids];
}

try {
  const output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
  const pids = parsePids(output);

  if (pids.length === 0) {
    console.log(`[cleanup] Port ${PORT} is available.`);
    process.exit(0);
  }

  console.log(`[cleanup] Found process(es) using port ${PORT}: ${pids.join(', ')}`);
  for (const procId of pids) {
    try {
      execSync(`taskkill /PID ${procId} /F`, { stdio: 'ignore' });
      console.log(`[cleanup] Killed PID ${procId}`);
    } catch {
      console.log(`[cleanup] Failed to kill PID ${procId} (already exited or access denied)`);
    }
  }

  console.log(`[cleanup] Port ${PORT} cleanup complete.`);
} catch {
  // findstr exits non-zero when there are no matches; treat as normal.
  console.log(`[cleanup] Port ${PORT} is available.`);
}
