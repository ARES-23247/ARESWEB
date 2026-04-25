/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, MeshDistortMaterial, Float, MeshWobbleMaterial } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

// Dynamic Brand Palette lookup to ensure championship-tier consistency
const getBrandColor = (varName: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || fallback;
};

const ARES_COLORS = {
  red: getBrandColor("--ares-red", "#C00000"),
  gold: getBrandColor("--ares-gold", "#FFB81C"),
  cyan: getBrandColor("--ares-cyan", "#00E5FF"),
  dark: "#111111",
  grid: "#222222",
};

function RobotChassis() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, Math.cos(t / 2) / 10 + 0.25, 0.1);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, Math.sin(t / 4) / 10, 0.1);
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, (1 + Math.sin(t / 1.5)) / 10, 0.1);
  });

  return (
    <group>
      {/* Base Chassis */}
      <mesh ref={meshRef} receiveShadow castShadow>
        <boxGeometry args={[2, 0.5, 2]} />
        <MeshDistortMaterial color={ARES_COLORS.red} speed={2} distort={0.2} radius={1} />
      </mesh>
      
      {/* Structural Pillars */}
      <mesh position={[-0.8, 0.5, -0.8]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1]} />
        <meshStandardMaterial color={ARES_COLORS.gold} metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[0.8, 0.5, -0.8]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1]} />
        <meshStandardMaterial color={ARES_COLORS.gold} metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[-0.8, 0.5, 0.8]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1]} />
        <meshStandardMaterial color={ARES_COLORS.gold} metalness={1} roughness={0.2} />
      </mesh>
      <mesh position={[0.8, 0.5, 0.8]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1]} />
        <meshStandardMaterial color={ARES_COLORS.gold} metalness={1} roughness={0.2} />
      </mesh>

      {/* Top Plate */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[1.8, 0.05, 1.8]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} transparent opacity={0.8} />
      </mesh>

      {/* Wheels */}
      {[-1.1, 1.1].map((x) => 
        [-0.8, 0.8].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, -0.2, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 32]} />
            <meshStandardMaterial color={ARES_COLORS.dark} roughness={1} />
          </mesh>
        ))
      )}

      {/* Electronics Core (Glow) */}
      <Float speed={5} rotationIntensity={2} floatIntensity={2}>
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <MeshWobbleMaterial color={ARES_COLORS.cyan} emissive={ARES_COLORS.cyan} emissiveIntensity={2} factor={0.4} speed={2} />
        </mesh>
      </Float>
    </group>
  );
}

export default function RobotViewer() {
  return (
    <div className="h-[400px] w-full bg-gradient-to-b from-black to-obsidian border border-white/5 overflow-hidden relative ares-cut-lg shadow-[0_0_50px_-12px_rgba(192,0,0,0.2)]"
      role="img" aria-label="Interactive 3D render of ARES.V1 Robot Chassis">
      <div className="absolute top-6 left-6 z-10 space-y-1">
        <h4 className="text-white font-black uppercase tracking-tighter text-xl flex items-center gap-2">
           ARES.V1
           <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
        </h4>
        <p className="text-[10px] text-marble/40 uppercase tracking-widest font-mono">Precision Engineering Render // Interactive Mode</p>
      </div>
      
      <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end">
        <span className="text-[8px] font-black uppercase tracking-widest text-ares-gold/60 mb-2">Controls: Orbit / Zoom / Pan</span>
        <div className="flex gap-2">
           <div className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[8px] text-marble font-mono">D1_TYPE_MESH</div>
           <div className="px-2 py-1 bg-ares-red/10 border border-ares-red/20 rounded text-[8px] text-ares-red font-mono font-bold">R3F_READY</div>
        </div>
      </div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[4, 3, 4]} fov={40} />
        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2} minDistance={3} maxDistance={8} />
        
        {/* Lights */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        <rectAreaLight width={10} height={10} color={ARES_COLORS.red} intensity={2} position={[0, 5, 0]} rotation={[-Math.PI / 2, 0, 0]} />

        {/* Environment */}
        <gridHelper args={[20, 20, ARES_COLORS.grid, ARES_COLORS.dark]} position={[0, -0.5, 0]} />
        
        {/* The Robot */}
        <RobotChassis />


      </Canvas>
    </div>
  );
}
