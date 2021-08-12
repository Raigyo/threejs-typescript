import * as THREE from "/build/three.module.js";
import { OrbitControls } from "/jsm/controls/OrbitControls";
import { OBJLoader } from "/jsm/loaders/OBJLoader";
import { MTLLoader } from "/jsm/loaders/MTLLoader";
import Stats from "/jsm/libs/stats.module";
const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5));
const light = new THREE.PointLight();
light.position.set(2.5, 7.5, 15);
scene.add(light);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const mtlLoader = new MTLLoader();
mtlLoader.load("../../models/monkey.mtl", (materials) => {
    materials.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load("../../models/monkey.obj", (object) => {
        object.position.x = -1.5;
        scene.add(object);
    }, (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    }, (error) => {
        console.log("An error happened");
    });
}, (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
}, (error) => {
    console.log("An error happened");
});
mtlLoader.load("../../models/monkeyTextured.mtl", (materials) => {
    materials.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.load("../../models/monkeyTextured.obj", (object) => {
        object.position.x = 1.5;
        scene.add(object);
    }, (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    }, (error) => {
        console.log("An error happened");
    });
}, (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
}, (error) => {
    console.log("An error happened");
});
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
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    render();
    stats.update();
}
function render() {
    renderer.render(scene, camera);
}
animate();
