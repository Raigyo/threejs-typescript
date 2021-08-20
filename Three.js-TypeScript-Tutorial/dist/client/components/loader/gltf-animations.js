// import * as THREE from "/build/three.module.js";
// import { OrbitControls } from "/jsm/controls/OrbitControls";
// import { GLTFLoader } from "/jsm/loaders/GLTFLoader";
// import Stats from "/jsm/libs/stats.module";
// import { GUI } from "/jsm/libs/dat.gui.module";
import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/loaders/GLTFLoader";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";
import { GUI } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/dat.gui.module";
const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5));
const light1 = new THREE.PointLight(0xffffff, 2);
light1.position.set(2.5, 2.5, 2.5);
scene.add(light1);
const light2 = new THREE.PointLight(0xffffff, 2);
light2.position.set(-2.5, 2.5, 2.5);
scene.add(light2);
// ground
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
mesh.rotation.x = -Math.PI / 2;
scene.add(mesh);
const camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0.8, 1.0, 2.0);
// camera.position.set(-5, 3, 5);
camera.lookAt(new THREE.Vector3(0, 2, 0));
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);
let mixer;
let modelReady = false;
const animationActions = [];
let activeAction;
let lastAction;
const gltfLoader = new GLTFLoader();
gltfLoader.load("../../models/ybot.glb", (gltf) => {
    // gltf.scene.scale.set(.01, .01, .01)
    mixer = new THREE.AnimationMixer(gltf.scene);
    const animationAction = mixer.clipAction(gltf.animations[0]);
    animationActions.push(animationAction);
    animationsFolder.add(animations, "default");
    activeAction = animationActions[0];
    scene.add(gltf.scene);
    //add an animation from another file
    gltfLoader.load("../../models/fight.glb", (gltf) => {
        console.log("loaded fight");
        const animationAction = mixer.clipAction(gltf.animations[0]);
        animationActions.push(animationAction);
        animationsFolder.add(animations, "fight");
        //add an animation from another file
        gltfLoader.load("../../models/zombie.glb", (gltf) => {
            console.log("loaded zombie");
            gltf.animations[0].tracks.shift(); //delete the specific track that moves the object forward while running
            const animationAction = mixer.clipAction(gltf.animations[0]);
            animationActions.push(animationAction);
            animationsFolder.add(animations, "zombie");
            //add an animation from another file
            gltfLoader.load("../../models/dance.glb", (gltf) => {
                console.log("loaded dance");
                const animationAction = mixer.clipAction(gltf.animations[0]);
                animationActions.push(animationAction);
                animationsFolder.add(animations, "dance");
                modelReady = true;
            }, (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
            }, (error) => {
                console.log(error);
            });
        }, (xhr) => {
            console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
        }, (error) => {
            console.log(error);
        });
    }, (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    }, (error) => {
        console.log(error);
    });
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
const animations = {
    default: function () {
        setAction(animationActions[0]);
    },
    fight: function () {
        setAction(animationActions[1]);
    },
    zombie: function () {
        setAction(animationActions[2]);
    },
    dance: function () {
        setAction(animationActions[3]);
    },
};
const setAction = (toAction) => {
    if (toAction != activeAction) {
        lastAction = activeAction;
        activeAction = toAction;
        //lastAction.stop()
        lastAction.fadeOut(1);
        activeAction.reset();
        activeAction.fadeIn(1);
        activeAction.play();
    }
};
const gui = new GUI();
gui.domElement.id = "gui";
const animationsFolder = gui.addFolder("Animations");
animationsFolder.open();
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
