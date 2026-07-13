import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Tauri iOS uses the same renderer as desktop, but with mobile API
// The renderer is imported from apps/desktop/src via workspace alias
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 1420,
		strictPort: true,
	},
	clearScreen: false,
	build: {
		outDir: "../dist",
		rollupOptions: {
			input: "index.html",
		},
	},
});
