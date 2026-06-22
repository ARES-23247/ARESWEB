import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FieldObstacle, FieldElementInstance, FieldElementType } from "../store/scopeStore";

export interface SceneSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cleanup: () => void;
}

/**
 * Initializes and sets up the Three.js viewport scene.
 * This includes camera configuration, lighting, floor grid, glass walls,
 * and loading custom obstacles/elements.
 */
export function setupThreeScene(
  container: HTMLDivElement,
  fieldCadUrl: string | null,
  fieldObstacles: FieldObstacle[] | null,
  fieldElements: FieldElementInstance[] | null,
  fieldElementTypes: FieldElementType[] | null
): SceneSetupResult {
  const width = container.clientWidth || 360;
  const height = container.clientHeight || 360;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0A0A0A");

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 2.8, 3.3);
  camera.lookAt(0, -0.25, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = "";
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "3D Arena Replay Viewport");
  container.appendChild(renderer.domElement);

  // 2. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(40, 120, 40);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);

  const arenaLight = new THREE.PointLight(0xFFB81C, 1.2, 3.0);
  arenaLight.position.set(0, 0.76, 0);
  scene.add(arenaLight);

  // 3. FTC Floor (3.6576m x 3.6576m)
  const floorGeo = new THREE.PlaneGeometry(3.6576, 3.6576);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.1 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const gridHelper = new THREE.GridHelper(3.6576, 6, 0x333333, 0x222222);
  gridHelper.position.y = 0.001;
  scene.add(gridHelper);

  // 4. Glass Walls
  const glassWallMat = new THREE.MeshPhysicalMaterial({
    color: 0x555555,
    transparent: true,
    opacity: 0.15,
    roughness: 0.1,
    transmission: 0.6,
    thickness: 0.05,
    side: THREE.DoubleSide
  });

  const addWall = (w: number, h: number, x: number, y: number, z: number, rY = 0) => {
    const geo = new THREE.BoxGeometry(w, h, 0.05);
    const mesh = new THREE.Mesh(geo, glassWallMat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rY;
    scene.add(mesh);
  };

  addWall(3.6576, 0.3048, 0, 0.1524, -1.8288); // North
  addWall(3.6576, 0.3048, 0, 0.1524, 1.8288);  // South
  addWall(3.6576, 0.3048, -1.8288, 0.1524, 0, Math.PI / 2); // West
  addWall(3.6576, 0.3048, 1.8288, 0.1524, 0, Math.PI / 2);  // East

  // 5. Game Field elements
  const fallbackGroup = new THREE.Group();
  scene.add(fallbackGroup);

  const renderFallbackField = () => {
    const basketRedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.381, 0.4572, 0.0254, 16),
      new THREE.MeshStandardMaterial({ color: 0xC00000, roughness: 0.5 })
    );
    basketRedBase.position.set(-1.524, 0.0127, 1.524);
    fallbackGroup.add(basketRedBase);

    const basketBlueBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.381, 0.4572, 0.0254, 16),
      new THREE.MeshStandardMaterial({ color: 0x3B82F6, roughness: 0.5 })
    );
    basketBlueBase.position.set(1.524, 0.0127, -1.524);
    fallbackGroup.add(basketBlueBase);

    // Submersible Cage
    const submersibleGroup = new THREE.Group();
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.1 });
    const addPipe = (len: number, x: number, y: number, z: number, rot = new THREE.Euler()) => {
      const geo = new THREE.CylinderGeometry(0.02, 0.02, len, 8);
      const mesh = new THREE.Mesh(geo, pipeMat);
      mesh.position.set(x, y, z);
      mesh.rotation.copy(rot);
      submersibleGroup.add(mesh);
    };
    addPipe(0.4572, -0.3048, 0.2286, -0.3048);
    addPipe(0.4572, 0.3048, 0.2286, -0.3048);
    addPipe(0.4572, -0.3048, 0.2286, 0.3048);
    addPipe(0.4572, 0.3048, 0.2286, 0.3048);
    addPipe(0.6096, 0, 0.4572, -0.3048, new THREE.Euler(0, 0, Math.PI / 2));
    addPipe(0.6096, 0, 0.4572, 0.3048, new THREE.Euler(0, 0, Math.PI / 2));
    addPipe(0.6096, -0.3048, 0.4572, 0, new THREE.Euler(Math.PI / 2, 0, 0));
    addPipe(0.6096, 0.3048, 0.4572, 0, new THREE.Euler(Math.PI / 2, 0, 0));
    fallbackGroup.add(submersibleGroup);
  };

  if (fieldCadUrl) {
    console.log("[WebGL Visualizer] Attempting to load field GLB from Onshape:", fieldCadUrl);
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      fieldCadUrl,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        scene.add(model);
        console.log("[WebGL Visualizer] Synchronized field GLB loaded successfully.");
      },
      undefined,
      (err) => {
        console.warn("[WebGL Visualizer] Failed to load custom GLB. Rendering fallback field.", err);
        renderFallbackField();
      }
    );
  } else {
    renderFallbackField();
  }

  // Custom 3D Obstacles
  if (fieldObstacles && fieldObstacles.length > 0) {
    const obstacleMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.2
    });

    fieldObstacles.forEach((obs) => {
      const heightMeters = 0.35;
      const obsGeo = new THREE.BoxGeometry(obs.width, heightMeters, obs.height);
      const obsMesh = new THREE.Mesh(obsGeo, obstacleMat);
      obsMesh.position.set(-obs.y, heightMeters / 2, -obs.x);
      obsMesh.castShadow = true;
      obsMesh.receiveShadow = true;
      
      // Red boundary outline
      const borderGeo = new THREE.EdgesGeometry(obsGeo);
      const borderMat = new THREE.LineBasicMaterial({ color: 0xC00000, linewidth: 2 });
      const borderLine = new THREE.LineSegments(borderGeo, borderMat);
      obsMesh.add(borderLine);

      scene.add(obsMesh);
    });
  }

  // Custom 3D Elements
  if (fieldElements && fieldElements.length > 0 && fieldElementTypes && fieldElementTypes.length > 0) {
    fieldElements.forEach((el) => {
      const type = fieldElementTypes.find((t) => t.id === el.elementTypeId);
      if (!type) return;

      let geom: THREE.BufferGeometry;
      const thickness = type.depth || 0.15;

      if (type.shape === "box") {
        geom = new THREE.BoxGeometry(type.width, thickness, type.height);
      } else if (type.shape === "cylinder") {
        const radius = (type.diameter || 0.15) / 2;
        geom = new THREE.CylinderGeometry(radius, radius, thickness, 16);
      } else {
        const radius = (type.diameter || 0.15) / 2;
        geom = new THREE.SphereGeometry(radius, 16, 16);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(type.color),
        roughness: 0.5,
        metalness: 0.1
      });

      const mesh = new THREE.Mesh(geom, mat);
      const yOffset = type.shape === "sphere" ? (type.diameter || 0.15) / 2 : thickness / 2;
      mesh.position.set(-el.y, yOffset, -el.x);
      mesh.rotation.y = el.rotation * Math.PI / 180;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const borderGeo = new THREE.EdgesGeometry(geom);
      const borderMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 });
      const borderLine = new THREE.LineSegments(borderGeo, borderMat);
      mesh.add(borderLine);

      scene.add(mesh);
    });
  }

  const cleanup = () => {
    scene.traverse((object: any) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        const disposeMaterial = (mat: any) => {
          for (const key of Object.keys(mat)) {
            if (mat[key] && typeof mat[key] === "object" && mat[key].isTexture) {
              mat[key].dispose();
            }
          }
          mat.dispose();
        };
        
        if (Array.isArray(object.material)) {
          object.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(object.material);
        }
      }
    });

    renderer.dispose();
    container.innerHTML = "";
  };

  return {
    scene,
    camera,
    renderer,
    cleanup
  };
}
