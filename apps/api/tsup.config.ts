import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: [/@fandreams\/.*/],
  external: ['sharp'],
  splitting: false,
  clean: true,
})
