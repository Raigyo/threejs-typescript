// renderer
const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
// camera
const camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
camera.position.set(0.0, 1.0, 5.0);
// camera controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;
controls.target.set(0.0, 1.0, 0.0);
controls.update();
// scene
const scene = new THREE.Scene();
// light
const light = new THREE.DirectionalLight(0xffffff);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);
// gltf and vrm
const loader = new THREE.GLTFLoader();
loader.crossOrigin = "anonymous";
loader.load(
// URL of the VRM you want to load
"./models/vroid-character.vrm", 
// called when the resource is loaded
(gltf) => {
    // calling this function greatly improves the performance
    THREE.VRMUtils.removeUnnecessaryJoints(gltf.scene);
    // generate VRM instance from gltf
    THREE.VRM.from(gltf).then((vrm) => {
        console.log(vrm);
        scene.add(vrm.scene);
        vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;
    });
}, 
// called while loading is progressing
(progress) => console.log("Loading model...", 100.0 * (progress.loaded / progress.total), "%"), 
// called when loading has errors
(error) => console.error(error));
// helpers
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();
