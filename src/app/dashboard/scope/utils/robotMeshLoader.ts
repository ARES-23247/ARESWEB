import * as THREE from "three";

export interface RobotModelResult {
  robotGroup: THREE.Group;
  moduleLF: THREE.Group;
  moduleRF: THREE.Group;
  moduleBL: THREE.Group;
  moduleBR: THREE.Group;
  slideCarriage: THREE.Mesh;
  intakeArm: THREE.Mesh;
}

/**
 * Creates the 3D robot model and returns references to its steerable wheel modules
 * and mechanism components (linear slides carriage and intake arm).
 */
export function createRobotModel(): RobotModelResult {
  const robotGroup = new THREE.Group();

  // Chassis body base (0.4572m square = 18")
  const chassisGeo = new THREE.BoxGeometry(0.4572, 0.127, 0.4572); // 18" x 5" x 18"
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0xFFB81C,
    metalness: 0.6,
    roughness: 0.2,
    transparent: true,
    opacity: 0.95
  });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.0889; // 3.5 inches
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  robotGroup.add(chassis);

  // Red Front indicator arrow mesh
  const arrowGeo = new THREE.ConeGeometry(0.0635, 0.1524, 4); // 2.5" radius, 6" length
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xC00000 });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat);
  arrow.position.set(0, 0.1651, -0.2286); // 0, 6.5", -9"
  arrow.rotation.x = -Math.PI / 2;
  robotGroup.add(arrow);

  // Swerve wheel module cylinders (placed inside intermediate pivot groups)
  const wheelGeo = new THREE.CylinderGeometry(0.0762, 0.0762, 0.0635, 16); // 3" radius, 2.5" thickness
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1 });
  
  const create3DWheelModule = (x: number, y: number, z: number) => {
    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(x, y, z);
    
    const mesh = new THREE.Mesh(wheelGeo, wheelMat);
    mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = true;
    pivotGroup.add(mesh);
    
    robotGroup.add(pivotGroup);
    return pivotGroup;
  };

  const moduleLF = create3DWheelModule(-0.2413, 0.0762, -0.1778); // -9.5", 3", -7"
  const moduleRF = create3DWheelModule(0.2413, 0.0762, -0.1778);
  const moduleBL = create3DWheelModule(-0.2413, 0.0762, 0.1778);
  const moduleBR = create3DWheelModule(0.2413, 0.0762, 0.1778);

  // Rails mechanism
  const railMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.2 });
  const railGeo = new THREE.BoxGeometry(0.0254, 0.6096, 0.0254); // 1" x 24" x 1"
  
  const railL = new THREE.Mesh(railGeo, railMat);
  railL.position.set(-0.1016, 0.3683, 0.1016); // -4", 14.5", 4"
  robotGroup.add(railL);

  const railR = new THREE.Mesh(railGeo, railMat);
  railR.position.set(0.1016, 0.3683, 0.1016);
  robotGroup.add(railR);

  // Sliding carriage
  const carriageGeo = new THREE.BoxGeometry(0.2286, 0.0762, 0.1016); // 9" x 3" x 4"
  const carriageMat = new THREE.MeshStandardMaterial({ color: 0xC00000, metalness: 0.3, roughness: 0.5 });
  const carriage = new THREE.Mesh(carriageGeo, carriageMat);
  carriage.position.set(0, 0.2032, 0.1016); // 0, 8", 4"
  robotGroup.add(carriage);

  // Intake pivot arm
  const armGeo = new THREE.BoxGeometry(0.0508, 0.0508, 0.254); // 2" x 2" x 10"
  const armMat = new THREE.MeshStandardMaterial({ color: 0xFFB81C, metalness: 0.8 });
  const arm = new THREE.Mesh(armGeo, armMat);
  arm.position.set(0, 0, -0.1016); // 0, 0, -4"
  carriage.add(arm);

  return {
    robotGroup,
    moduleLF,
    moduleRF,
    moduleBL,
    moduleBR,
    slideCarriage: carriage,
    intakeArm: arm
  };
}

/**
 * Creates the 3D ghost comparison robot model.
 */
export function createComparisonRobotModel(): THREE.Group {
  const compRobot = new THREE.Group();

  const compChassisGeo = new THREE.BoxGeometry(0.4572, 0.127, 0.4572);
  const compChassisMat = new THREE.MeshStandardMaterial({
    color: 0xC00000, // Red
    metalness: 0.3,
    roughness: 0.5,
    transparent: true,
    opacity: 0.35
  });
  const compChassis = new THREE.Mesh(compChassisGeo, compChassisMat);
  compChassis.position.y = 0.0889;
  compRobot.add(compChassis);

  const arrowGeo = new THREE.ConeGeometry(0.0635, 0.1524, 4); // 2.5" radius, 6" length
  const compArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xC00000, transparent: true, opacity: 0.5 }));
  compArrow.position.set(0, 0.1651, -0.2286);
  compArrow.rotation.x = -Math.PI / 2;
  compRobot.add(compArrow);

  return compRobot;
}
