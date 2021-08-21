// import * as THREE from "/build/three.module.js";
// import { OrbitControls } from "/jsm/controls/OrbitControls";
// import { GLTF, GLTFLoader } from "/jsm/loaders/GLTFLoader";
// import Stats from "/jsm/libs/stats.module";
import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/OrbitControls";
import { GLTFLoader, } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/loaders/GLTFLoader";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";
const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5));
const camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(4, 4, 4);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
let mixer;
let modelReady = false;
const gltfLoader = new GLTFLoader();
const dropzone = document.getElementById("dropzone");
dropzone.ondragover = dropzone.ondragenter = function (evt) {
    evt.preventDefault();
};
dropzone.ondrop = function (evt) {
    evt.stopPropagation();
    evt.preventDefault();
    //clear the scene
    for (let i = scene.children.length - 1; i >= 0; i--) {
        scene.remove(scene.children[i]);
    }
    //clear the checkboxes
    const myNode = document.getElementById("animationsPanel");
    while (myNode.firstChild) {
        myNode.removeChild(myNode.lastChild);
    }
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
    const light1 = new THREE.DirectionalLight(new THREE.Color(0xffcccc));
    light1.position.set(-1, 1, 1);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(new THREE.Color(0xccffcc));
    light2.position.set(1, 1, 1);
    scene.add(light2);
    const light3 = new THREE.DirectionalLight(new THREE.Color(0xccccff));
    light3.position.set(0, -1, 0);
    scene.add(light3);
    const files = evt.dataTransfer.files;
    const reader = new FileReader();
    reader.onload = function () {
        gltfLoader.parse(reader.result, "/", (gltf) => {
            console.log(gltf.scene);
            mixer = new THREE.AnimationMixer(gltf.scene);
            console.log(gltf.animations);
            if (gltf.animations.length > 0) {
                const animationsPanel = document.getElementById("animationsPanel");
                const ul = document.createElement("UL");
                const ulElem = animationsPanel.appendChild(ul);
                gltf.animations.forEach((a, i) => {
                    const li = document.createElement("UL");
                    const liElem = ulElem.appendChild(li);
                    const checkBox = document.createElement("INPUT");
                    checkBox.id = "checkbox_" + i;
                    checkBox.type = "checkbox";
                    checkBox.addEventListener("change", (e) => {
                        if (e.target.checked) {
                            mixer.clipAction(gltf.animations[i]).play();
                        }
                        else {
                            mixer.clipAction(gltf.animations[i]).stop();
                        }
                    });
                    liElem.appendChild(checkBox);
                    const label = document.createElement("LABEL");
                    label.htmlFor = "checkbox_" + i;
                    label.innerHTML = a.name;
                    liElem.appendChild(label);
                });
            }
            else {
                const animationsPanel = document.getElementById("animationsPanel");
                animationsPanel.innerHTML = "No animations found in model";
            }
            scene.add(gltf.scene);
            const bbox = new THREE.Box3().setFromObject(gltf.scene);
            controls.target.x = (bbox.min.x + bbox.max.x) / 2;
            controls.target.y = (bbox.min.y + bbox.max.y) / 2;
            controls.target.z = (bbox.min.z + bbox.max.z) / 2;
            modelReady = true;
        }, (error) => {
            console.log(error);
        });
    };
    reader.readAsArrayBuffer(files[0]);
};
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
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (modelReady)
        mixer.update(clock.getDelta());
    render();
    stats.update();
}
function render() {
    renderer.render(scene, camera);
}
animate();
