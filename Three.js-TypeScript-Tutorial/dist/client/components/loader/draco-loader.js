// import * as THREE from "/build/three.module.js";
// import { OrbitControls } from "/jsm/controls/OrbitControls";
// import { GLTFLoader } from "/jsm/loaders/GLTFLoader";
// import { DRACOLoader } from "/jsm/loaders/DRACOLoader";
// import Stats from "/jsm/libs/stats.module";
import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/loaders/DRACOLoader";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";
const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5));
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 2;
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/js/libs/draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
loader.load("../../models/monkey_compressed.glb", function (gltf) {
    gltf.scene.traverse(function (child) {
        if (child.isMesh) {
            const m = child;
            m.receiveShadow = true;
            m.castShadow = true;
        }
        if (child.isLight) {
            const l = child;
            l.castShadow = true;
            l.shadow.bias = -0.003;
            l.shadow.mapSize.width = 2048;
            l.shadow.mapSize.height = 2048;
        }
    });
    scene.add(gltf.scene);
}, (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
}, (error) => {
    console.log(error);
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
