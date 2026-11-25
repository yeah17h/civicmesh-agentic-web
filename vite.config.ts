import { defineConfig } from 'vite';
import react from '@tailwindcss/vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

function exposePublicRuntimePlugin() {
  const runtimeSrcDir = path.resolve(__dirname, 'src/runtime');
  return {
    name: 'expose-public-runtime',
    configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/runtime/') && req.url.endsWith('.js')) {
          const fileName = path.basename(req.url.split('?')[0]);
          const filePath = path.join(runtimeSrcDir, fileName);
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.end(fs.readFileSync(filePath, 'utf-8'));
            return;
          }
        }
        next();
      });
    },
    closeBundle() {
      const distRuntimeDir = path.resolve(__dirname, 'dist/runtime');
      fs.mkdirSync(distRuntimeDir, { recursive: true });
      for (const file of fs.readdirSync(runtimeSrcDir)) {
        if (file.endsWith('.js')) {
          fs.copyFileSync(path.join(runtimeSrcDir, file), path.join(distRuntimeDir, file));
        }
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), exposePublicRuntimePlugin()],
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
