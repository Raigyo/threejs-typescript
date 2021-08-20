// import * as THREE from "/build/three.module.js";
// import { OrbitControls } from "/jsm/controls/OrbitControls";
// import { GLTFLoader } from "/jsm/loaders/GLTFLoader";
// import Stats from "/jsm/libs/stats.module";
// import { GUI } from "/jsm/libs/dat.gui.module";
// import { TWEEN } from "/jsm/libs/tween.module.min";

import * as THREE from "https://cdn.skypack.dev/three@0.125.2";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/controls/OrbitControls";
import { TWEEN } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/tween.module.min";
import { GLTFLoader } from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/loaders/GLTFLoader";
import Stats from "https://cdn.skypack.dev/three@0.125.2/examples/jsm/libs/stats.module";

const scene = new THREE.Scene();
scene.add(new THREE.AxesHelper(5));

const light1 = new THREE.SpotLight(); //new THREE.SpotLight();
light1.position.set(2.5, 5, 2.5);
light1.angle = Math.PI / 8;
light1.penumbra = 0.5;
light1.castShadow = true;
light1.shadow.mapSize.width = 1024;
light1.shadow.mapSize.height = 1024;
light1.shadow.camera.near = 0.5;
light1.shadow.camera.far = 20;
scene.add(light1);

const light2 = new THREE.SpotLight(); //new THREE.SpotLight();
light2.position.set(-2.5, 5, 2.5);
light2.angle = Math.PI / 8;
light2.penumbra = 0.5;
light2.castShadow = true;
light2.shadow.mapSize.width = 1024;
light2.shadow.mapSize.height = 1024;
light2.shadow.camera.near = 0.5;
light2.shadow.camera.far = 20;
scene.add(light2);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0.8, 1.4, 1.0);

const renderer = new THREE.WebGLRenderer({ canvas: webglCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1, 0);

const sceneMeshes: THREE.Mesh[] = [];

const planeGeometry = new THREE.PlaneGeometry(25, 25);
const texture = new THREE.TextureLoader().load("../../img/grid.png");
const plane = new THREE.Mesh(
  planeGeometry,
  new THREE.MeshPhongMaterial({ map: texture })
);
plane.rotateX(-Math.PI / 2);
plane.receiveShadow = true;
scene.add(plane);
sceneMeshes.push(plane);

let mixer: THREE.AnimationMixer;
let modelReady = false;
let modelMesh: THREE.Object3D;
const animationActions: THREE.AnimationAction[] = [];
let activeAction: THREE.AnimationAction;
let lastAction: THREE.AnimationAction;
const gltfLoader = new GLTFLoader();

gltfLoader.load(
  "../../models/ybot.glb",
  (gltf) => {
    gltf.scene.traverse(function (child) {
      if ((child as THREE.Mesh).isMesh) {
        let m = child as THREE.Mesh;
        m.castShadow = true;
        m.frustumCulled = false;
      }
    });

    mixer = new THREE.AnimationMixer(gltf.scene);

    const animationAction = mixer.clipAction((gltf as any).animations[0]);
    animationActions.push(animationAction);
    // animationsFolder.add(animations, "default");
    activeAction = animationActions[0];

    scene.add(gltf.scene);
    modelMesh = gltf.scene;

    //add an animation from another file
    gltfLoader.load(
      "../../models/fight.glb",
      (gltf) => {
        console.log("loaded fight");
        const animationAction = mixer.clipAction((gltf as any).animations[0]);
        animationActions.push(animationAction);
        // animationsFolder.add(animations, "fight");

        //add an animation from another file
        gltfLoader.load(
          "../../models/walking.glb",
          (gltf) => {
            console.log("loaded walking");
            (gltf as any).animations[0].tracks.shift(); //delete the specific track that moves the object forward while running
            const animationAction = mixer.clipAction(
              (gltf as any).animations[0]
            );
            animationActions.push(animationAction);
            // animationsFolder.add(animations, "walking");

            //add an animation from another file
            gltfLoader.load(
              "../../models/dance.glb",
              (gltf) => {
                console.log("loaded dance");
                (gltf as any).animations[0].tracks.shift(); //delete the specific track that moves the object forward while running
                const animationAction = mixer.clipAction(
                  (gltf as any).animations[0]
                );
                animationActions.push(animationAction);
                // animationsFolder.add(animations, "dance");

                modelReady = true;
              },
              (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
              },
              (error) => {
                console.log(error);
              }
            );
          },
          (xhr) => {
            console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
          },
          (error) => {
            console.log(error);
          }
        );
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.log(error);
      }
    );
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  (error) => {
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

const raycaster = new THREE.Raycaster();
const targetQuaternion = new THREE.Quaternion();

renderer.domElement.addEventListener("dblclick", onDoubleClick, false);
function onDoubleClick(event: MouseEvent) {
  let box = <HTMLVideoElement>document.querySelector("#webglCanvas");
  const rect = box.getBoundingClientRect();
  const mouse = {
    x: ((event.clientX - rect.left) / renderer.domElement.clientWidth) * 2 - 1,
    y: -((event.clientY - rect.top) / renderer.domElement.clientHeight) * 2 + 1,
  };
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(sceneMeshes, false);

  if (intersects.length > 0) {
    const p = intersects[0].point;

    const distance = modelMesh.position.distanceTo(p);

    //  modelMesh.lookAt(p);

    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.lookAt(p, modelMesh.position, modelMesh.up);
    targetQuaternion.setFromRotationMatrix(rotationMatrix);

    setAction(animationActions[2]);

    TWEEN.removeAll();
    new TWEEN.Tween(modelMesh.position)
      .to(
        {
          x: p.x,
          y: p.y,
          z: p.z,
        },
        (1000 / 2) * distance
      ) //walks 2 meters a second * the distance
      // camera following
      .onUpdate(() => {
        controls.target.set(
          modelMesh.position.x,
          modelMesh.position.y + 1,
          modelMesh.position.z
        );
        // light follow character
        light1.target = modelMesh;
        light2.target = modelMesh;
      })
      .start()
      .onComplete(() => {
        setAction(animationActions[3]);
        activeAction.clampWhenFinished = true; // animation will automatically be paused on its last frame
        activeAction.loop = THREE.LoopOnce;
      });
  }
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
  walking: function () {
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
    //lastAction.stop()
    lastAction.fadeOut(0.2);
    activeAction.reset();
    activeAction.fadeIn(0.2);
    activeAction.play();
  }
};

// const gui = new GUI();
// gui.domElement.id = "gui";
// const animationsFolder = gui.addFolder("Animations");
// animationsFolder.open();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  if (modelReady) {
    mixer.update(clock.getDelta());

    if (!modelMesh.quaternion.equals(targetQuaternion)) {
      modelMesh.quaternion.rotateTowards(
        targetQuaternion,
        clock.getDelta() * 1000
      );
    }
  }

  TWEEN.update();

  render();

  stats.update();
}

function render() {
  renderer.render(scene, camera);
}

animate();
