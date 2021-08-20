// If using Relative Import References
// import * as THREE from "/build/three.module.js";
// import { TrackballControls } from "/jsm/controls/TrackballControls";
// import Stats from "/jsm/libs/stats.module";

// If using Module Specifiers
//import * as THREE from 'three'
//import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls'
//import Stats from 'three/examples/jsm/libs/stats.module'

import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { TrackballControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/TrackballControls";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";

const scene: THREE.Scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

var light = new THREE.HemisphereLight();
scene.add(light);

const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new TrackballControls(camera, renderer.domElement);
// controls.addEventListener('change', () => console.log("Controls Change"))
controls.addEventListener("start", () => console.log("Controls Start Event"));
controls.addEventListener("end", () => console.log("Controls End Event"));
// controls.enabled = false
controls.rotateSpeed = 5.0;
controls.zoomSpeed = 0.1;
// controls.panSpeed = 0.8;
// controls.keys = [65, 83, 68]
// controls.noPan = true //default false
// controls.noRotate = true //default false
// controls.noZoom = true //default false
// controls.staticMoving = true //default false
// controls.maxDistance = 4;
// controls.minDistance = 2;

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

const stats = Stats();
stats.domElement.id = "stats";
document.body.appendChild(stats.dom);

var animate = function () {
  requestAnimationFrame(animate);

  controls.update();

  render();

  stats.update();
};

function render() {
  renderer.render(scene, camera);
}
animate();
