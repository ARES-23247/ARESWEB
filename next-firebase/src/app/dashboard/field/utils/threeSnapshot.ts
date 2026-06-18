import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Client-side Three.js Top-Down GLB Snapshot generator.
 * Parses a GLB ArrayBuffer and renders a 512x512 PNG snapshot.
 */
export const generateTopDownSnapshot = (glbBuffer: ArrayBuffer): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0A0A0A");

      const fieldSize = 3.6576; // 12 feet
      const camera = new THREE.OrthographicCamera(
        -fieldSize / 2,
        fieldSize / 2,
        fieldSize / 2,
        -fieldSize / 2,
        0.1,
        100
      );
      camera.position.set(0, 10, 0);
      camera.lookAt(0, 0, 0);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
      dirLight.position.set(5, 15, 5);
      scene.add(dirLight);

      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setSize(512, 512);

      const loader = new GLTFLoader();
      loader.parse(
        glbBuffer,
        "",
        (gltf) => {
          scene.add(gltf.scene);
          renderer.render(scene, camera);
          renderer.domElement.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to export WebGL canvas to Blob"));
            }
            renderer.dispose();
          }, "image/png");
        },
        (err) => {
          reject(err);
        }
      );
    } catch (e) {
      reject(e);
    }
  });
};
