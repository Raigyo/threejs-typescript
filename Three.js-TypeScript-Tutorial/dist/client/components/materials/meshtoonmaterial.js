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
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(5, 5, 5);
scene.add(light);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
const boxGeometry = new THREE.BoxGeometry();
const sphereGeometry = new THREE.SphereGeometry();
const icosahedronGeometry = new THREE.IcosahedronGeometry(1, 0);
const planeGeometry = new THREE.PlaneGeometry();
const torusKnotGeometry = new THREE.TorusKnotGeometry();
const threeTone = new THREE.TextureLoader().load("../../img/threeTone.jpg");
threeTone.minFilter = THREE.NearestFilter;
threeTone.magFilter = THREE.NearestFilter;
const fourTone = new THREE.TextureLoader().load("../../img/fourTone.jpg");
fourTone.minFilter = THREE.NearestFilter;
fourTone.magFilter = THREE.NearestFilter;
const fiveTone = new THREE.TextureLoader().load("../../img/fiveTone.jpg");
fiveTone.minFilter = THREE.NearestFilter;
fiveTone.magFilter = THREE.NearestFilter;
const material = new THREE.MeshToonMaterial();
const cube = new THREE.Mesh(boxGeometry, material);
cube.position.x = 5;
scene.add(cube);
const sphere = new THREE.Mesh(sphereGeometry, material);
sphere.position.x = 3;
scene.add(sphere);
const icosahedron = new THREE.Mesh(icosahedronGeometry, material);
icosahedron.position.x = 0;
scene.add(icosahedron);
const plane = new THREE.Mesh(planeGeometry, material);
plane.position.x = -2;
scene.add(plane);
const torusKnot = new THREE.Mesh(torusKnotGeometry, material);
torusKnot.position.x = -5;
scene.add(torusKnot);
camera.position.z = 5;
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
var options = {
    side: {
        FrontSide: THREE.FrontSide,
        BackSide: THREE.BackSide,
        DoubleSide: THREE.DoubleSide,
    },
    gradientMap: {
        Default: null,
        threeTone: "threeTone",
        fourTone: "fourTone",
        fiveTone: "fiveTone",
    },
};
const gui = new GUI();
gui.domElement.id = "gui";
var data = {
    lightColor: light.color.getHex(),
    color: material.color.getHex(),
    gradientMap: "fiveTone",
};
material.gradientMap = fiveTone;
const lightFolder = gui.addFolder("THREE.Light");
lightFolder.addColor(data, "lightColor").onChange(() => {
    light.color.setHex(Number(data.lightColor.toString().replace("#", "0x")));
});
lightFolder.add(light, "intensity", 0, 4);
const materialFolder = gui.addFolder("THREE.Material");
materialFolder.add(material, "transparent");
materialFolder.add(material, "opacity", 0, 1, 0.01);
materialFolder.add(material, "depthTest");
materialFolder.add(material, "depthWrite");
materialFolder
    .add(material, "alphaTest", 0, 1, 0.01)
    .onChange(() => updateMaterial());
materialFolder.add(material, "visible");
materialFolder
    .add(material, "side", options.side)
    .onChange(() => updateMaterial());
//materialFolder.open()
var meshToonMaterialFolder = gui.addFolder("THREE.MeshToonMaterial");
meshToonMaterialFolder.addColor(data, "color").onChange(() => {
    material.color.setHex(Number(data.color.toString().replace("#", "0x")));
});
meshToonMaterialFolder
    .add(material, "flatShading")
    .onChange(() => updateMaterial());
meshToonMaterialFolder
    .add(data, "gradientMap", options.gradientMap)
    .onChange(() => updateMaterial());
meshToonMaterialFolder.open();
function updateMaterial() {
    material.side = Number(material.side);
    material.gradientMap = eval(data.gradientMap);
    material.needsUpdate = true;
}
var animate = function () {
    requestAnimationFrame(animate);
    icosahedron.rotation.y += 0.005;
    icosahedron.rotation.x += 0.005;
    cube.rotation.y += 0.005;
    cube.rotation.x += 0.005;
    torusKnot.rotation.y += 0.005;
    torusKnot.rotation.x += 0.005;
    sphere.rotation.y += 0.005;
    sphere.rotation.x += 0.005;
    plane.rotation.y += 0.005;
    plane.rotation.x += 0.005;
    render();
    stats.update();
};
function render() {
    renderer.render(scene, camera);
}
animate();
