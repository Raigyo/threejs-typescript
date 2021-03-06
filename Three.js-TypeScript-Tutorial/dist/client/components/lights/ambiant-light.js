// If using Relative Import References
// import * as THREE from "/build/three.module.js";
// import { OrbitControls } from "/jsm/controls/OrbitControls";
// import Stats from "/jsm/libs/stats.module";
// import { GUI } from "/jsm/libs/dat.gui.module";
// If using Module Specifiers
//import * as THREE from 'three'
//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
//import Stats from 'three/examples/jsm/libs/stats.module'
//import { GUI } from 'three/examples/jsm/libs/dat.gui.module'
import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/OrbitControls";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";
import { GUI } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/dat.gui.module";
const scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);
var light = new THREE.AmbientLight();
scene.add(light);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
// const planeGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(20, 10)//, 360, 180)
// const plane: THREE.Mesh = new THREE.Mesh(planeGeometry, new THREE.MeshPhongMaterial())
// plane.rotateX(-Math.PI / 2)
// //plane.position.y = -1.75
// scene.add(plane)
const torusGeometry = [
    new THREE.TorusGeometry(),
    new THREE.TorusGeometry(),
    new THREE.TorusGeometry(),
    new THREE.TorusGeometry(),
    new THREE.TorusGeometry(),
];
const material = [
    new THREE.MeshBasicMaterial(),
    new THREE.MeshLambertMaterial(),
    new THREE.MeshPhongMaterial(),
    new THREE.MeshPhysicalMaterial({}),
    new THREE.MeshToonMaterial(),
];
const torus = [
    new THREE.Mesh(torusGeometry[0], material[0]),
    new THREE.Mesh(torusGeometry[1], material[1]),
    new THREE.Mesh(torusGeometry[2], material[2]),
    new THREE.Mesh(torusGeometry[3], material[3]),
    new THREE.Mesh(torusGeometry[4], material[4]),
];
const texture = new THREE.TextureLoader().load("../../img/grid.png");
material[0].map = texture;
material[1].map = texture;
material[2].map = texture;
material[3].map = texture;
material[4].map = texture;
torus[0].position.x = -8;
torus[1].position.x = -4;
torus[2].position.x = 0;
torus[3].position.x = 4;
torus[4].position.x = 8;
scene.add(torus[0]);
scene.add(torus[1]);
scene.add(torus[2]);
scene.add(torus[3]);
scene.add(torus[4]);
camera.position.z = 7;
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
var data = {
    color: light.color.getHex(),
    mapsEnabled: true,
};
const gui = new GUI();
gui.domElement.id = "gui";
const lightFolder = gui.addFolder("THREE.Light");
lightFolder.addColor(data, "color").onChange(() => {
    light.color.setHex(Number(data.color.toString().replace("#", "0x")));
});
lightFolder.add(light, "intensity", 0, 1, 0.01);
const ambientLightFolder = gui.addFolder("THREE.AmbientLight");
ambientLightFolder.open();
const meshesFolder = gui.addFolder("Meshes");
meshesFolder.add(data, "mapsEnabled").onChange(() => {
    material.forEach((m) => {
        if (data.mapsEnabled) {
            m.map = texture;
        }
        else {
            m.map = null;
        }
        m.needsUpdate = true;
    });
});
var animate = function () {
    requestAnimationFrame(animate);
    torus.forEach((t) => {
        t.rotation.y += 0.01;
    });
    render();
    stats.update();
};
function render() {
    renderer.render(scene, camera);
}
animate();
