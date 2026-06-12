import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: "src/module.ts",
      name: "soundbard",
      fileName: () => "soundbard.js",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((n) => n.endsWith(".css"))) return "soundbard.css";
          return "[name][extname]";
        },
        chunkFileNames: "[name].js",
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "module.json", dest: "." },
        { src: "lang", dest: "." },
      ],
    }),
  ],
});
