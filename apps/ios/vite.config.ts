import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// iOS renderer uses shared UI packages
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 1421,
		strictPort: true,
	},
	clearScreen: false,
});
