// import * as THREE from "/build/three.module.js";
// import { OrbitControls } from "/jsm/controls/OrbitControls";
// import { GLTFLoader } from "/jsm/loaders/GLTFLoader";
// import Stats from "/jsm/libs/stats.module";
import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/loaders/GLTFLoader";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";
const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5));
const light = new THREE.SpotLight();
light.position.set(12.5, 12.5, 12.5);
light.castShadow = true;
light.shadow.mapSize.width = 1024;
light.shadow.mapSize.height = 1024;
scene.add(light);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 15, 15);
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const pickableObjects = [];
let intersectedObject;
const originalMaterials = {};
const highlightedMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00ff00,
});
const loader = new GLTFLoader();
loader.load("../../models/simplescene.glb", function (gltf) {
    gltf.scene.traverse(function (child) {
        if (child.isMesh) {
            const m = child;
            //the sphere and plane will not be mouse picked. THe plane will receive shadows while everything else casts shadows.
            switch (m.name) {
                case "Plane":
                    m.receiveShadow = true;
                    break;
                case "Sphere":
                    m.castShadow = true;
                    break;
                default:
                    m.castShadow = true;
                    pickableObjects.push(m);
                    //store reference to original materials for later
                    originalMaterials[m.name] = m.material;
            }
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
const raycaster = new THREE.Raycaster();
let intersects;
document.addEventListener("mousemove", onDocumentMouseMove, false);
function onDocumentMouseMove(event) {
    const box = document.querySelector("#webglCanvas");
    const rect = box.getBoundingClientRect();
    raycaster.setFromCamera({
        x: ((event.clientX - rect.left) / renderer.domElement.clientWidth) * 2 - 1,
        y: -((event.clientY - rect.top) / renderer.domElement.clientHeight) * 2 +
            1,
    }, camera);
    intersects = raycaster.intersectObjects(pickableObjects, false);
    if (intersects.length > 0) {
        intersectedObject = intersects[0].object;
    }
    else {
        intersectedObject = null;
    }
    pickableObjects.forEach((o, i) => {
        if (intersectedObject && intersectedObject.name === o.name) {
            pickableObjects[i].material = highlightedMaterial;
        }
        else {
            pickableObjects[i].material = originalMaterials[o.name];
        }
    });
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
