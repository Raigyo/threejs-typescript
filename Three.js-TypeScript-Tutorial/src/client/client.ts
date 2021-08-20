import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "three/examples/jsm/libs/stats.module";
import { GUI } from "three/examples/jsm/libs/dat.gui.module";
import * as CANNON from "cannon";

const scene: THREE.Scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

var light1 = new THREE.SpotLight();
light1.position.set(2.5, 5, 5);
light1.angle = Math.PI / 4;
light1.penumbra = 0.5;
light1.castShadow = true;
light1.shadow.mapSize.width = 1024;
light1.shadow.mapSize.height = 1024;
light1.shadow.camera.near = 0.5;
light1.shadow.camera.far = 20;
scene.add(light1);

var light2 = new THREE.SpotLight();
light2.position.set(-2.5, 5, 5);
light2.angle = Math.PI / 4;
light2.penumbra = 0.5;
light2.castShadow = true;
light2.shadow.mapSize.width = 1024;
light2.shadow.mapSize.height = 1024;
light2.shadow.camera.near = 0.5;
light2.shadow.camera.far = 20;
scene.add(light2);

const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
//world.broadphase = new CANNON.NaiveBroadphase() //
//world.solver.iterations = 10
//world.allowSleep = true

const normalMaterial: THREE.MeshNormalMaterial = new THREE.MeshNormalMaterial();
const phongMaterial: THREE.MeshPhongMaterial = new THREE.MeshPhongMaterial();

const cubeGeometry: THREE.BoxGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMesh: THREE.Mesh = new THREE.Mesh(cubeGeometry, normalMaterial);
cubeMesh.position.x = -3;
cubeMesh.position.y = 3;
cubeMesh.castShadow = true;
scene.add(cubeMesh);
const cubeShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
const cubeBody = new CANNON.Body({ mass: 1 });
cubeBody.addShape(cubeShape);
cubeBody.position.x = cubeMesh.position.x;
cubeBody.position.y = cubeMesh.position.y;
cubeBody.position.z = cubeMesh.position.z;
world.addBody(cubeBody);

const sphereGeometry: THREE.SphereGeometry = new THREE.SphereGeometry();
const sphereMesh: THREE.Mesh = new THREE.Mesh(sphereGeometry, normalMaterial);
sphereMesh.position.x = -1;
sphereMesh.position.y = 3;
sphereMesh.castShadow = true;
scene.add(sphereMesh);
const sphereShape = new CANNON.Sphere(1);
const sphereBody = new CANNON.Body({ mass: 1 });
sphereBody.addShape(sphereShape);
sphereBody.position.x = sphereMesh.position.x;
sphereBody.position.y = sphereMesh.position.y;
sphereBody.position.z = sphereMesh.position.z;
world.addBody(sphereBody);

const icosahedronGeometry: THREE.IcosahedronGeometry =
  new THREE.IcosahedronGeometry(1, 0);
const icosahedronMesh: THREE.Mesh = new THREE.Mesh(
  icosahedronGeometry,
  normalMaterial
);
icosahedronMesh.position.x = 1;
icosahedronMesh.position.y = 3;
icosahedronMesh.castShadow = true;
scene.add(icosahedronMesh);
let position = icosahedronMesh.geometry.attributes.position.array;
const icosahedronPoints: CANNON.Vec3[] = [];
for (let i = 0; i < position.length; i += 3) {
  icosahedronPoints.push(
    new CANNON.Vec3(position[i], position[i + 1], position[i + 2])
  );
}
const icosahedronFaces: number[][] = [];
for (let i = 0; i < position.length / 3; i += 3) {
  icosahedronFaces.push([i, i + 1, i + 2]);
}
const icosahedronShape = new CANNON.ConvexPolyhedron(
  icosahedronPoints,
  icosahedronFaces
);
const icosahedronBody = new CANNON.Body({ mass: 1 });
icosahedronBody.addShape(icosahedronShape);
icosahedronBody.position.x = icosahedronMesh.position.x;
icosahedronBody.position.y = icosahedronMesh.position.y;
icosahedronBody.position.z = icosahedronMesh.position.z;
world.addBody(icosahedronBody);

const torusKnotGeometry: THREE.TorusKnotGeometry =
  new THREE.TorusKnotGeometry();
