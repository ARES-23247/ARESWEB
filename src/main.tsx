import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import { getCanonicalRedirect } from "./lib/canonicalHost";
import "./app/globals.css";

const canonicalRedirect = getCanonicalRedirect(window.location);

if (canonicalRedirect) {
  window.location.replace(canonicalRedirect);
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
      <PwaUpdatePrompt />
    </React.StrictMode>,
  );
}
