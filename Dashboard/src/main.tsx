import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initPwa } from "./lib/pwa";
import { initTheme } from "./lib/theme";
import "./index.css";

initTheme();
initPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
