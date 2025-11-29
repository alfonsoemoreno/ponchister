import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
// Import MUI baseline
import { CssBaseline } from "@mui/material";
import { shouldEnableViewTransitions } from "./lib/browser";

if (shouldEnableViewTransitions()) {
  document.documentElement.setAttribute("data-view-transitions", "enabled");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CssBaseline />
    <App />
  </StrictMode>
);
