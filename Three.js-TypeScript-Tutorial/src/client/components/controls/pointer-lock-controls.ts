// If using Relative Import References
// import * as THREE from "/build/three.module.js";
// import { PointerLockControls } from "/jsm/controls/PointerLockControls";
// import Stats from "/jsm/libs/stats.module";

// If using Module Specifiers
//import * as THREE from 'three'
//import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'
//import Stats from 'three/examples/jsm/libs/stats.module'

import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { PointerLockControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/PointerLockControls";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";

const scene: THREE.Scene = new THREE.Scene();

var light = new THREE.AmbientLight();
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

const menuPanel = document.getElementById("menuPanel");
const startButton = document.getElementById("startButton");
startButton.addEventListener(
  "click",
  function () {
    controls.lock();
  },
  false
);

const controls = new PointerLockControls(camera, renderer.domElement);
//controls.addEventListener('change', () => console.log("Controls Change"))
controls.addEventListener("lock", () => (menuPanel.style.display = "none"));
controls.addEventListener("unlock", () => (menuPanel.style.display = "block"));

const planeGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(
  100,
  100,
  50,
  50
);
const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true,
});
const plane: THREE.Mesh = new THREE.Mesh(planeGeometry, material);
plane.rotateX(-Math.PI / 2);
scene.add(plane);

let cubes: THREE.Mesh[] = new Array();
for (let i = 0; i < 100; i++) {
  const geo: THREE.BoxGeometry = new THREE.BoxGeometry(
    Math.random() * 4,
    Math.random() * 16,
    Math.random() * 4
  );
  const mat: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
  });
  switch (i % 3) {
    case 0:
      mat.color = new THREE.Color(0xff0000);
      break;
    case 1:
      mat.color = new THREE.Color(0xffff00);
      break;
    case 2:
      mat.color = new THREE.Color(0x0000ff);
      break;
  }
  const cube = new THREE.Mesh(geo, mat);
  cubes.push(cube);
}
cubes.forEach((c) => {
  c.position.x = Math.random() * 100 - 50;
  c.position.z = Math.random() * 100 - 50;
  c.geometry.computeBoundingBox();
  c.position.y =
    ((c.geometry.boundingBox as THREE.Box3).max.y -
      (c.geometry.boundingBox as THREE.Box3).min.y) /
    2;
  scene.add(c);
});

camera.position.y = 1;
camera.position.z = 2;

const onKeyDown = function (event: KeyboardEvent) {
  switch (event.key) {
    case "w":
      controls.moveForward(0.5);
      break;
    case "z":
      controls.moveForward(0.5);
      break;
    case "a":
      controls.moveRight(-0.5);
      break;
    case "q":
      controls.moveRight(-0.5);
      break;
    case "s":
      controls.moveForward(-0.5);
      break;
    case "d":
      controls.moveRight(0.5);
      break;
  }
};
document.addEventListener("keydown", onKeyDown, false);

// const onKeyDown = function (event) {
//   switch (event.keyCode) {
//     case 87:
//       controls.moveForward(0.25);
//       break;
//     case 65:
//       controls.moveRight(-0.25);
//       break;
//     case 83:
//       controls.moveForward(-0.25);
//       break;
//     case 68:
//       controls.moveRight(0.25);
//       break;
//   }
// };
// document.addEventListener("keydown", onKeyDown, false);

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

  //controls.update()

  render();

  stats.update();
};

function render() {
  renderer.render(scene, camera);
}
animate();
