import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 1421,
		strictPort: true,
		host: true, // Expose to network for iOS simulator
	},
	clearScreen: false,
});
