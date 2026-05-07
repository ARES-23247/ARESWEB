import * as THREE from 'three';
import * as R3F from '@react-three/fiber';
import * as Drei from '@react-three/drei';
import React, { useRef } from 'react';

interface PhysicsWorldProps {
  children: React.ReactNode;
  cameraPos?: [number, number, number];
  bg?: string;
}

// Common physics environment wrapper
export function PhysicsWorld({ children, cameraPos = [0, 5, 10], bg = "#1e1e1e" }: PhysicsWorldProps) {
  return (
    <R3F.Canvas camera={{ position: cameraPos, fov: 50 }}>
      <color attach="background" args={[bg]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <Drei.Grid infiniteGrid fadeDistance={40} fadeStrength={5} cellColor="#ffffff" sectionColor="#d4a030" sectionThickness={1} cellThickness={0.5} />
      {children}
      <Drei.OrbitControls makeDefault />
    </R3F.Canvas>
  );
}

interface SwerveModuleProps {
  position?: [number, number, number];
  rotation?: number;
  wheelSpeed?: number;
}

// Basic swerve module representation
export function SwerveModule({ position = [0, 0, 0], rotation = 0, wheelSpeed = 0 }: SwerveModuleProps) {
  const wheelRef = useRef<THREE.Group>(null);
  
  R3F.useFrame(() => {
    if (wheelRef.current) {
      wheelRef.current.children[0].rotation.x += wheelSpeed;
    }
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Module housing */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      {/* Wheel */}
      <group ref={wheelRef} position={[0, 0.25, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 0.2, 32]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>
    </group>
  );
}

export { THREE, R3F, Drei };
