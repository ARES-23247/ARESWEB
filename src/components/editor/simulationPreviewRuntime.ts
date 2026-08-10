import * as React from "react";
import { createRoot } from "react-dom/client";

interface SimulationRuntimeGlobal {
  React?: typeof React;
  ReactDOM?: {
    createRoot: typeof createRoot;
  };
  AresPhysics?: {
    PhysicsWorld: React.ComponentType<{ children?: React.ReactNode; cameraPos?: number[] }>;
    SwerveModule: React.ComponentType<{ position?: number[]; rotation?: number; wheelSpeed?: number }>;
  };
}

const runtimeGlobal = globalThis as unknown as SimulationRuntimeGlobal;

// This module is bundled as an isolated IIFE and loaded inside the opaque-origin
// preview iframe. It keeps the simulation runtime local to the deployed app,
// instead of relying on missing /vendor files or a third-party React CDN.
runtimeGlobal.React = React;
runtimeGlobal.ReactDOM = { createRoot };

function PhysicsWorld({ children }: { children?: React.ReactNode; cameraPos?: number[] }) {
  return React.createElement(
    "div",
    {
      role: "img",
      "aria-label": "Interactive three-dimensional robot physics preview",
      style: {
        alignItems: "center",
        background: "radial-gradient(circle at center, rgba(255,184,28,0.12), transparent 65%)",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        minHeight: 280,
        overflow: "hidden",
        perspective: 700,
        width: "100%",
      },
    },
    children,
  );
}

function SwerveModule({ rotation = 0, wheelSpeed = 0 }: { position?: number[]; rotation?: number; wheelSpeed?: number }) {
  const speed = Math.max(-1, Math.min(1, wheelSpeed));
  return React.createElement(
    "div",
    {
      "aria-label": `Swerve module at ${Math.round(rotation * 57.2958)} degrees and ${Math.round(speed * 100)} percent speed`,
      style: {
        background: "linear-gradient(145deg, #1A1A1A, #000000)",
        border: "2px solid #FFB81C",
        borderRadius: 18,
        boxShadow: `0 18px 35px rgba(0,0,0,0.45), 0 0 ${12 + Math.abs(speed) * 24}px rgba(255,184,28,0.35)`,
        height: 104,
        position: "relative",
        transform: `rotateY(-22deg) rotateX(14deg) rotateZ(${rotation}rad)`,
        transition: "transform 160ms ease, box-shadow 160ms ease",
        width: 104,
      },
    },
    React.createElement("div", {
      style: {
        background: "#C00000",
        border: "3px solid #F9F9F9",
        borderRadius: 10,
        height: 30,
        left: -18,
        position: "absolute",
        top: 34,
        transform: `rotate(${speed * 18}deg)`,
        width: 138,
      },
    }),
  );
}

runtimeGlobal.AresPhysics = { PhysicsWorld, SwerveModule };
