import * as THREE from "/build/three.module.js";
import { OrbitControls } from "/jsm/controls/OrbitControls";
import Stats from "/jsm/libs/stats.module"; // default export
import { GUI } from "/jsm/libs/dat.gui.module"; // {} no default export: we using a specific class from module

// default export

const scene: THREE.Scene = new THREE.Scene();
let axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);
const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener("change", render); //this line is unnecessary if you are re-rendering within the animation loop

const boxGeometry: THREE.BoxGeometry = new THREE.BoxGeometry();
const sphereGeometry: THREE.SphereGeometry = new THREE.SphereGeometry();
const icosahedronGeometry: THREE.IcosahedronGeometry =
  new THREE.IcosahedronGeometry();
//console.dir(geometry);

const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true,
});

const cube: THREE.Mesh = new THREE.Mesh(boxGeometry, material);
cube.position.x = 3;
scene.add(cube);

const sphere: THREE.Mesh = new THREE.Mesh(sphereGeometry, material);
scene.add(sphere);

const icosahedron: THREE.Mesh = new THREE.Mesh(icosahedronGeometry, material);
icosahedron.position.x = -3;
scene.add(icosahedron);

camera.position.z = 2;

window.addEventListener("resize", onWindowResize, false);
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

// We add stats
const stats = Stats();
document.body.appendChild(stats.dom);

// Dat Gui module: we add controls for cube

const gui = new GUI();
const cubeFolder = gui.addFolder("Cube");
cubeFolder.add(cube, "visible", true);
const cubeRotationFolder = cubeFolder.addFolder("Rotation");
cubeRotationFolder.add(cube.rotation, "x", 0, Math.PI * 2, 0.01);
cubeRotationFolder.add(cube.rotation, "y", 0, Math.PI * 2, 0.01);
cubeRotationFolder.add(cube.rotation, "z", 0, Math.PI * 2, 0.01);
const cubePositionFolder = cubeFolder.addFolder("Position");
cubePositionFolder.add(cube.position, "x", -10, 10);
cubePositionFolder.add(cube.position, "y", -10, 10);
cubePositionFolder.add(cube.position, "z", -10, 10);
const cubeScaleFolder = cubeFolder.addFolder("Scale");
cubeScaleFolder.add(cube.scale, "x", -5, 5, 0.1);
cubeScaleFolder.add(cube.scale, "y", -5, 5, 0.1);
cubeScaleFolder.add(cube.scale, "z", -5, 5, 0.1);

cubeFolder.open();

let cubeData = {
  width: 1,
  height: 1,
  depth: 1,
  widthSegments: 1,
  heightSegments: 1,
  depthSegments: 1,
};
const cubePropertiesFolder = cubeFolder.addFolder("Properties");
cubePropertiesFolder
  .add(cubeData, "width", 1, 30)
  .onChange(regenerateBoxGeometry)
  .onFinishChange(() => console.dir(cube.geometry));
cubePropertiesFolder
  .add(cubeData, "height", 1, 30)
  .onChange(regenerateBoxGeometry);
cubePropertiesFolder
  .add(cubeData, "depth", 1, 30)
  .onChange(regenerateBoxGeometry);
cubePropertiesFolder
  .add(cubeData, "widthSegments", 1, 30)
  .onChange(regenerateBoxGeometry);
cubePropertiesFolder
  .add(cubeData, "heightSegments", 1, 30)
  .onChange(regenerateBoxGeometry);
cubePropertiesFolder
  .add(cubeData, "depthSegments", 1, 30)
  .onChange(regenerateBoxGeometry);

function regenerateBoxGeometry() {
  let newGeometry = new THREE.BoxGeometry(
    cubeData.width,
    cubeData.height,
    cubeData.depth,
    cubeData.widthSegments,
    cubeData.heightSegments,
    cubeData.depthSegments
  );
  cube.geometry.dispose();
  cube.geometry = newGeometry;
}

// Dat Gui module: we add controls for sphere

