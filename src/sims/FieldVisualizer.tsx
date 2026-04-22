import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
      // @ts-expect-error -- D1 untyped response
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
  FIELDS,
  createFieldLayout,
  spawnGamePieces,
  type RobotPosition,
} from './field/FieldData';

interface FieldVisualizerProps {
  field?: keyof typeof FIELDS;
  robotPosition?: RobotPosition;
  gamePieces?: number;
  showRobot?: boolean;
  showAprilTags?: boolean;
  className?: string;
}

export default function FieldVisualizer({
  field = 'CRESCENDO_2024',
  robotPosition,
  gamePieces: pieceCount = 10,
  showRobot = true,
  showAprilTags = true,
  className = '',
}: FieldVisualizerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    robot?: THREE.Group;
    fieldLines?: THREE.LineSegments;
  } | null>(null);

  const [currentField, setCurrentField] = useState(field);

  const createRobot = useCallback((): THREE.Group => {
    const robotGroup = new THREE.Group();

    // Robot chassis
    const chassisGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.8);
    const chassisMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.5,
    });
    const chassis = new THREE.Mesh(chassisGeometry, chassisMaterial);
    chassis.position.y = 0.15;
    chassis.castShadow = true;
    robotGroup.add(chassis);

    // Robot bumper
    const bumperGeometry = new THREE.BoxGeometry(0.9, 0.25, 0.9);
    const bumperMaterial = new THREE.MeshStandardMaterial({
      color: 0xB32416,
      roughness: 0.7,
    });
    const bumper = new THREE.Mesh(bumperGeometry, bumperMaterial);
    bumper.position.y = 0.125;
    bumper.castShadow = true;
    robotGroup.add(bumper);

    // Swerve modules (4)
    const modulePositions = [
      { x: -0.3, y: 0.15, z: -0.3 },
      { x: 0.3, y: 0.15, z: -0.3 },
      { x: -0.3, y: 0.15, z: 0.3 },
      { x: 0.3, y: 0.15, z: 0.3 },
    ];

    modulePositions.forEach(pos => {
      const moduleGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16);
      const moduleMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.6,
      });
      const module = new THREE.Mesh(moduleGeometry, moduleMaterial);
      module.position.set(pos.x, pos.y, pos.z);
      module.castShadow = true;
      robotGroup.add(module);
    });

    // Direction indicator
    const arrowGeometry = new THREE.ConeGeometry(0.05, 0.2, 3);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.position.set(0, 0.4, 0.35);
    arrow.rotation.x = Math.PI / 2;
    robotGroup.add(arrow);

    return robotGroup;
  }, []);

  const updateRobotPosition = useCallback((position: RobotPosition) => {
    if (!sceneRef.current || !sceneRef.current.robot) return;
    const robot = sceneRef.current.robot;
    robot.position.set(position.x, 0, position.y);
    robot.rotation.y = position.heading;
  }, []);

  const buildField = useCallback(() => {
    if (!sceneRef.current) return;
    const { scene } = sceneRef.current;

    // Clear existing field objects
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (object.userData.isFieldObject) {
        toRemove.push(object);
      }
    });
    toRemove.forEach(obj => scene.remove(obj));

    const layout = createFieldLayout(field);

    // Draw field boundary
    const boundaryShape = new THREE.Shape();
    const { dimensions } = layout;
    boundaryShape.moveTo(0, 0);
    boundaryShape.lineTo(dimensions.length, 0);
    boundaryShape.lineTo(dimensions.length, dimensions.width);
    boundaryShape.lineTo(0, dimensions.width);
    boundaryShape.lineTo(0, 0);

    const boundaryGeometry = new THREE.ShapeGeometry(boundaryShape);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
      color: 0x29b6f6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
    });
    const boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    boundaryMesh.rotation.x = -Math.PI / 2;
    boundaryMesh.position.y = 0.01;
    boundaryMesh.userData.isFieldObject = true;
    scene.add(boundaryMesh);

    // Draw field lines
    layout.fieldLines.forEach((line) => {
      const points = line.map(p => new THREE.Vector3(p.x, 0.02, p.y));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x666666,
        linewidth: 2,
      });
      const lineMesh = new THREE.Line(geometry, material);
      lineMesh.userData.isFieldObject = true;
      scene.add(lineMesh);
    });

    // Draw zones
    layout.zones.forEach(zone => {
      const zoneGeometry = new THREE.PlaneGeometry(zone.width, zone.height);
      const zoneMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(zone.color),
        transparent: true,
        opacity: zone.alpha,
        side: THREE.DoubleSide,
      });
      const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
      zoneMesh.rotation.x = -Math.PI / 2;
      zoneMesh.position.set(zone.x + zone.width / 2, 0.015, zone.y + zone.height / 2);
      zoneMesh.userData.isFieldObject = true;
      scene.add(zoneMesh);
    });

    // Draw April Tags
    if (showAprilTags && layout.aprilTags.length > 0) {
      layout.aprilTags.forEach(tag => {
        const tagGeometry = new THREE.PlaneGeometry(0.165, 0.165); // 6.5" tag
        const tagMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.DoubleSide,
        });
        const tagMesh = new THREE.Mesh(tagGeometry, tagMaterial);
        tagMesh.position.set(tag.x, 0.5, tag.y);
        tagMesh.rotation.y = tag.heading;
        tagMesh.userData.isFieldObject = true;
        scene.add(tagMesh);

        // Add tag border
        const borderGeometry = new THREE.EdgesGeometry(tagGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
        const borderMesh = new THREE.LineSegments(borderGeometry, borderMaterial);
        borderMesh.position.copy(tagMesh.position);
        borderMesh.rotation.copy(tagMesh.rotation);
        borderMesh.userData.isFieldObject = true;
        scene.add(borderMesh);
      });
    }

    // Spawn game pieces
    const pieces = spawnGamePieces(field, pieceCount);
    pieces.forEach(piece => {
      const pieceGeometry =
        piece.type === 'cube'
          ? new THREE.BoxGeometry(0.5, 0.5, 0.5)
          : new THREE.ConeGeometry(0.25, 0.5, 32);
      const pieceMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(piece.color),
        roughness: 0.8,
      });
      const pieceMesh = new THREE.Mesh(pieceGeometry, pieceMaterial);
      pieceMesh.position.set(piece.x, piece.z / 2, piece.y);
      pieceMesh.castShadow = true;
      pieceMesh.userData.isFieldObject = true;
      scene.add(pieceMesh);
    });

    // Add robot
    if (showRobot) {
      const robotGroup = createRobot();
      robotGroup.userData.isFieldObject = true;
      scene.add(robotGroup);
      sceneRef.current.robot = robotGroup;

      if (robotPosition) {
        updateRobotPosition(robotPosition);
      }
    }
  }, [field, pieceCount, showAprilTags, showRobot, robotPosition, createRobot, updateRobotPosition]);

  useEffect(() => {
    const currentCanvas = canvasRef.current;
    if (!currentCanvas) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      60,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(8, 4, 12);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    canvasRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2; // Don't go below ground

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Store scene reference
    sceneRef.current = { scene, camera, renderer, controls };

    // Build field
    buildField();

    // Animation loop
    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      controls.dispose();
      renderer.dispose();
      if (currentCanvas && renderer.domElement.parentNode === currentCanvas) {
        currentCanvas.removeChild(renderer.domElement);
      }
    };
  }, [buildField]);

  // Rebuild field when field changes
  useEffect(() => {
    if (sceneRef.current && currentField !== field) {
      setCurrentField(field);
      buildField();
    }
  }, [field, currentField, buildField]);

  // Update robot position
  useEffect(() => {
    if (sceneRef.current && robotPosition && showRobot) {
      updateRobotPosition(robotPosition);
    }
  }, [robotPosition, showRobot, updateRobotPosition]);

  return (
    <div
      className={`field-visualizer ${className}`}
      style={{
        width: '100%',
        height: '500px',
        position: 'relative',
        backgroundColor: '#0a0a0a',
        border: '1px solid #2a2a2a',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: 'move',
        }}
        aria-label="Interactive 3D field visualization"
        role="img"
      />
      <div
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '4px',
          color: '#fff',
          fontFamily: '"Orbitron", sans-serif',
          fontSize: '12px',
        }}
      >
        {FIELDS[field]?.name || field}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '8px 12px',
          borderRadius: '4px',
          color: '#aaa',
          fontFamily: '"Ubuntu", sans-serif',
          fontSize: '11px',
        }}
      >
        Mouse: Rotate | Scroll: Zoom | Right-click: Pan
      </div>
    </div>
  );
}
