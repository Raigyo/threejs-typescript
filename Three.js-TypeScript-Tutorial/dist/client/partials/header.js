const headerTemplate = document.createElement("template");
headerTemplate.innerHTML = `
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

<style>
/* Add a black background color to the top navigation */
.topnav {
  background-color: #333;
  overflow: hidden;
  
}

/* Style the links inside the navigation bar */
.topnav a {
  float: left;
  display: block;
  color: #f2f2f2;
  text-align: center;
  padding: 14px 16px;
  text-decoration: none;
  font-size: 17px;
}

/* Add an active class to highlight the current page */
.active {
  background-color: #04AA6D;
  color: white;
}

/* Hide the link that should open and close the topnav on small screens */
.topnav .icon {
  display: none;
}

/* Dropdown container - needed to position the dropdown content */
.dropdown {
  float: left;
  overflow: hidden;
}

/* Style the dropdown button to fit inside the topnav */
.dropdown .dropbtn {
  font-size: 17px;
  border: none;
  outline: none;
  color: white;
  padding: 14px 16px;
  background-color: inherit;
  font-family: inherit;
  margin: 0;
}

/* Style the dropdown content (hidden by default) */
.dropdown-content {
  display: none;
  position: absolute;
  background-color: #f9f9f9;
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
  z-index: 1;
}

/* Style the links inside the dropdown */
.dropdown-content a {
  float: none;
  color: black;
  padding: 12px 16px;
  text-decoration: none;
  display: block;
  text-align: left;
}

/* Add a dark background on topnav links and the dropdown button on hover */
.topnav a:hover, .dropdown:hover .dropbtn {
  background-color: #555;
  color: white;
}

/* Add a grey background to dropdown links on hover */
.dropdown-content a:hover {
  background-color: #ddd;
  color: black;
}

/* Show the dropdown menu when the user moves the mouse over the dropdown button */
.dropdown:hover .dropdown-content {
  display: block;
}

/* When the screen is less than 600 pixels wide, hide all links, except for the first one ("Home"). Show the link that contains should open and close the topnav (.icon) */
@media screen and (max-width: 600px) {
  .topnav a:not(:first-child), .dropdown .dropbtn {
    display: none;
  }
  .topnav a.icon {
    float: right;
    display: block;
  }
}

/* The "responsive" class is added to the topnav with JavaScript when the user clicks on the icon. This class makes the topnav look good on small screens (display the links vertically instead of horizontally) */
@media screen and (max-width: 600px) {
  .topnav {z-index: 1000}
  .topnav.responsive {
    position: relative;
    height: 500px;
    overflow: hidden;
    overflow-y: scroll;
  }
  .topnav.responsive a.icon {
    position: absolute;
    right: 0;
    top: 0;
  }
  .topnav.responsive a {
    float: none;
    display: block;
    text-align: left;
  }
  .topnav.responsive .dropdown {float: none;}
  .topnav.responsive .dropdown-content {position: relative; display: block;}
  .topnav.responsive .dropdown .dropbtn {
    display: block;
    width: 100%;
    text-align: left;
  }
}
</style>

<div class="topnav" id="myTopnav">
  <a href="/" class="active">Home</a>
  <a href="/components/geometry/geometry.html">Geometry</a>
  <div class="dropdown">
    <button class="dropbtn">Materials
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/materials/materials.html">Material</a>
      <a href="/components/materials/meshbasicmaterial.html">MeshBasicMaterial</a>
      <a href="/components/materials/meshnormalmaterial.html">MeshNormalMaterial</a>
      <a href="/components/materials/meshlambertmaterial.html">MeshLambertMaterial</a>
      <a href="/components/materials/meshphongmaterial.html">MeshPhongMaterial</a>
      <a href="/components/materials/meshstandardmaterial.html">MeshStandardMaterial</a>
      <a href="/components/materials/meshphysicalmaterial.html">MeshPhysicalMaterial</a>
      <a href="/components/materials/meshmatcapmaterial.html">MeshMatcapMaterial</a>
      <a href="/components/materials/meshtoonmaterial.html">MeshToonMaterial</a>
    </div>
  </div>
  <div class="dropdown">
    <button class="dropbtn">Maps
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/map/specularmap.html">SpecularMap</a>
      <a href="/components/map/roughness-metalness-map.html">RoughnessMap and MetalnessMap</a>
      <a href="/components/map/bumpmap.html">BumpMap</a>
      <a href="/components/map/displacementmap.html">DisplacementMap</a>
    </div>
  </div>
  <div class="dropdown">
    <button class="dropbtn">Textures
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/textures/uvmap.html">Material Repeat and Center</a>
      <a href="/components/textures/texture-minimaps.html">Texture Mipmaps</a>
      <a href="/components/textures/custom-minimaps.html">Custom Mipmaps</a>
      <a href="/components/textures/anisotropic-filter.html">Anistropic Filtering</a>
    </div>
  </div>
  <div class="dropdown">
    <button class="dropbtn">Lights
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/lights/ambiant-light.html">Ambient Light</a>
      <a href="/components/lights/directional-light.html">Directional Light</a>
      <a href="/components/lights/hemisphere-light.html">Hemisphere Light</a>
      <a href="/components/lights/point-light.html">Point Light</a>
      <a href="/components/lights/spot-light.html">Spot Light</a>
      <a href="/components/lights/spot-light-shadow.html">Spot Light Shadow</a>
      <a href="/components/lights/directional-light-shadow.html">Directional Light Shadow</a>
      <a href="/components/lights/cascaded-shadow-map.html">Cascaded Shadow Maps (CSM)</a>
    </div>
  </div>
  <div class="dropdown">
    <button class="dropbtn">Controls
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/controls/orbit-controls.html">Orbit Controls</a>
      <a href="/components/controls/trackball-controls.html">Trackball Controls</a>
      <a href="/components/controls/pointer-lock-controls.html">Pointer Lock Controls</a>
      <a href="/components/controls/drag-controls.html">Drag Controls</a>
      <a href="/components/controls/transform-controls.html">Transform Controls</a>
      <a href="/components/controls/multiple-controls.html">OrbitControls with DragControls</a>
      <a href="/components/controls/multiple-controls-2.html">OrbitControls with TransformControls</a>
    </div>
  </div>
  <div class="dropdown">
    <button class="dropbtn">Loaders
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/loader/obj-loader.html">OBJ Model Loader</a>
      <a href="/components/loader/mtl-loader.html">MTL Loader</a>
      <a href="/components/loader/gltf-loader.html">GLTF Model Loader</a>
      <a href="/components/loader/textured-gltf.html">Textured GLTF</a>
      <a href="/components/loader/draco-loader.html">DRACO Loader</a>
      <a href="/components/loader/fbx-loader.html">FBX Loader</a>
      <a href="/components/loader/fbx-animations.html">FBX Animations</a>
      <a href="/components/loader/gltf-animations.html">GLTF Animations</a>
      <a href="/components/loader/gltf-custom-animations.html">GLTF Custom Animations</a>
    </div>
  </div>
  <div class="dropdown">
    <button class="dropbtn">Raycaster
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/raycaster/raycaster.html">Raycaster</a>
      <a href="/components/raycaster/collision-detection.html">Collision Detection</a>
      <a href="/components/raycaster/mouse-picking.html">Mouse Picking</a>
      <a href="/components/raycaster/measurements.html">Measurements</a>
    </div>
  </div>
    <div class="dropdown">
    <button class="dropbtn">Tween and physics
      <i class="fa fa-caret-down"></i>
    </button>
    <div class="dropdown-content">
      <a href="/components/tween-physics/tween.html">Tween</a>
      <a href="/components/tween-physics/tween-animation.html">Tween with the AnimationMixer</a>
      <a href="/components/tween-physics/vector3-lerp.html">Vector3 Lerp</a>
      <a href="/components/tween-physics/physics-cannon.html">Physics with Cannon</a>
      <a href="/components/tween-physics/cannon-debug.html">Cannon Debug Renderer</a>
      <a href="/components/tween-physics/shapes-mixes.html">Trimeshes, ConvexPolyhedrons and Compound Shapes</a>
    </div>
  </div>
  <a href="javascript:void(0);" class="icon">&#9776;</a>
</div>

`;

class Header extends HTMLElement {
  constructor() {
    // Always call super first in constructor
    super();
  }

  connectedCallback() {
    const shadowRoot = this.attachShadow({ mode: "open" });

    shadowRoot.appendChild(headerTemplate.content);
    const burgerBtn = shadowRoot.querySelector("#myTopnav");
    // console.log("widget: ", widget);
    burgerBtn.addEventListener("click", (event) => {
      console.log("clicked");
      const x = shadowRoot.querySelector("#myTopnav");
      console.log(x);
      if (x.className === "topnav") {
        x.className += " responsive";
      } else {
        x.className = "topnav";
      }
    });
  }
}

customElements.define("header-component", Header);
