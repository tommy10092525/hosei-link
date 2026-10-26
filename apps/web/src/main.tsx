import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

/**
 * ルーティングは hash router。
 * SPA を Worker の ASSETS バインディングから配信するとき、
 * パスごとのフォールバック設定が要らなくなるため。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 画面間の行き来でむやみに再取得しない。更新は mutation 後の
      // invalidateQueries で明示的に行う
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("#root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
        <Toaster closeButton position="top-center" />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
