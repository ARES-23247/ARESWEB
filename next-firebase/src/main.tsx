import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./app/globals.css";

// Unregister stale service workers that might be intercepting /api/** calls
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log("Successfully unregistered stale Service Worker:", registration.scope);
        }
      });
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
