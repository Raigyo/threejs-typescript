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
//scene.background = new THREE.Color(0xff0000)
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);
const light = new THREE.PointLight(0xffffff, 2);
light.position.set(10, 10, 10);
scene.add(light);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
//controls.addEventListener('change', render)
const boxGeometry = new THREE.BoxGeometry();
const sphereGeometry = new THREE.SphereGeometry();
const icosahedronGeometry = new THREE.IcosahedronGeometry(1, 0);
const planeGeometry = new THREE.PlaneGeometry();
const torusKnotGeometry = new THREE.TorusKnotGeometry();
const material = new THREE.MeshPhysicalMaterial({});
// const texture = new THREE.TextureLoader().load("../../img/grid.png")
// material.map = texture
// const envTexture = new THREE.CubeTextureLoader().load(["../../img/px_50.png", "../../img/nx_50.png", "../../img/py_50.png", "../../img/ny_50.png", "../../img/pz_50.png", "../../img/nz_50.png"])
// envTexture.mapping = THREE.CubeReflectionMapping
// //envTexture.mapping = THREE.CubeRefractionMapping
// material.envMap = envTexture
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
camera.position.z = 3;
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
    combine: {
        MultiplyOperation: THREE.MultiplyOperation,
        MixOperation: THREE.MixOperation,
        AddOperation: THREE.AddOperation,
    },
};
const gui = new GUI();
gui.domElement.id = "gui";
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
materialFolder.open();
var data = {
    color: material.color.getHex(),
    emissive: material.emissive.getHex(),
};
var meshPhysicalMaterialFolder = gui.addFolder("THREE.MeshPhysicalMaterial");
meshPhysicalMaterialFolder.addColor(data, "color").onChange(() => {
    material.color.setHex(Number(data.color.toString().replace("#", "0x")));
});
meshPhysicalMaterialFolder.addColor(data, "emissive").onChange(() => {
    material.emissive.setHex(Number(data.emissive.toString().replace("#", "0x")));
});
meshPhysicalMaterialFolder.add(material, "wireframe");
meshPhysicalMaterialFolder
    .add(material, "flatShading")
    .onChange(() => updateMaterial());
meshPhysicalMaterialFolder.add(material, "reflectivity", 0, 1);
meshPhysicalMaterialFolder.add(material, "refractionRatio", 0, 1);
meshPhysicalMaterialFolder.add(material, "roughness", 0, 1);
meshPhysicalMaterialFolder.add(material, "metalness", 0, 1);
//meshPhysicalMaterialFolder.add(material, 'clearcoat', 0, 1, 0.01)
//meshPhysicalMaterialFolder.add(material, 'clearcoatRoughness', 0, 1, 0.01)
meshPhysicalMaterialFolder.open();
function updateMaterial() {
    material.side = Number(material.side);
    material.needsUpdate = true;
}
var animate = function () {
    requestAnimationFrame(animate);
    //torusKnot.rotation.x+=.01
    //torusKnot.rotation.y+=.01
    render();
    stats.update();
};
function render() {
    renderer.render(scene, camera);
}
animate();
