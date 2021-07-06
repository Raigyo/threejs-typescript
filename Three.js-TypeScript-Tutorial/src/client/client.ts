import * as THREE from "/build/three.module.js";
import { OrbitControls } from "/jsm/controls/OrbitControls";
import Stats from "/jsm/libs/stats.module"; // default export
import { GUI } from "/jsm/libs/dat.gui.module"; // {} no default export: we using a specific class from module

// default export

const scene: THREE.Scene = new THREE.Scene();

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

const geometry: THREE.BoxGeometry = new THREE.BoxGeometry();
const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true,
});

const cube: THREE.Mesh = new THREE.Mesh(geometry, material);
scene.add(cube);

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

// Dat Gui module: we add controls
const gui = new GUI();
const cubeFolder = gui.addFolder("Cube");
cubeFolder.add(cube.rotation, "x", 0, Math.PI * 2, 0.01);
cubeFolder.add(cube.rotation, "y", 0, Math.PI * 2, 0.01);
cubeFolder.add(cube.rotation, "z", 0, Math.PI * 2, 0.01);
cubeFolder.open();
const cameraFolder = gui.addFolder("Camera");
cameraFolder.add(camera.position, "z", 0, 10, 0.01);
cameraFolder.open();

var animate = function () {
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
