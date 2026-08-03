import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Dev-only: log accessibility violations to the browser console as you work.
// Backs the Section 508 / WCAG 2.1 AA remediation (BACKLOG.md Feature #6).
// Stripped from production builds via the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  void (async () => {
    const [{ default: axe }, React, ReactDOM] = await Promise.all([
      import("@axe-core/react"),
      import("react"),
      import("react-dom"),
    ]);
    axe(React, ReactDOM, 1000);
  })();
}

createRoot(document.getElementById("root")!).render(<App />);
