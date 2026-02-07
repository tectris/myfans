import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  noExternal: [/@myfans\/.*/],
  external: ['sharp'],
  splitting: false,
  clean: true,
})
