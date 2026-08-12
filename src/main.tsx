import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import "./app/globals.css";

if (
  window.location.hostname === "aresfirst-portal.web.app" ||
  window.location.hostname === "aresfirst-portal.firebaseapp.com"
) {
  window.location.replace(`https://aresfirst.org${window.location.pathname}${window.location.search}${window.location.hash}`);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <PwaUpdatePrompt />
  </React.StrictMode>
);
