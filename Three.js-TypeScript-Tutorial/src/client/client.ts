import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/loaders/GLTFLoader";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";
// import { GUI } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/dat.gui.module";
import { VRMLoader } from "/utils/VRMLoader.js";
let stats, controls;
let camera, cameraTarget, scene, renderer, light, model;
let modelReady = false;
let mixer: THREE.AnimationMixer;
// const animationActions: THREE.AnimationAction[] = [];

// loader

// An object to hold all the things needed for our loading screen
let loadingScreen = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(90, 1280 / 720, 0.1, 100),
  box: new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x4444ff })
  ),
};
let loadingManager = null;
let RESOURCES_LOADED = false;

// init

init();
animate();

function init() {
  // loader

  // Set up the loading screen's scene.
  // It can be treated just like our main scene.
  loadingScreen.box.position.set(0, 0, 5);
  loadingScreen.camera.lookAt(loadingScreen.box.position);
  loadingScreen.scene.add(loadingScreen.box);

  // Create a loading manager to set RESOURCES_LOADED when appropriate.
  // Pass loadingManager to all resource loaders.
  loadingManager = new THREE.LoadingManager();

  loadingManager.onProgress = function (item, loaded, total) {
    console.log(item, loaded, total);
  };

  loadingManager.onLoad = function () {
    console.log("loaded all resources");
    RESOURCES_LOADED = true;
  };
  // camera

  camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.25,
    20
  );
  camera.position.set(0, 1.6, -2.2);
  cameraTarget = new THREE.Vector3(0, 0.8, 0);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x72645b);
  scene.fog = new THREE.Fog(0x72645b, 2, 15);

  // Ground

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshPhongMaterial({ color: 0x999999, specular: 0x101010 })
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.5;
  scene.add(plane);

  plane.receiveShadow = true;

  // light

  light = new THREE.HemisphereLight(0xbbbbff, 0x444422);
  light.position.set(0, 1, 0);
  scene.add(light);

  // model
  const loader = new VRMLoader(loadingManager);
  loader.load("models/vroid.vrm", function (vrm) {
    // VRMLoader doesn't support VRM Unlit extension yet so
    // converting all materials to THREE.MeshBasicMaterial here as workaround so far.
    vrm.scene.traverse(function (object) {
      if (object.material) {
        if (Array.isArray(object.material)) {
          for (let i = 0, il = object.material.length; i < il; i++) {
            const material = new THREE.MeshBasicMaterial();
            THREE.Material.prototype.copy.call(material, object.material[i]);
            material.color.copy(object.material[i].color);
            material.map = object.material[i].map;
            object.material[i] = material;
          }
        } else {
          const material = new THREE.MeshBasicMaterial();
          THREE.Material.prototype.copy.call(material, object.material);
          material.color.copy(object.material.color);
          material.map = object.material.map;
          object.material = material;
        }
      }
    });
    model = vrm.scene;
    mixer = new THREE.AnimationMixer(model);
    model.position.set(0, 0, 0);
    model.castShadow = true;
    model.receiveShadow = true;
    scene.add(model);

    // //add an animation from another file
    // const gltfLoader = new GLTFLoader();
    // gltfLoader.load(
    //   "models/dance.glb",
    //   (gltf: any) => {
    //     console.log("loaded dance");
    //     const animationAction = mixer.clipAction((gltf as any).animations[0]);
    //     console.log("animationAction: ", animationAction);

    //     // animationActions.push(animationAction);
    //     // animationsFolder.add(animations, "dance");
    //     modelReady = true;
    //     animationAction.play();
    //   },
    //   (xhr: any) => {
    //     console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
    //   },
    //   (error: any) => {
    //     console.log(error);
    //   }
    // );
    // //
  });

  renderer = new THREE.WebGLRenderer({ canvas: webglCanvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  // container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 1;
  controls.maxDistance = 5;
  controls.enableDamping = true;
  controls.target.set(0, 0.9, 0);
  controls.update();

  window.addEventListener("resize", onWindowResize);

  // stats
  stats = new Stats();
  // container.appendChild(stats.dom);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

//
const clock = new THREE.Clock();
function animate() {
  // This block runs while resources are loading.
  if (RESOURCES_LOADED == false) {
    requestAnimationFrame(animate);

    loadingScreen.box.position.x -= 0.05;
    if (loadingScreen.box.position.x < -10) loadingScreen.box.position.x = 10;
    loadingScreen.box.position.y = Math.sin(loadingScreen.box.position.x);

    renderer.render(loadingScreen.scene, loadingScreen.camera);
    return; // Stop the function here.
  }
  requestAnimationFrame(animate);
  // if (modelReady) mixer.update(clock.getDelta());
  controls.update(); // to support damping
  const timer = Date.now() * 0.0005;

  camera.position.x = Math.cos(timer) * 3;
  camera.position.z = Math.sin(timer) * 3;
  camera.lookAt(cameraTarget);
  renderer.render(scene, camera);

  stats.update();
}