const torusKnotMesh: THREE.Mesh = new THREE.Mesh(
  torusKnotGeometry,
  normalMaterial
);
torusKnotMesh.position.x = 4;
torusKnotMesh.position.y = 3;
torusKnotMesh.castShadow = true;
scene.add(torusKnotMesh);
// position = torusKnotMesh.geometry.attributes.position.array
// const torusKnotPoints: CANNON.Vec3[] = []
// for (let i = 0; i < position.length; i += 3) {
//     torusKnotPoints.push(new CANNON.Vec3(position[i], position[i + 1], position[i + 2]));
// }
// const torusKnotFaces: number[][] = []
// for (let i = 0; i < position.length / 3; i += 3) {
//     torusKnotFaces.push([i, i + 1, i + 2])
// }
// const torusKnotShape = new CANNON.ConvexPolyhedron(torusKnotPoints, torusKnotFaces)
const torusKnotShape = CreateTrimesh(torusKnotMesh.geometry);
const torusKnotBody = new CANNON.Body({ mass: 1 });
torusKnotBody.addShape(torusKnotShape);
torusKnotBody.position.x = torusKnotMesh.position.x;
torusKnotBody.position.y = torusKnotMesh.position.y;
torusKnotBody.position.z = torusKnotMesh.position.z;
world.addBody(torusKnotBody);

function CreateTrimesh(geometry: THREE.BufferGeometry) {
  const vertices = (geometry as THREE.BufferGeometry).attributes.position.array;
  const indices = Object.keys(vertices).map(Number);
  return new CANNON.Trimesh(vertices as [], indices);
}

const planeGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(25, 25);
const planeMesh: THREE.Mesh = new THREE.Mesh(planeGeometry, phongMaterial);
planeMesh.rotateX(-Math.PI / 2);
planeMesh.receiveShadow = true;
scene.add(planeMesh);
const planeShape = new CANNON.Plane();
const planeBody = new CANNON.Body({ mass: 0 });
planeBody.addShape(planeShape);
planeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(planeBody);

camera.position.y = 4;
camera.position.z = 4;
controls.target.y = 2;

window.addEventListener("resize", onWindowResize, false);
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

const stats = Stats();
document.body.appendChild(stats.dom);

const gui = new GUI();
const physicsFolder = gui.addFolder("Physics");
physicsFolder.add(world.gravity, "x", -10.0, 10.0, 0.1);
physicsFolder.add(world.gravity, "y", -10.0, 10.0, 0.1);
physicsFolder.add(world.gravity, "z", -10.0, 10.0, 0.1);
physicsFolder.open();

const clock: THREE.Clock = new THREE.Clock();

var animate = function () {
  requestAnimationFrame(animate);

  controls.update();

  let delta = clock.getDelta();
  if (delta > 0.1) delta = 0.1;
  world.step(delta);

  // Copy coordinates from Cannon.js to Three.js
  cubeMesh.position.set(
    cubeBody.position.x,
    cubeBody.position.y,
    cubeBody.position.z
  );
  cubeMesh.quaternion.set(
    cubeBody.quaternion.x,
    cubeBody.quaternion.y,
    cubeBody.quaternion.z,
    cubeBody.quaternion.w
  );
  sphereMesh.position.set(
    sphereBody.position.x,
    sphereBody.position.y,
    sphereBody.position.z
  );
  sphereMesh.quaternion.set(
    sphereBody.quaternion.x,
    sphereBody.quaternion.y,
    sphereBody.quaternion.z,
    sphereBody.quaternion.w
  );
  icosahedronMesh.position.set(
    icosahedronBody.position.x,
    icosahedronBody.position.y,
    icosahedronBody.position.z
  );
  icosahedronMesh.quaternion.set(
    icosahedronBody.quaternion.x,
    icosahedronBody.quaternion.y,
    icosahedronBody.quaternion.z,
    icosahedronBody.quaternion.w
  );
  torusKnotMesh.position.set(
    torusKnotBody.position.x,
    torusKnotBody.position.y,
    torusKnotBody.position.z
  );
  torusKnotMesh.quaternion.set(
    torusKnotBody.quaternion.x,
    torusKnotBody.quaternion.y,
    torusKnotBody.quaternion.z,
    torusKnotBody.quaternion.w
  );

  render();

  stats.update();
};

function render() {
  renderer.render(scene, camera);
}
animate();
