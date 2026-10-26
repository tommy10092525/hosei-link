import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 本番では apps/server の Worker が dist/ を ASSETS バインディング経由で配信するため、
// フロントと API は同一オリジンになる。dev でも同じ条件を再現するために
// /api と /auth を wrangler dev (:8787) へプロキシする。
// これで CORS 設定も VITE_API_URL も不要になり、認証 Cookie がそのまま通る。
const WORKER_ORIGIN = "http://localhost:8787";

// changeOrigin: true が必須。
// false のままだと Host が localhost:3000 のまま転送され、wrangler dev が
// 「ローカル宛ではない」と判断して wrangler.jsonc の routes (custom_domain) に
// マッピングし、リクエストURLのホストを本番ドメインに書き換えてしまう。
// すると better-auth の origin チェックが http://hosei-link.koki-tominaga.cc を
// 見て trustedOrigins (= BASE_URL) と一致せず 403 INVALID_ORIGIN になる。
// 変わるのは上流へ送る Host だけで、ブラウザから見たオリジンは localhost:3000 の
// ままなので Cookie には影響しない。
const proxyToWorker = { target: WORKER_ORIGIN, changeOrigin: true };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": proxyToWorker,
      "/auth": proxyToWorker,
    },
  },
});
