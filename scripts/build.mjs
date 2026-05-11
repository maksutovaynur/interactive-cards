import { spawnSync } from 'node:child_process';

const target = process.argv[2];

if (!['github', 'standalone'].includes(target)) {
  console.error('Usage: node scripts/build.mjs <github|standalone>');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'rsbuild.cmd' : 'rsbuild';
const manifestResult = spawnSync(process.execPath, ['scripts/generate-order-cards-manifest.mjs'], {
  stdio: 'inherit',
});

if (manifestResult.status !== 0) {
  process.exit(manifestResult.status ?? 1);
}

const result = spawnSync(command, ['build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    BUILD_TARGET: target,
  },
});

process.exit(result.status ?? 1);
