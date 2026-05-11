import { defineConfig } from '@rsbuild/core';
import { pluginPreact } from '@rsbuild/plugin-preact';

declare const process: {
  env: Record<string, string | undefined>;
};

const target = process.env.BUILD_TARGET === 'github' ? 'github' : 'standalone';

export default defineConfig({
  plugins: [pluginPreact()],
  html: {
    template: './index.html',
  },
  source: {
    entry: {
      index: './src/main.tsx',
    },
  },
  output: {
    assetPrefix: './',
    distPath: {
      root: target === 'github' ? 'github_build' : 'standalone_build',
    },
  },
});
