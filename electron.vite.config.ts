import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function forceJassubCanvas2dRenderer() {
  return {
    name: 'force-jassub-canvas2d-renderer',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.replace(/\\/g, '/').includes('/node_modules/jassub/dist/worker/worker.js')) {
        return null
      }

      return code.replace(
        /try \{\s+const testCanvas = new OffscreenCanvas\(1, 1\);[\s\S]*?\}\s+catch \{\s+this\._gpurender = new Canvas2DRenderer\(\);\s+\}/,
        'this._gpurender = new Canvas2DRenderer();'
      )
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [forceJassubCanvas2dRenderer(), react(), tailwindcss()],
    worker: {
      format: 'es',
      plugins: () => [forceJassubCanvas2dRenderer()]
    }
  }
})
