(function () {
  "use strict";

  window.__modules = Object.create(null);
  window.__cache = Object.create(null);
  window.__virtualModules = Object.create(null);

  function postToParent(payload) {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, "*");
    }
  }

  function showRuntimeError(message) {
    const text = String(message || "Unknown simulation error");
    postToParent({ type: "sim-error", message: text });
    const root = document.getElementById("root");
    if (!root) return;
    root.textContent = "";
    const errorEl = document.createElement("div");
    errorEl.className = "sim-error";
    errorEl.textContent = text;
    root.appendChild(errorEl);
  }

  window.onerror = function (msg, _source, line) {
    showRuntimeError(String(msg) + (line ? " (line " + line + ")" : ""));
    return true;
  };

  window.addEventListener("unhandledrejection", function (event) {
    const reason = event && event.reason ? (event.reason.message || String(event.reason)) : "Unhandled promise rejection";
    showRuntimeError(reason);
  });

  ["log", "warn", "error", "info"].forEach(function (level) {
    const original = console[level];
    console[level] = function () {
      const args = Array.prototype.slice.call(arguments);
      postToParent({
        type: "sim-console",
        level: level,
        args: args.map(function (arg) {
          if (typeof arg === "object" && arg !== null) {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        }),
        timestamp: Date.now(),
      });
      if (typeof original === "function") {
        original.apply(console, args);
      }
    };
  });

  window.test = function (name, fn) {
    try {
      fn();
      postToParent({ type: "sim-test-result", result: { name: String(name), passed: true } });
    } catch (error) {
      postToParent({
        type: "sim-test-result",
        result: { name: String(name), passed: false, error: error && error.message ? String(error.message) : String(error) },
      });
    }
  };

  window.expect = function (actual) {
    return {
      toBe: function (expected) {
        if (actual !== expected) throw new Error("Expected " + expected + " but got " + actual);
      },
      toEqual: function (expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error("Expected " + JSON.stringify(expected) + " but got " + JSON.stringify(actual));
        }
      },
      toBeCloseTo: function (expected, precision) {
        const digits = typeof precision === "number" ? precision : 2;
        const pass = Math.abs(expected - actual) < Math.pow(10, -digits) / 2;
        if (!pass) throw new Error("Expected " + expected + " to be close to " + actual);
      },
    };
  };

  function requireModule(name) {
    if (name === "react") return window.React;
    if (name === "react-dom") return window.ReactDOM;
    if (Object.prototype.hasOwnProperty.call(window.__virtualModules, name)) {
      return window.__virtualModules[name].exports;
    }

    let resolveName = String(name || "");
    if (resolveName.startsWith("./")) resolveName = resolveName.slice(2);
    while (resolveName.startsWith("../")) resolveName = resolveName.slice(3);

    if (!Object.prototype.hasOwnProperty.call(window.__modules, resolveName)) {
      const exts = [".tsx", ".jsx", ".ts", ".js"];
      let found = false;
      for (let i = 0; i < exts.length; i += 1) {
        if (Object.prototype.hasOwnProperty.call(window.__modules, resolveName + exts[i])) {
          resolveName = resolveName + exts[i];
          found = true;
          break;
        }
      }
      if (!found) {
        for (let i = 0; i < exts.length; i += 1) {
          if (Object.prototype.hasOwnProperty.call(window.__modules, resolveName + "/index" + exts[i])) {
            resolveName = resolveName + "/index" + exts[i];
            break;
          }
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(window.__cache, resolveName)) {
      return window.__cache[resolveName].exports;
    }
    if (!Object.prototype.hasOwnProperty.call(window.__modules, resolveName)) {
      const available = Object.keys(window.__modules).join(", ");
      throw new Error("Module not found: " + name + ". Available: [" + available + "]");
    }

    const mod = { exports: {} };
    window.__cache[resolveName] = mod;
    window.__modules[resolveName](requireModule, mod, mod.exports);
    return mod.exports;
  }

  window.require = requireModule;

  function registerVirtualModules() {
    window.__virtualModules["areslib"] = {
      exports: {
        useTelemetry: function (key, value) {
          if (!window.React || typeof window.React.useEffect !== "function") return;
          window.React.useEffect(
            function () {
              postToParent({
                type: "ARES_TELEMETRY",
                key: key,
                value: value,
                timestamp: performance.now(),
              });
            },
            [key, value]
          );
        },
      },
    };

    function createProxy(moduleName) {
      return new Proxy(
        {},
        {
          get: function (_target, prop) {
            if (prop === "__esModule") return true;
            const base = window.AresPhysics;
            if (!base) return undefined;
            const mod = moduleName ? base[moduleName] : base;
            if (prop === "default") return mod;
            return mod ? mod[prop] : undefined;
          },
        }
      );
    }

    window.__virtualModules["three"] = { exports: createProxy("THREE") };
    window.__virtualModules["@react-three/fiber"] = { exports: createProxy("R3F") };
    window.__virtualModules["@react-three/drei"] = { exports: createProxy("Drei") };
    window.__virtualModules["ares-physics"] = { exports: createProxy("") };
  }

  function mountEntryComponent() {
    try {
      if (typeof window.React === "undefined" || typeof window.ReactDOM === "undefined") {
        throw new Error("The local React preview runtime failed to load. Refresh the page and try again.");
      }

      let SimComponent;
      if (Object.prototype.hasOwnProperty.call(window.__modules, "SimComponent.jsx")) {
        const entryExports = requireModule("SimComponent.jsx");
        SimComponent = entryExports.default || entryExports.SimComponent || window.SimComponent;
      }

      if (!SimComponent) {
        const availableModules = Object.keys(window.__modules);
        const entryFile = availableModules.find(function (file) {
          return file.endsWith(".tsx") || file.endsWith(".jsx") || file.endsWith(".js");
        });
        if (entryFile) {
          const entryExports = requireModule(entryFile);
          const baseName = entryFile.replace(/\.[^/.]+$/, "");
          SimComponent = entryExports.default || entryExports[baseName] || window.SimComponent;
          if (!SimComponent && entryExports && Object.keys(entryExports).length === 1) {
            SimComponent = entryExports[Object.keys(entryExports)[0]];
          }
        }
      }

      if (typeof SimComponent !== "undefined") {
        const rootEl = document.getElementById("root");
        const root = window.ReactDOM.createRoot(rootEl);
        root.render(window.React.createElement(SimComponent));
        postToParent({ type: "sim-ready" });
      } else {
        throw new Error("SimComponent is not defined. Your code must export a default React component.");
      }
    } catch (error) {
      showRuntimeError(error && error.message ? error.message : String(error));
    }
  }

  function startFpsLoop() {
    let frames = 0;
    let lastTime = performance.now();
    function countFrame() {
      frames += 1;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        postToParent({ type: "sim-fps", fps: frames });
        frames = 0;
        lastTime = now;
      }
      requestAnimationFrame(countFrame);
    }
    requestAnimationFrame(countFrame);
  }

  function isSafeSameOriginPath(url) {
    return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !/[\r\n]/.test(url);
  }

  function loadScript(src, isModule) {
    return new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      if (isModule) script.type = "module";
      script.src = src;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error("Failed to load script: " + src));
      };
      document.head.appendChild(script);
    });
  }

  let hasExecuted = false;

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent || hasExecuted) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "sim-run") return;

    const compiledFiles = data.compiledFiles;
    const runtimeUrl = data.runtimeUrl;
    if (!compiledFiles || typeof compiledFiles !== "object" || Array.isArray(compiledFiles)) return;
    if (!isSafeSameOriginPath(runtimeUrl)) {
      showRuntimeError("Invalid preview runtime path.");
      return;
    }

    hasExecuted = true;

    const entries = Object.entries(compiledFiles).filter(function (entry) {
      return typeof entry[0] === "string" && typeof entry[1] === "string";
    });

    entries
      .filter(function (entry) {
        return entry[0].endsWith(".css");
      })
      .forEach(function (entry) {
        const styleEl = document.createElement("style");
        styleEl.setAttribute("data-file", entry[0]);
        styleEl.textContent = entry[1];
        document.head.appendChild(styleEl);
      });

    const jsEntries = entries.filter(function (entry) {
      return !entry[0].endsWith(".css");
    });

    loadScript(runtimeUrl, runtimeUrl.includes("type=module"))
      .then(function () {
        registerVirtualModules();
        const moduleSource = jsEntries
          .map(function (entry) {
            return (
              "window.__modules[" +
              JSON.stringify(entry[0]) +
              "] = function(require, module, exports) {\n" +
              entry[1] +
              "\n};"
            );
          })
          .join("\n");

        const blob = new Blob([moduleSource], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);
        return loadScript(blobUrl, false).then(
          function () {
            URL.revokeObjectURL(blobUrl);
            mountEntryComponent();
            startFpsLoop();
          },
          function (err) {
            URL.revokeObjectURL(blobUrl);
            throw err;
          }
        );
      })
      .catch(function (error) {
        showRuntimeError(error && error.message ? error.message : String(error));
      });
  });

  postToParent({ type: "sim-sandbox-ready" });
})();
