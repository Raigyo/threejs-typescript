import * as THREE from "/build/three.module.js";
import { OrbitControls } from "/jsm/controls/OrbitControls";
import { FBXLoader } from "/jsm/loaders/FBXLoader";
import Stats from "/jsm/libs/stats.module";
import { GUI } from "/jsm/libs/dat.gui.module";

const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5));

const light = new THREE.PointLight();
light.position.set(2.5, 7.5, 15);
scene.add(light);

const camera = new THREE.PerspectiveCamera(
  85,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0.8, 1.0, 2.0);
// camera.position.set(-5, 3, 5);
camera.lookAt(new THREE.Vector3(0, 2, 0));

const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

let mixer: THREE.AnimationMixer;
let modelReady = false;
const animationActions: THREE.AnimationAction[] = [];
let activeAction: THREE.AnimationAction;
let lastAction: THREE.AnimationAction;
const fbxLoader: FBXLoader = new FBXLoader();

fbxLoader.load(
  "../../models/xbot.fbx",
  (object: any) => {
    object.scale.set(0.01, 0.01, 0.01);
    mixer = new THREE.AnimationMixer(object);

    const animationAction = mixer.clipAction(
      (object as THREE.Object3D).animations[0]
    );
    animationActions.push(animationAction);
    animationsFolder.add(animations, "default");
    activeAction = animationActions[0];
    scene.background = new THREE.Color(0xe0e0e0);
    scene.fog = new THREE.Fog(0xe0e0e0, 20, 100);
    scene.add(object);

    // lights

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(0, 20, 10);
    scene.add(dirLight);

    // ground

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);

    const grid = new THREE.GridHelper(200, 40, 0x000000, 0x000000);
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    // add an animation from another file
    fbxLoader.load(
      "../../models/idle.fbx",
      (object: any) => {
        console.log("loaded idle");

        const animationAction = mixer.clipAction(
          (object as THREE.Object3D).animations[0]
        );
        animationActions.push(animationAction);
        animationsFolder.add(animations, "idle");

        // add an animation from another file
        fbxLoader.load(
          "../../models/praise.fbx",
          (object: any) => {
            console.log("loaded praise the sun");
            const animationAction = mixer.clipAction(
              (object as THREE.Object3D).animations[0]
            );
            animationActions.push(animationAction);
            animationsFolder.add(animations, "praise");

            // add an animation from another file
            fbxLoader.load(
              "../../models/dance.fbx",
              (object: any) => {
                console.log("loaded dance");
                // (object as THREE.Object3D).animations[0].tracks.shift(); //delete the specific track that moves the object forward while running
                // console.dir((object as THREE.Object3D).animations[0])
                const animationAction = mixer.clipAction(
                  (object as THREE.Object3D).animations[0]
                );
                animationActions.push(animationAction);
                animationsFolder.add(animations, "dance");

                modelReady = true;
              },
              (xhr: any) => {
                console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
              },
              (error: any) => {
                console.log(error);
              }
            );
          },
          (xhr: any) => {
            console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
          },
          (error: any) => {
            console.log(error);
          }
        );
      },
      (xhr: any) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error: any) => {
        console.log(error);
      }
    );
  },
  (xhr: any) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  (error: any) => {
    console.log(error);
  }
);

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
  idle: function () {
    setAction(animationActions[1]);
  },
  praise: function () {
    setAction(animationActions[2]);
  },
  dance: function () {
    setAction(animationActions[3]);
  },
};

const setAction = (toAction: THREE.AnimationAction) => {
  if (toAction != activeAction) {
    lastAction = activeAction;
    activeAction = toAction;
    lastAction.stop();
    //lastAction.fadeOut(1)
    activeAction.reset();
    //activeAction.fadeIn(1)
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

  if (modelReady) mixer.update(clock.getDelta());

  render();

  stats.update();
}

function render() {
  renderer.render(scene, camera);
}

animate();