const sphereFolder = gui.addFolder("Sphere");
sphereFolder.add(sphere, "visible", true);
const sphereRotationFolder = sphereFolder.addFolder("Rotation");
sphereRotationFolder.add(sphere.rotation, "x", 0, Math.PI * 2, 0.01);
sphereRotationFolder.add(sphere.rotation, "y", 0, Math.PI * 2, 0.01);
sphereRotationFolder.add(sphere.rotation, "z", 0, Math.PI * 2, 0.01);
const spherePositionFolder = sphereFolder.addFolder("Position");
spherePositionFolder.add(sphere.position, "x", -10, 10);
spherePositionFolder.add(sphere.position, "y", -10, 10);
spherePositionFolder.add(sphere.position, "z", -10, 10);
const sphereScaleFolder = sphereFolder.addFolder("Scale");
sphereScaleFolder.add(sphere.scale, "x", -5, 5, 0.1);
sphereScaleFolder.add(sphere.scale, "y", -5, 5, 0.1);
sphereScaleFolder.add(sphere.scale, "z", -5, 5, 0.1);

let sphereData = {
  radius: 1,
  widthSegments: 8,
  heightSegments: 6,
  phiStart: 0,
  phiLength: Math.PI * 2,
  thetaStart: 0,
  thetaLength: Math.PI,
};

const spherePropertiesFolder = sphereFolder.addFolder("Properties");
spherePropertiesFolder
  .add(sphereData, "radius", 0.1, 30)
  .onChange(regenerateSphereGeometry);
spherePropertiesFolder
  .add(sphereData, "widthSegments", 1, 32)
  .onChange(regenerateSphereGeometry);
spherePropertiesFolder
  .add(sphereData, "heightSegments", 1, 16)
  .onChange(regenerateSphereGeometry);
spherePropertiesFolder
  .add(sphereData, "phiStart", 0, Math.PI * 2)
  .onChange(regenerateSphereGeometry);
spherePropertiesFolder
  .add(sphereData, "phiLength", 0, Math.PI * 2)
  .onChange(regenerateSphereGeometry);
spherePropertiesFolder
  .add(sphereData, "thetaStart", 0, Math.PI)
  .onChange(regenerateSphereGeometry);
spherePropertiesFolder
  .add(sphereData, "thetaLength", 0, Math.PI)
  .onChange(regenerateSphereGeometry);

function regenerateSphereGeometry() {
  let newGeometry = new THREE.SphereGeometry(
    sphereData.radius,
    sphereData.widthSegments,
    sphereData.heightSegments,
    sphereData.phiStart,
    sphereData.phiLength,
    sphereData.thetaStart,
    sphereData.thetaLength
  );
  sphere.geometry.dispose();
  sphere.geometry = newGeometry;
}

// icosahedron

let icosahedronData = {
  radius: 1,
  detail: 0,
};
const icosahedronFolder = gui.addFolder("Icosahedron");
const icosahedronPropertiesFolder = icosahedronFolder.addFolder("Properties");
icosahedronPropertiesFolder
  .add(icosahedronData, "radius", 0.1, 10)
  .onChange(regenerateIcosahedronGeometry);
icosahedronPropertiesFolder
  .add(icosahedronData, "detail", 0, 5)
  .step(1)
  .onChange(regenerateIcosahedronGeometry);

function regenerateIcosahedronGeometry() {
  let newGeometry = new THREE.IcosahedronGeometry(
    icosahedronData.radius,
    icosahedronData.detail
  );
  icosahedron.geometry.dispose();
  icosahedron.geometry = newGeometry;
}

// Camera

const cameraFolder = gui.addFolder("Camera");
cameraFolder.add(camera.position, "x", -10, 10, 0.01);
cameraFolder.add(camera.position, "y", -10, 10, 0.01);
cameraFolder.add(camera.position, "z", 0, 10, 0.01);
cameraFolder.open();

// Launch animation

let animate = function () {
  requestAnimationFrame(animate);

  // cube.rotation.x += 0.01;
  // cube.rotation.y += 0.01;

  renderer.render(scene, camera);

  stats.update();
};

function render() {
  stats.begin();
  renderer.render(scene, camera);
  stats.end();
}
// render();
animate();
