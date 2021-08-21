/*!
 * @pixiv/three-vrm v0.6.4
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2021 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? factory(exports, require("three"))
    : typeof define === "function" && define.amd
    ? define(["exports", "three"], factory)
    : ((global =
        typeof globalThis !== "undefined" ? globalThis : global || self),
      factory((global.THREE_VRM = {}), global.THREE));
})(this, function (exports, THREE) {
  "use strict";

  /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

  function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }

  // See: https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
  function disposeMaterial(material) {
    Object.keys(material).forEach((propertyName) => {
      const value = material[propertyName];
      if (value === null || value === void 0 ? void 0 : value.isTexture) {
        const texture = value;
        texture.dispose();
      }
    });
    material.dispose();
  }
  function dispose(object3D) {
    const geometry = object3D.geometry;
    if (geometry) {
      geometry.dispose();
    }
    const material = object3D.material;
    if (material) {
      if (Array.isArray(material)) {
        material.forEach((material) => disposeMaterial(material));
      } else if (material) {
        disposeMaterial(material);
      }
    }
  }
  function deepDispose(object3D) {
    object3D.traverse(dispose);
  }

  var VRMBlendShapeMaterialValueType;
  (function (VRMBlendShapeMaterialValueType) {
    VRMBlendShapeMaterialValueType[
      (VRMBlendShapeMaterialValueType["NUMBER"] = 0)
    ] = "NUMBER";
    VRMBlendShapeMaterialValueType[
      (VRMBlendShapeMaterialValueType["VECTOR2"] = 1)
    ] = "VECTOR2";
    VRMBlendShapeMaterialValueType[
      (VRMBlendShapeMaterialValueType["VECTOR3"] = 2)
    ] = "VECTOR3";
    VRMBlendShapeMaterialValueType[
      (VRMBlendShapeMaterialValueType["VECTOR4"] = 3)
    ] = "VECTOR4";
    VRMBlendShapeMaterialValueType[
      (VRMBlendShapeMaterialValueType["COLOR"] = 4)
    ] = "COLOR";
  })(VRMBlendShapeMaterialValueType || (VRMBlendShapeMaterialValueType = {}));
  const _v2 = new THREE.Vector2();
  const _v3 = new THREE.Vector3();
  const _v4 = new THREE.Vector4();
  const _color = new THREE.Color();
  // animationMixer の監視対象は、Scene の中に入っている必要がある。
  // そのため、表示オブジェクトではないけれど、Object3D を継承して Scene に投入できるようにする。
  class VRMBlendShapeGroup extends THREE.Object3D {
    constructor(expressionName) {
      super();
      this.weight = 0.0;
      this.isBinary = false;
      this._binds = [];
      this._materialValues = [];
      this.name = `BlendShapeController_${expressionName}`;
      // traverse 時の救済手段として Object3D ではないことを明示しておく
      this.type = "BlendShapeController";
      // 表示目的のオブジェクトではないので、負荷軽減のために visible を false にしておく。
      // これにより、このインスタンスに対する毎フレームの matrix 自動計算を省略できる。
      this.visible = false;
    }
    addBind(args) {
      // original weight is 0-100 but we want to deal with this value within 0-1
      const weight = args.weight / 100;
      this._binds.push({
        meshes: args.meshes,
        morphTargetIndex: args.morphTargetIndex,
        weight,
      });
    }
    addMaterialValue(args) {
      const material = args.material;
      const propertyName = args.propertyName;
      let value = material[propertyName];
      if (!value) {
        // property has not been found
        return;
      }
      value = args.defaultValue || value;
      let type;
      let defaultValue;
      let targetValue;
      let deltaValue;
      if (value.isVector2) {
        type = VRMBlendShapeMaterialValueType.VECTOR2;
        defaultValue = value.clone();
        targetValue = new THREE.Vector2().fromArray(args.targetValue);
        deltaValue = targetValue.clone().sub(defaultValue);
      } else if (value.isVector3) {
        type = VRMBlendShapeMaterialValueType.VECTOR3;
        defaultValue = value.clone();
        targetValue = new THREE.Vector3().fromArray(args.targetValue);
        deltaValue = targetValue.clone().sub(defaultValue);
      } else if (value.isVector4) {
        type = VRMBlendShapeMaterialValueType.VECTOR4;
        defaultValue = value.clone();
        // vectorProperty and targetValue index is different from each other
        // exported vrm by UniVRM file is
        //
        // vectorProperty
        // offset = targetValue[0], targetValue[1]
        // tiling = targetValue[2], targetValue[3]
        //
        // targetValue
        // offset = targetValue[2], targetValue[3]
        // tiling = targetValue[0], targetValue[1]
        targetValue = new THREE.Vector4().fromArray([
          args.targetValue[2],
          args.targetValue[3],
          args.targetValue[0],
          args.targetValue[1],
        ]);
        deltaValue = targetValue.clone().sub(defaultValue);
      } else if (value.isColor) {
        type = VRMBlendShapeMaterialValueType.COLOR;
        defaultValue = value.clone();
        targetValue = new THREE.Color().fromArray(args.targetValue);
        deltaValue = targetValue.clone().sub(defaultValue);
      } else {
        type = VRMBlendShapeMaterialValueType.NUMBER;
        defaultValue = value;
        targetValue = args.targetValue[0];
        deltaValue = targetValue - defaultValue;
      }
      this._materialValues.push({
        material,
        propertyName,
        defaultValue,
        targetValue,
        deltaValue,
        type,
      });
    }
    /**
     * Apply weight to every assigned blend shapes.
     * Should be called via {@link BlendShapeMaster#update}.
     */
    applyWeight() {
      const w = this.isBinary ? (this.weight < 0.5 ? 0.0 : 1.0) : this.weight;
      this._binds.forEach((bind) => {
        bind.meshes.forEach((mesh) => {
          if (!mesh.morphTargetInfluences) {
            return;
          } // TODO: we should kick this at `addBind`
          mesh.morphTargetInfluences[bind.morphTargetIndex] += w * bind.weight;
        });
      });
      this._materialValues.forEach((materialValue) => {
        const prop = materialValue.material[materialValue.propertyName];
        if (prop === undefined) {
          return;
        } // TODO: we should kick this at `addMaterialValue`
        if (materialValue.type === VRMBlendShapeMaterialValueType.NUMBER) {
          const deltaValue = materialValue.deltaValue;
          materialValue.material[materialValue.propertyName] += deltaValue * w;
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.VECTOR2
        ) {
          const deltaValue = materialValue.deltaValue;
          materialValue.material[materialValue.propertyName].add(
            _v2.copy(deltaValue).multiplyScalar(w)
          );
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.VECTOR3
        ) {
          const deltaValue = materialValue.deltaValue;
          materialValue.material[materialValue.propertyName].add(
            _v3.copy(deltaValue).multiplyScalar(w)
          );
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.VECTOR4
        ) {
          const deltaValue = materialValue.deltaValue;
          materialValue.material[materialValue.propertyName].add(
            _v4.copy(deltaValue).multiplyScalar(w)
          );
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.COLOR
        ) {
          const deltaValue = materialValue.deltaValue;
          materialValue.material[materialValue.propertyName].add(
            _color.copy(deltaValue).multiplyScalar(w)
          );
        }
        if (typeof materialValue.material.shouldApplyUniforms === "boolean") {
          materialValue.material.shouldApplyUniforms = true;
        }
      });
    }
    /**
     * Clear previously assigned blend shapes.
     */
    clearAppliedWeight() {
      this._binds.forEach((bind) => {
        bind.meshes.forEach((mesh) => {
          if (!mesh.morphTargetInfluences) {
            return;
          } // TODO: we should kick this at `addBind`
          mesh.morphTargetInfluences[bind.morphTargetIndex] = 0.0;
        });
      });
      this._materialValues.forEach((materialValue) => {
        const prop = materialValue.material[materialValue.propertyName];
        if (prop === undefined) {
          return;
        } // TODO: we should kick this at `addMaterialValue`
        if (materialValue.type === VRMBlendShapeMaterialValueType.NUMBER) {
          const defaultValue = materialValue.defaultValue;
          materialValue.material[materialValue.propertyName] = defaultValue;
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.VECTOR2
        ) {
          const defaultValue = materialValue.defaultValue;
          materialValue.material[materialValue.propertyName].copy(defaultValue);
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.VECTOR3
        ) {
          const defaultValue = materialValue.defaultValue;
          materialValue.material[materialValue.propertyName].copy(defaultValue);
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.VECTOR4
        ) {
          const defaultValue = materialValue.defaultValue;
          materialValue.material[materialValue.propertyName].copy(defaultValue);
        } else if (
          materialValue.type === VRMBlendShapeMaterialValueType.COLOR
        ) {
          const defaultValue = materialValue.defaultValue;
          materialValue.material[materialValue.propertyName].copy(defaultValue);
        }
        if (typeof materialValue.material.shouldApplyUniforms === "boolean") {
          materialValue.material.shouldApplyUniforms = true;
        }
      });
    }
  }

  // Typedoc does not support export declarations yet
  (function (VRMSchema) {
    (function (BlendShapePresetName) {
      BlendShapePresetName["A"] = "a";
      BlendShapePresetName["Angry"] = "angry";
      BlendShapePresetName["Blink"] = "blink";
      BlendShapePresetName["BlinkL"] = "blink_l";
      BlendShapePresetName["BlinkR"] = "blink_r";
      BlendShapePresetName["E"] = "e";
      BlendShapePresetName["Fun"] = "fun";
      BlendShapePresetName["I"] = "i";
      BlendShapePresetName["Joy"] = "joy";
      BlendShapePresetName["Lookdown"] = "lookdown";
      BlendShapePresetName["Lookleft"] = "lookleft";
      BlendShapePresetName["Lookright"] = "lookright";
      BlendShapePresetName["Lookup"] = "lookup";
      BlendShapePresetName["Neutral"] = "neutral";
      BlendShapePresetName["O"] = "o";
      BlendShapePresetName["Sorrow"] = "sorrow";
      BlendShapePresetName["U"] = "u";
      BlendShapePresetName["Unknown"] = "unknown";
    })(VRMSchema.BlendShapePresetName || (VRMSchema.BlendShapePresetName = {}));
    (function (FirstPersonLookAtTypeName) {
      FirstPersonLookAtTypeName["BlendShape"] = "BlendShape";
      FirstPersonLookAtTypeName["Bone"] = "Bone";
    })(
      VRMSchema.FirstPersonLookAtTypeName ||
        (VRMSchema.FirstPersonLookAtTypeName = {})
    );
    (function (HumanoidBoneName) {
      HumanoidBoneName["Chest"] = "chest";
      HumanoidBoneName["Head"] = "head";
      HumanoidBoneName["Hips"] = "hips";
      HumanoidBoneName["Jaw"] = "jaw";
      HumanoidBoneName["LeftEye"] = "leftEye";
      HumanoidBoneName["LeftFoot"] = "leftFoot";
      HumanoidBoneName["LeftHand"] = "leftHand";
      HumanoidBoneName["LeftIndexDistal"] = "leftIndexDistal";
      HumanoidBoneName["LeftIndexIntermediate"] = "leftIndexIntermediate";
      HumanoidBoneName["LeftIndexProximal"] = "leftIndexProximal";
      HumanoidBoneName["LeftLittleDistal"] = "leftLittleDistal";
      HumanoidBoneName["LeftLittleIntermediate"] = "leftLittleIntermediate";
      HumanoidBoneName["LeftLittleProximal"] = "leftLittleProximal";
      HumanoidBoneName["LeftLowerArm"] = "leftLowerArm";
      HumanoidBoneName["LeftLowerLeg"] = "leftLowerLeg";
      HumanoidBoneName["LeftMiddleDistal"] = "leftMiddleDistal";
      HumanoidBoneName["LeftMiddleIntermediate"] = "leftMiddleIntermediate";
      HumanoidBoneName["LeftMiddleProximal"] = "leftMiddleProximal";
      HumanoidBoneName["LeftRingDistal"] = "leftRingDistal";
      HumanoidBoneName["LeftRingIntermediate"] = "leftRingIntermediate";
      HumanoidBoneName["LeftRingProximal"] = "leftRingProximal";
      HumanoidBoneName["LeftShoulder"] = "leftShoulder";
      HumanoidBoneName["LeftThumbDistal"] = "leftThumbDistal";
      HumanoidBoneName["LeftThumbIntermediate"] = "leftThumbIntermediate";
      HumanoidBoneName["LeftThumbProximal"] = "leftThumbProximal";
      HumanoidBoneName["LeftToes"] = "leftToes";
      HumanoidBoneName["LeftUpperArm"] = "leftUpperArm";
      HumanoidBoneName["LeftUpperLeg"] = "leftUpperLeg";
      HumanoidBoneName["Neck"] = "neck";
      HumanoidBoneName["RightEye"] = "rightEye";
      HumanoidBoneName["RightFoot"] = "rightFoot";
      HumanoidBoneName["RightHand"] = "rightHand";
      HumanoidBoneName["RightIndexDistal"] = "rightIndexDistal";
      HumanoidBoneName["RightIndexIntermediate"] = "rightIndexIntermediate";
      HumanoidBoneName["RightIndexProximal"] = "rightIndexProximal";
      HumanoidBoneName["RightLittleDistal"] = "rightLittleDistal";
      HumanoidBoneName["RightLittleIntermediate"] = "rightLittleIntermediate";
      HumanoidBoneName["RightLittleProximal"] = "rightLittleProximal";
      HumanoidBoneName["RightLowerArm"] = "rightLowerArm";
      HumanoidBoneName["RightLowerLeg"] = "rightLowerLeg";
      HumanoidBoneName["RightMiddleDistal"] = "rightMiddleDistal";
      HumanoidBoneName["RightMiddleIntermediate"] = "rightMiddleIntermediate";
      HumanoidBoneName["RightMiddleProximal"] = "rightMiddleProximal";
      HumanoidBoneName["RightRingDistal"] = "rightRingDistal";
      HumanoidBoneName["RightRingIntermediate"] = "rightRingIntermediate";
      HumanoidBoneName["RightRingProximal"] = "rightRingProximal";
      HumanoidBoneName["RightShoulder"] = "rightShoulder";
      HumanoidBoneName["RightThumbDistal"] = "rightThumbDistal";
      HumanoidBoneName["RightThumbIntermediate"] = "rightThumbIntermediate";
      HumanoidBoneName["RightThumbProximal"] = "rightThumbProximal";
      HumanoidBoneName["RightToes"] = "rightToes";
      HumanoidBoneName["RightUpperArm"] = "rightUpperArm";
      HumanoidBoneName["RightUpperLeg"] = "rightUpperLeg";
      HumanoidBoneName["Spine"] = "spine";
      HumanoidBoneName["UpperChest"] = "upperChest";
    })(VRMSchema.HumanoidBoneName || (VRMSchema.HumanoidBoneName = {}));
    (function (MetaAllowedUserName) {
      MetaAllowedUserName["Everyone"] = "Everyone";
      MetaAllowedUserName["ExplicitlyLicensedPerson"] =
        "ExplicitlyLicensedPerson";
      MetaAllowedUserName["OnlyAuthor"] = "OnlyAuthor";
    })(VRMSchema.MetaAllowedUserName || (VRMSchema.MetaAllowedUserName = {}));
    (function (MetaUssageName) {
      MetaUssageName["Allow"] = "Allow";
      MetaUssageName["Disallow"] = "Disallow";
    })(VRMSchema.MetaUssageName || (VRMSchema.MetaUssageName = {}));
    (function (MetaLicenseName) {
      MetaLicenseName["Cc0"] = "CC0";
      MetaLicenseName["CcBy"] = "CC_BY";
      MetaLicenseName["CcByNc"] = "CC_BY_NC";
      MetaLicenseName["CcByNcNd"] = "CC_BY_NC_ND";
      MetaLicenseName["CcByNcSa"] = "CC_BY_NC_SA";
      MetaLicenseName["CcByNd"] = "CC_BY_ND";
      MetaLicenseName["CcBySa"] = "CC_BY_SA";
      MetaLicenseName["Other"] = "Other";
      MetaLicenseName["RedistributionProhibited"] = "Redistribution_Prohibited";
    })(VRMSchema.MetaLicenseName || (VRMSchema.MetaLicenseName = {}));
  })(exports.VRMSchema || (exports.VRMSchema = {}));

  function extractPrimitivesInternal(gltf, nodeIndex, node) {
    /**
     * Let's list up every possible patterns that parsed gltf nodes with a mesh can have,,,
     *
     * "*" indicates that those meshes should be listed up using this function
     *
     * ### A node with a (mesh, a signle primitive)
     *
     * - `THREE.Mesh`: The only primitive of the mesh *
     *
     * ### A node with a (mesh, multiple primitives)
     *
     * - `THREE.Group`: The root of the mesh
     *   - `THREE.Mesh`: A primitive of the mesh *
     *   - `THREE.Mesh`: A primitive of the mesh (2) *
     *
     * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, a single primitive)
     *
     * - `THREE.Group`: The root of the mesh
     *   - `THREE.Mesh`: A primitive of the mesh *
     *   - `THREE.Mesh`: A primitive of the mesh (2) *
     *   - `THREE.Mesh`: A primitive of a MESH OF THE CHILD
     *
     * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, multiple primitives)
     *
     * - `THREE.Group`: The root of the mesh
     *   - `THREE.Mesh`: A primitive of the mesh *
     *   - `THREE.Mesh`: A primitive of the mesh (2) *
     *   - `THREE.Group`: The root of a MESH OF THE CHILD
     *     - `THREE.Mesh`: A primitive of the mesh of the child
     *     - `THREE.Mesh`: A primitive of the mesh of the child (2)
     *
     * ### A node with a (mesh, multiple primitives) BUT the node is a bone
     *
     * - `THREE.Bone`: The root of the node, as a bone
     *   - `THREE.Group`: The root of the mesh
     *     - `THREE.Mesh`: A primitive of the mesh *
     *     - `THREE.Mesh`: A primitive of the mesh (2) *
     *
     * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, multiple primitives) BUT the node is a bone
     *
     * - `THREE.Bone`: The root of the node, as a bone
     *   - `THREE.Group`: The root of the mesh
     *     - `THREE.Mesh`: A primitive of the mesh *
     *     - `THREE.Mesh`: A primitive of the mesh (2) *
     *   - `THREE.Group`: The root of a MESH OF THE CHILD
     *     - `THREE.Mesh`: A primitive of the mesh of the child
     *     - `THREE.Mesh`: A primitive of the mesh of the child (2)
     *
     * ...I will take a strategy that traverses the root of the node and take first (primitiveCount) meshes.
     */
    // Make sure that the node has a mesh
    const schemaNode = gltf.parser.json.nodes[nodeIndex];
    const meshIndex = schemaNode.mesh;
    if (meshIndex == null) {
      return null;
    }
    // How many primitives the mesh has?
    const schemaMesh = gltf.parser.json.meshes[meshIndex];
    const primitiveCount = schemaMesh.primitives.length;
    // Traverse the node and take first (primitiveCount) meshes
    const primitives = [];
    node.traverse((object) => {
      if (primitives.length < primitiveCount) {
        if (object.isMesh) {
          primitives.push(object);
        }
      }
    });
    return primitives;
  }
  /**
   * Extract primitives ( `THREE.Mesh[]` ) of a node from a loaded GLTF.
   * The main purpose of this function is to distinguish primitives and children from a node that has both meshes and children.
   *
   * It utilizes the behavior that GLTFLoader adds mesh primitives to the node object ( `THREE.Group` ) first then adds its children.
   *
   * @param gltf A GLTF object taken from GLTFLoader
   * @param nodeIndex The index of the node
   */
  function gltfExtractPrimitivesFromNode(gltf, nodeIndex) {
    return __awaiter(this, void 0, void 0, function* () {
      const node = yield gltf.parser.getDependency("node", nodeIndex);
      return extractPrimitivesInternal(gltf, nodeIndex, node);
    });
  }
  /**
   * Extract primitives ( `THREE.Mesh[]` ) of nodes from a loaded GLTF.
   * See {@link gltfExtractPrimitivesFromNode} for more details.
   *
   * It returns a map from node index to extraction result.
   * If a node does not have a mesh, the entry for the node will not be put in the returning map.
   *
   * @param gltf A GLTF object taken from GLTFLoader
   */
  function gltfExtractPrimitivesFromNodes(gltf) {
    return __awaiter(this, void 0, void 0, function* () {
      const nodes = yield gltf.parser.getDependencies("node");
      const map = new Map();
      nodes.forEach((node, index) => {
        const result = extractPrimitivesInternal(gltf, index, node);
        if (result != null) {
          map.set(index, result);
        }
      });
      return map;
    });
  }

  function renameMaterialProperty(name) {
    if (name[0] !== "_") {
      console.warn(
        `renameMaterialProperty: Given property name "${name}" might be invalid`
      );
      return name;
    }
    name = name.substring(1);
    if (!/[A-Z]/.test(name[0])) {
      console.warn(
        `renameMaterialProperty: Given property name "${name}" might be invalid`
      );
      return name;
    }
    return name[0].toLowerCase() + name.substring(1);
  }

  /**
   * Clamp an input number within [ `0.0` - `1.0` ].
   *
   * @param value The input value
   */
  function saturate(value) {
    return Math.max(Math.min(value, 1.0), 0.0);
  }
  const _position = new THREE.Vector3();
  const _scale = new THREE.Vector3();
  new THREE.Quaternion();
  /**
   * Extract world rotation of an object from its world space matrix, in cheaper way.
   *
   * @param object The object
   * @param out Target vector
   */
  function getWorldQuaternionLite(object, out) {
    object.matrixWorld.decompose(_position, out, _scale);
    return out;
  }

  class VRMBlendShapeProxy {
    /**
     * Create a new VRMBlendShape.
     */
    constructor() {
      /**
       * List of registered blend shape.
       */
      this._blendShapeGroups = {};
      /**
       * A map from [[VRMSchema.BlendShapePresetName]] to its actual blend shape name.
       */
      this._blendShapePresetMap = {};
      /**
       * A list of name of unknown blend shapes.
       */
      this._unknownGroupNames = [];
      // do nothing
    }
    /**
     * List of name of registered blend shape group.
     */
    get expressions() {
      return Object.keys(this._blendShapeGroups);
    }
    /**
     * A map from [[VRMSchema.BlendShapePresetName]] to its actual blend shape name.
     */
    get blendShapePresetMap() {
      return this._blendShapePresetMap;
    }
    /**
     * A list of name of unknown blend shapes.
     */
    get unknownGroupNames() {
      return this._unknownGroupNames;
    }
    /**
     * Return registered blend shape group.
     *
     * @param name Name of the blend shape group
     */
    getBlendShapeGroup(name) {
      const presetName = this._blendShapePresetMap[name];
      const controller = presetName
        ? this._blendShapeGroups[presetName]
        : this._blendShapeGroups[name];
      if (!controller) {
        console.warn(`no blend shape found by ${name}`);
        return undefined;
      }
      return controller;
    }
    /**
     * Register a blend shape group.
     *
     * @param name Name of the blend shape gorup
     * @param controller VRMBlendShapeController that describes the blend shape group
     */
    registerBlendShapeGroup(name, presetName, controller) {
      this._blendShapeGroups[name] = controller;
      if (presetName) {
        this._blendShapePresetMap[presetName] = name;
      } else {
        this._unknownGroupNames.push(name);
      }
    }
    /**
     * Get current weight of specified blend shape group.
     *
     * @param name Name of the blend shape group
     */
    getValue(name) {
      var _a;
      const controller = this.getBlendShapeGroup(name);
      return (_a =
        controller === null || controller === void 0
          ? void 0
          : controller.weight) !== null && _a !== void 0
        ? _a
        : null;
    }
    /**
     * Set a weight to specified blend shape group.
     *
     * @param name Name of the blend shape group
     * @param weight Weight
     */
    setValue(name, weight) {
      const controller = this.getBlendShapeGroup(name);
      if (controller) {
        controller.weight = saturate(weight);
      }
    }
    /**
     * Get a track name of specified blend shape group.
     * This track name is needed to manipulate its blend shape group via keyframe animations.
     *
     * @example Manipulate a blend shape group using keyframe animation
     * ```js
     * const trackName = vrm.blendShapeProxy.getBlendShapeTrackName( THREE.VRMSchema.BlendShapePresetName.Blink );
     * const track = new THREE.NumberKeyframeTrack(
     *   name,
     *   [ 0.0, 0.5, 1.0 ], // times
     *   [ 0.0, 1.0, 0.0 ] // values
     * );
     *
     * const clip = new THREE.AnimationClip(
     *   'blink', // name
     *   1.0, // duration
     *   [ track ] // tracks
     * );
     *
     * const mixer = new THREE.AnimationMixer( vrm.scene );
     * const action = mixer.clipAction( clip );
     * action.play();
     * ```
     *
     * @param name Name of the blend shape group
     */
    getBlendShapeTrackName(name) {
      const controller = this.getBlendShapeGroup(name);
      return controller ? `${controller.name}.weight` : null;
    }
    /**
     * Update every blend shape groups.
     */
    update() {
      Object.keys(this._blendShapeGroups).forEach((name) => {
        const controller = this._blendShapeGroups[name];
        controller.clearAppliedWeight();
      });
      Object.keys(this._blendShapeGroups).forEach((name) => {
        const controller = this._blendShapeGroups[name];
        controller.applyWeight();
      });
    }
  }

  /**
   * An importer that imports a [[VRMBlendShape]] from a VRM extension of a GLTF.
   */
  class VRMBlendShapeImporter {
    /**
     * Import a [[VRMBlendShape]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
      var _a;
      return __awaiter(this, void 0, void 0, function* () {
        const vrmExt =
          (_a = gltf.parser.json.extensions) === null || _a === void 0
            ? void 0
            : _a.VRM;
        if (!vrmExt) {
          return null;
        }
        const schemaBlendShape = vrmExt.blendShapeMaster;
        if (!schemaBlendShape) {
          return null;
        }
        const blendShape = new VRMBlendShapeProxy();
        const blendShapeGroups = schemaBlendShape.blendShapeGroups;
        if (!blendShapeGroups) {
          return blendShape;
        }
        const blendShapePresetMap = {};
        yield Promise.all(
          blendShapeGroups.map((schemaGroup) =>
            __awaiter(this, void 0, void 0, function* () {
              const name = schemaGroup.name;
              if (name === undefined) {
                console.warn(
                  "VRMBlendShapeImporter: One of blendShapeGroups has no name"
                );
                return;
              }
              let presetName;
              if (
                schemaGroup.presetName &&
                schemaGroup.presetName !==
                  exports.VRMSchema.BlendShapePresetName.Unknown &&
                !blendShapePresetMap[schemaGroup.presetName]
              ) {
                presetName = schemaGroup.presetName;
                blendShapePresetMap[schemaGroup.presetName] = name;
              }
              const group = new VRMBlendShapeGroup(name);
              gltf.scene.add(group);
              group.isBinary = schemaGroup.isBinary || false;
              if (schemaGroup.binds) {
                schemaGroup.binds.forEach((bind) =>
                  __awaiter(this, void 0, void 0, function* () {
                    if (bind.mesh === undefined || bind.index === undefined) {
                      return;
                    }
                    const nodesUsingMesh = [];
                    gltf.parser.json.nodes.forEach((node, i) => {
                      if (node.mesh === bind.mesh) {
                        nodesUsingMesh.push(i);
                      }
                    });
                    const morphTargetIndex = bind.index;
                    yield Promise.all(
                      nodesUsingMesh.map((nodeIndex) =>
                        __awaiter(this, void 0, void 0, function* () {
                          var _b;
                          const primitives =
                            yield gltfExtractPrimitivesFromNode(
                              gltf,
                              nodeIndex
                            );
                          // check if the mesh has the target morph target
                          if (
                            !primitives.every(
                              (primitive) =>
                                Array.isArray(
                                  primitive.morphTargetInfluences
                                ) &&
                                morphTargetIndex <
                                  primitive.morphTargetInfluences.length
                            )
                          ) {
                            console.warn(
                              `VRMBlendShapeImporter: ${schemaGroup.name} attempts to index ${morphTargetIndex}th morph but not found.`
                            );
                            return;
                          }
                          group.addBind({
                            meshes: primitives,
                            morphTargetIndex,
                            weight:
                              (_b = bind.weight) !== null && _b !== void 0
                                ? _b
                                : 100,
                          });
                        })
                      )
                    );
                  })
                );
              }
              const materialValues = schemaGroup.materialValues;
              if (materialValues) {
                materialValues.forEach((materialValue) => {
                  if (
                    materialValue.materialName === undefined ||
                    materialValue.propertyName === undefined ||
                    materialValue.targetValue === undefined
                  ) {
                    return;
                  }
                  const materials = [];
                  gltf.scene.traverse((object) => {
                    if (object.material) {
                      const material = object.material;
                      if (Array.isArray(material)) {
                        materials.push(
                          ...material.filter(
                            (mtl) =>
                              mtl.name === materialValue.materialName &&
                              materials.indexOf(mtl) === -1
                          )
                        );
                      } else if (
                        material.name === materialValue.materialName &&
                        materials.indexOf(material) === -1
                      ) {
                        materials.push(material);
                      }
                    }
                  });
                  materials.forEach((material) => {
                    group.addMaterialValue({
                      material,
                      propertyName: renameMaterialProperty(
                        materialValue.propertyName
                      ),
                      targetValue: materialValue.targetValue,
                    });
                  });
                });
              }
              blendShape.registerBlendShapeGroup(name, presetName, group);
            })
          )
        );
        return blendShape;
      });
    }
  }

  const VECTOR3_FRONT = Object.freeze(new THREE.Vector3(0.0, 0.0, -1.0));
  const _quat = new THREE.Quaternion();
  var FirstPersonFlag;
  (function (FirstPersonFlag) {
    FirstPersonFlag[(FirstPersonFlag["Auto"] = 0)] = "Auto";
    FirstPersonFlag[(FirstPersonFlag["Both"] = 1)] = "Both";
    FirstPersonFlag[(FirstPersonFlag["ThirdPersonOnly"] = 2)] =
      "ThirdPersonOnly";
    FirstPersonFlag[(FirstPersonFlag["FirstPersonOnly"] = 3)] =
      "FirstPersonOnly";
  })(FirstPersonFlag || (FirstPersonFlag = {}));
  /**
   * This class represents a single [`meshAnnotation`](https://github.com/vrm-c/UniVRM/blob/master/specification/0.0/schema/vrm.firstperson.meshannotation.schema.json) entry.
   * Each mesh will be assigned to specified layer when you call [[VRMFirstPerson.setup]].
   */
  class VRMRendererFirstPersonFlags {
    /**
     * Create a new mesh annotation.
     *
     * @param firstPersonFlag A [[FirstPersonFlag]] of the annotation entry
     * @param node A node of the annotation entry.
     */
    constructor(firstPersonFlag, primitives) {
      this.firstPersonFlag =
        VRMRendererFirstPersonFlags._parseFirstPersonFlag(firstPersonFlag);
      this.primitives = primitives;
    }
    static _parseFirstPersonFlag(firstPersonFlag) {
      switch (firstPersonFlag) {
        case "Both":
          return FirstPersonFlag.Both;
        case "ThirdPersonOnly":
          return FirstPersonFlag.ThirdPersonOnly;
        case "FirstPersonOnly":
          return FirstPersonFlag.FirstPersonOnly;
        default:
          return FirstPersonFlag.Auto;
      }
    }
  }
  class VRMFirstPerson {
    /**
     * Create a new VRMFirstPerson object.
     *
     * @param firstPersonBone A first person bone
     * @param firstPersonBoneOffset An offset from the specified first person bone
     * @param meshAnnotations A renderer settings. See the description of [[RendererFirstPersonFlags]] for more info
     */
    constructor(firstPersonBone, firstPersonBoneOffset, meshAnnotations) {
      this._meshAnnotations = [];
      this._firstPersonOnlyLayer =
        VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER;
      this._thirdPersonOnlyLayer =
        VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER;
      this._initialized = false;
      this._firstPersonBone = firstPersonBone;
      this._firstPersonBoneOffset = firstPersonBoneOffset;
      this._meshAnnotations = meshAnnotations;
    }
    get firstPersonBone() {
      return this._firstPersonBone;
    }
    get meshAnnotations() {
      return this._meshAnnotations;
    }
    getFirstPersonWorldDirection(target) {
      return target
        .copy(VECTOR3_FRONT)
        .applyQuaternion(getWorldQuaternionLite(this._firstPersonBone, _quat));
    }
    /**
     * A camera layer represents `FirstPersonOnly` layer.
     * Note that **you must call [[setup]] first before you use the layer feature** or it does not work properly.
     *
     * The value is [[DEFAULT_FIRSTPERSON_ONLY_LAYER]] by default but you can change the layer by specifying via [[setup]] if you prefer.
     *
     * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
     * @see https://threejs.org/docs/#api/en/core/Layers
     */
    get firstPersonOnlyLayer() {
      return this._firstPersonOnlyLayer;
    }
    /**
     * A camera layer represents `ThirdPersonOnly` layer.
     * Note that **you must call [[setup]] first before you use the layer feature** or it does not work properly.
     *
     * The value is [[DEFAULT_THIRDPERSON_ONLY_LAYER]] by default but you can change the layer by specifying via [[setup]] if you prefer.
     *
     * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
     * @see https://threejs.org/docs/#api/en/core/Layers
     */
    get thirdPersonOnlyLayer() {
      return this._thirdPersonOnlyLayer;
    }
    getFirstPersonBoneOffset(target) {
      return target.copy(this._firstPersonBoneOffset);
    }
    /**
     * Get current world position of the first person.
     * The position takes [[FirstPersonBone]] and [[FirstPersonOffset]] into account.
     *
     * @param v3 target
     * @returns Current world position of the first person
     */
    getFirstPersonWorldPosition(v3) {
      // UniVRM#VRMFirstPersonEditor
      // var worldOffset = head.localToWorldMatrix.MultiplyPoint(component.FirstPersonOffset);
      const offset = this._firstPersonBoneOffset;
      const v4 = new THREE.Vector4(offset.x, offset.y, offset.z, 1.0);
      v4.applyMatrix4(this._firstPersonBone.matrixWorld);
      return v3.set(v4.x, v4.y, v4.z);
    }
    /**
     * In this method, it assigns layers for every meshes based on mesh annotations.
     * You must call this method first before you use the layer feature.
     *
     * This is an equivalent of [VRMFirstPerson.Setup](https://github.com/vrm-c/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/FirstPerson/VRMFirstPerson.cs) of the UniVRM.
     *
     * The `cameraLayer` parameter specifies which layer will be assigned for `FirstPersonOnly` / `ThirdPersonOnly`.
     * In UniVRM, we specified those by naming each desired layer as `FIRSTPERSON_ONLY_LAYER` / `THIRDPERSON_ONLY_LAYER`
     * but we are going to specify these layers at here since we are unable to name layers in Three.js.
     *
     * @param cameraLayer Specify which layer will be for `FirstPersonOnly` / `ThirdPersonOnly`.
     */
    setup({
      firstPersonOnlyLayer = VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER,
      thirdPersonOnlyLayer = VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER,
    } = {}) {
      if (this._initialized) {
        return;
      }
      this._initialized = true;
      this._firstPersonOnlyLayer = firstPersonOnlyLayer;
      this._thirdPersonOnlyLayer = thirdPersonOnlyLayer;
      this._meshAnnotations.forEach((item) => {
        if (item.firstPersonFlag === FirstPersonFlag.FirstPersonOnly) {
          item.primitives.forEach((primitive) => {
            primitive.layers.set(this._firstPersonOnlyLayer);
          });
        } else if (item.firstPersonFlag === FirstPersonFlag.ThirdPersonOnly) {
          item.primitives.forEach((primitive) => {
            primitive.layers.set(this._thirdPersonOnlyLayer);
          });
        } else if (item.firstPersonFlag === FirstPersonFlag.Auto) {
          this._createHeadlessModel(item.primitives);
        }
      });
    }
    _excludeTriangles(triangles, bws, skinIndex, exclude) {
      let count = 0;
      if (bws != null && bws.length > 0) {
        for (let i = 0; i < triangles.length; i += 3) {
          const a = triangles[i];
          const b = triangles[i + 1];
          const c = triangles[i + 2];
          const bw0 = bws[a];
          const skin0 = skinIndex[a];
          if (bw0[0] > 0 && exclude.includes(skin0[0])) continue;
          if (bw0[1] > 0 && exclude.includes(skin0[1])) continue;
          if (bw0[2] > 0 && exclude.includes(skin0[2])) continue;
          if (bw0[3] > 0 && exclude.includes(skin0[3])) continue;
          const bw1 = bws[b];
          const skin1 = skinIndex[b];
          if (bw1[0] > 0 && exclude.includes(skin1[0])) continue;
          if (bw1[1] > 0 && exclude.includes(skin1[1])) continue;
          if (bw1[2] > 0 && exclude.includes(skin1[2])) continue;
          if (bw1[3] > 0 && exclude.includes(skin1[3])) continue;
          const bw2 = bws[c];
          const skin2 = skinIndex[c];
          if (bw2[0] > 0 && exclude.includes(skin2[0])) continue;
          if (bw2[1] > 0 && exclude.includes(skin2[1])) continue;
          if (bw2[2] > 0 && exclude.includes(skin2[2])) continue;
          if (bw2[3] > 0 && exclude.includes(skin2[3])) continue;
          triangles[count++] = a;
          triangles[count++] = b;
          triangles[count++] = c;
        }
      }
      return count;
    }
    _createErasedMesh(src, erasingBonesIndex) {
      const dst = new THREE.SkinnedMesh(src.geometry.clone(), src.material);
      dst.name = `${src.name}(erase)`;
      dst.frustumCulled = src.frustumCulled;
      dst.layers.set(this._firstPersonOnlyLayer);
      const geometry = dst.geometry;
      const skinIndexAttr = geometry.getAttribute("skinIndex").array;
      const skinIndex = [];
      for (let i = 0; i < skinIndexAttr.length; i += 4) {
        skinIndex.push([
          skinIndexAttr[i],
          skinIndexAttr[i + 1],
          skinIndexAttr[i + 2],
          skinIndexAttr[i + 3],
        ]);
      }
      const skinWeightAttr = geometry.getAttribute("skinWeight").array;
      const skinWeight = [];
      for (let i = 0; i < skinWeightAttr.length; i += 4) {
        skinWeight.push([
          skinWeightAttr[i],
          skinWeightAttr[i + 1],
          skinWeightAttr[i + 2],
          skinWeightAttr[i + 3],
        ]);
      }
      const index = geometry.getIndex();
      if (!index) {
        throw new Error("The geometry doesn't have an index buffer");
      }
      const oldTriangles = Array.from(index.array);
      const count = this._excludeTriangles(
        oldTriangles,
        skinWeight,
        skinIndex,
        erasingBonesIndex
      );
      const newTriangle = [];
      for (let i = 0; i < count; i++) {
        newTriangle[i] = oldTriangles[i];
      }
      geometry.setIndex(newTriangle);
      // mtoon material includes onBeforeRender. this is unsupported at SkinnedMesh#clone
      if (src.onBeforeRender) {
        dst.onBeforeRender = src.onBeforeRender;
      }
      dst.bind(
        new THREE.Skeleton(src.skeleton.bones, src.skeleton.boneInverses),
        new THREE.Matrix4()
      );
      return dst;
    }
    _createHeadlessModelForSkinnedMesh(parent, mesh) {
      const eraseBoneIndexes = [];
      mesh.skeleton.bones.forEach((bone, index) => {
        if (this._isEraseTarget(bone)) eraseBoneIndexes.push(index);
      });
      // Unlike UniVRM we don't copy mesh if no invisible bone was found
      if (!eraseBoneIndexes.length) {
        mesh.layers.enable(this._thirdPersonOnlyLayer);
        mesh.layers.enable(this._firstPersonOnlyLayer);
        return;
      }
      mesh.layers.set(this._thirdPersonOnlyLayer);
      const newMesh = this._createErasedMesh(mesh, eraseBoneIndexes);
      parent.add(newMesh);
    }
    _createHeadlessModel(primitives) {
      primitives.forEach((primitive) => {
        if (primitive.type === "SkinnedMesh") {
          const skinnedMesh = primitive;
          this._createHeadlessModelForSkinnedMesh(
            skinnedMesh.parent,
            skinnedMesh
          );
        } else {
          if (this._isEraseTarget(primitive)) {
            primitive.layers.set(this._thirdPersonOnlyLayer);
          }
        }
      });
    }
    /**
     * It just checks whether the node or its parent is the first person bone or not.
     * @param bone The target bone
     */
    _isEraseTarget(bone) {
      if (bone === this._firstPersonBone) {
        return true;
      } else if (!bone.parent) {
        return false;
      } else {
        return this._isEraseTarget(bone.parent);
      }
    }
  }
  /**
   * A default camera layer for `FirstPersonOnly` layer.
   *
   * @see [[getFirstPersonOnlyLayer]]
   */
  VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER = 9;
  /**
   * A default camera layer for `ThirdPersonOnly` layer.
   *
   * @see [[getThirdPersonOnlyLayer]]
   */
  VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER = 10;

  /**
   * An importer that imports a [[VRMFirstPerson]] from a VRM extension of a GLTF.
   */
  class VRMFirstPersonImporter {
    /**
     * Import a [[VRMFirstPerson]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param humanoid A [[VRMHumanoid]] instance that represents the VRM
     */
    import(gltf, humanoid) {
      var _a;
      return __awaiter(this, void 0, void 0, function* () {
        const vrmExt =
          (_a = gltf.parser.json.extensions) === null || _a === void 0
            ? void 0
            : _a.VRM;
        if (!vrmExt) {
          return null;
        }
        const schemaFirstPerson = vrmExt.firstPerson;
        if (!schemaFirstPerson) {
          return null;
        }
        const firstPersonBoneIndex = schemaFirstPerson.firstPersonBone;
        let firstPersonBone;
        if (firstPersonBoneIndex === undefined || firstPersonBoneIndex === -1) {
          firstPersonBone = humanoid.getBoneNode(
            exports.VRMSchema.HumanoidBoneName.Head
          );
        } else {
          firstPersonBone = yield gltf.parser.getDependency(
            "node",
            firstPersonBoneIndex
          );
        }
        if (!firstPersonBone) {
          console.warn(
            "VRMFirstPersonImporter: Could not find firstPersonBone of the VRM"
          );
          return null;
        }
        const firstPersonBoneOffset = schemaFirstPerson.firstPersonBoneOffset
          ? new THREE.Vector3(
              schemaFirstPerson.firstPersonBoneOffset.x,
              schemaFirstPerson.firstPersonBoneOffset.y,
              -schemaFirstPerson.firstPersonBoneOffset.z
            )
          : new THREE.Vector3(0.0, 0.06, 0.0); // fallback, taken from UniVRM implementation
        const meshAnnotations = [];
        const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
        Array.from(nodePrimitivesMap.entries()).forEach(
          ([nodeIndex, primitives]) => {
            const schemaNode = gltf.parser.json.nodes[nodeIndex];
            const flag = schemaFirstPerson.meshAnnotations
              ? schemaFirstPerson.meshAnnotations.find(
                  (a) => a.mesh === schemaNode.mesh
                )
              : undefined;
            meshAnnotations.push(
              new VRMRendererFirstPersonFlags(
                flag === null || flag === void 0
                  ? void 0
                  : flag.firstPersonFlag,
                primitives
              )
            );
          }
        );
        return new VRMFirstPerson(
          firstPersonBone,
          firstPersonBoneOffset,
          meshAnnotations
        );
      });
    }
  }

  /**
   * A class represents a single `humanBone` of a VRM.
   */
  class VRMHumanBone {
    /**
     * Create a new VRMHumanBone.
     *
     * @param node A [[GLTFNode]] that represents the new bone
     * @param humanLimit A [[VRMHumanLimit]] object that represents properties of the new bone
     */
    constructor(node, humanLimit) {
      this.node = node;
      this.humanLimit = humanLimit;
    }
  }

  /**
   * A compat function for `Quaternion.invert()` / `Quaternion.inverse()`.
   * `Quaternion.invert()` is introduced in r123 and `Quaternion.inverse()` emits a warning.
   * We are going to use this compat for a while.
   * @param target A target quaternion
   */
  function quatInvertCompat(target) {
    if (target.invert) {
      target.invert();
    } else {
      target.inverse();
    }
    return target;
  }

  const _v3A = new THREE.Vector3();
  const _quatA = new THREE.Quaternion();
  /**
   * A class represents humanoid of a VRM.
   */
  class VRMHumanoid {
    /**
     * Create a new [[VRMHumanoid]].
     * @param boneArray A [[VRMHumanBoneArray]] contains all the bones of the new humanoid
     * @param humanDescription A [[VRMHumanDescription]] that represents properties of the new humanoid
     */
    constructor(boneArray, humanDescription) {
      /**
       * A [[VRMPose]] that is its default state.
       * Note that it's not compatible with `setPose` and `getPose`, since it contains non-relative values of each local transforms.
       */
      this.restPose = {};
      this.humanBones = this._createHumanBones(boneArray);
      this.humanDescription = humanDescription;
      this.restPose = this.getPose();
    }
    /**
     * Return the current pose of this humanoid as a [[VRMPose]].
     *
     * Each transform is a local transform relative from rest pose (T-pose).
     */
    getPose() {
      const pose = {};
      Object.keys(this.humanBones).forEach((vrmBoneName) => {
        const node = this.getBoneNode(vrmBoneName);
        // Ignore when there are no bone on the VRMHumanoid
        if (!node) {
          return;
        }
        // When there are two or more bones in a same name, we are not going to overwrite existing one
        if (pose[vrmBoneName]) {
          return;
        }
        // Take a diff from restPose
        // note that restPose also will use getPose to initialize itself
        _v3A.set(0, 0, 0);
        _quatA.identity();
        const restState = this.restPose[vrmBoneName];
        if (
          restState === null || restState === void 0
            ? void 0
            : restState.position
        ) {
          _v3A.fromArray(restState.position).negate();
        }
        if (
          restState === null || restState === void 0
            ? void 0
            : restState.rotation
        ) {
          quatInvertCompat(_quatA.fromArray(restState.rotation));
        }
        // Get the position / rotation from the node
        _v3A.add(node.position);
        _quatA.premultiply(node.quaternion);
        pose[vrmBoneName] = {
          position: _v3A.toArray(),
          rotation: _quatA.toArray(),
        };
      }, {});
      return pose;
    }
    /**
     * Let the humanoid do a specified pose.
     *
     * Each transform have to be a local transform relative from rest pose (T-pose).
     * You can pass what you got from {@link getPose}.
     *
     * @param poseObject A [[VRMPose]] that represents a single pose
     */
    setPose(poseObject) {
      Object.keys(poseObject).forEach((boneName) => {
        const state = poseObject[boneName];
        const node = this.getBoneNode(boneName);
        // Ignore when there are no bone that is defined in the pose on the VRMHumanoid
        if (!node) {
          return;
        }
        const restState = this.restPose[boneName];
        if (!restState) {
          return;
        }
        if (state.position) {
          node.position.fromArray(state.position);
          if (restState.position) {
            node.position.add(_v3A.fromArray(restState.position));
          }
        }
        if (state.rotation) {
          node.quaternion.fromArray(state.rotation);
          if (restState.rotation) {
            node.quaternion.multiply(_quatA.fromArray(restState.rotation));
          }
        }
      });
    }
    /**
     * Reset the humanoid to its rest pose.
     */
    resetPose() {
      Object.entries(this.restPose).forEach(([boneName, rest]) => {
        const node = this.getBoneNode(boneName);
        if (!node) {
          return;
        }
        if (rest === null || rest === void 0 ? void 0 : rest.position) {
          node.position.fromArray(rest.position);
        }
        if (rest === null || rest === void 0 ? void 0 : rest.rotation) {
          node.quaternion.fromArray(rest.rotation);
        }
      });
    }
    /**
     * Return a bone bound to a specified [[HumanBone]], as a [[VRMHumanBone]].
     *
     * See also: [[VRMHumanoid.getBones]]
     *
     * @param name Name of the bone you want
     */
    getBone(name) {
      var _a;
      return (_a = this.humanBones[name][0]) !== null && _a !== void 0
        ? _a
        : undefined;
    }
    /**
     * Return bones bound to a specified [[HumanBone]], as an array of [[VRMHumanBone]].
     * If there are no bones bound to the specified HumanBone, it will return an empty array.
     *
     * See also: [[VRMHumanoid.getBone]]
     *
     * @param name Name of the bone you want
     */
    getBones(name) {
      var _a;
      return (_a = this.humanBones[name]) !== null && _a !== void 0 ? _a : [];
    }
    /**
     * Return a bone bound to a specified [[HumanBone]], as a THREE.Object3D.
     *
     * See also: [[VRMHumanoid.getBoneNodes]]
     *
     * @param name Name of the bone you want
     */
    getBoneNode(name) {
      var _a, _b;
      return (_b =
        (_a = this.humanBones[name][0]) === null || _a === void 0
          ? void 0
          : _a.node) !== null && _b !== void 0
        ? _b
        : null;
    }
    /**
     * Return bones bound to a specified [[HumanBone]], as an array of THREE.Object3D.
     * If there are no bones bound to the specified HumanBone, it will return an empty array.
     *
     * See also: [[VRMHumanoid.getBoneNode]]
     *
     * @param name Name of the bone you want
     */
    getBoneNodes(name) {
      var _a, _b;
      return (_b =
        (_a = this.humanBones[name]) === null || _a === void 0
          ? void 0
          : _a.map((bone) => bone.node)) !== null && _b !== void 0
        ? _b
        : [];
    }
    /**
     * Prepare a [[VRMHumanBones]] from a [[VRMHumanBoneArray]].
     */
    _createHumanBones(boneArray) {
      const bones = Object.values(exports.VRMSchema.HumanoidBoneName).reduce(
        (accum, name) => {
          accum[name] = [];
          return accum;
        },
        {}
      );
      boneArray.forEach((bone) => {
        bones[bone.name].push(bone.bone);
      });
      return bones;
    }
  }

  /**
   * An importer that imports a [[VRMHumanoid]] from a VRM extension of a GLTF.
   */
  class VRMHumanoidImporter {
    /**
     * Import a [[VRMHumanoid]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
      var _a;
      return __awaiter(this, void 0, void 0, function* () {
        const vrmExt =
          (_a = gltf.parser.json.extensions) === null || _a === void 0
            ? void 0
            : _a.VRM;
        if (!vrmExt) {
          return null;
        }
        const schemaHumanoid = vrmExt.humanoid;
        if (!schemaHumanoid) {
          return null;
        }
        const humanBoneArray = [];
        if (schemaHumanoid.humanBones) {
          yield Promise.all(
            schemaHumanoid.humanBones.map((bone) =>
              __awaiter(this, void 0, void 0, function* () {
                if (!bone.bone || bone.node == null) {
                  return;
                }
                const node = yield gltf.parser.getDependency("node", bone.node);
                humanBoneArray.push({
                  name: bone.bone,
                  bone: new VRMHumanBone(node, {
                    axisLength: bone.axisLength,
                    center:
                      bone.center &&
                      new THREE.Vector3(
                        bone.center.x,
                        bone.center.y,
                        bone.center.z
                      ),
                    max:
                      bone.max &&
                      new THREE.Vector3(bone.max.x, bone.max.y, bone.max.z),
                    min:
                      bone.min &&
                      new THREE.Vector3(bone.min.x, bone.min.y, bone.min.z),
                    useDefaultValues: bone.useDefaultValues,
                  }),
                });
              })
            )
          );
        }
        const humanDescription = {
          armStretch: schemaHumanoid.armStretch,
          legStretch: schemaHumanoid.legStretch,
          upperArmTwist: schemaHumanoid.upperArmTwist,
          lowerArmTwist: schemaHumanoid.lowerArmTwist,
          upperLegTwist: schemaHumanoid.upperLegTwist,
          lowerLegTwist: schemaHumanoid.lowerLegTwist,
          feetSpacing: schemaHumanoid.feetSpacing,
          hasTranslationDoF: schemaHumanoid.hasTranslationDoF,
        };
        return new VRMHumanoid(humanBoneArray, humanDescription);
      });
    }
  }

  /**
   * Evaluate a hermite spline.
   *
   * @param y0 y on start
   * @param y1 y on end
   * @param t0 delta y on start
   * @param t1 delta y on end
   * @param x input value
   */
  const hermiteSpline = (y0, y1, t0, t1, x) => {
    const xc = x * x * x;
    const xs = x * x;
    const dy = y1 - y0;
    const h01 = -2.0 * xc + 3.0 * xs;
    const h10 = xc - 2.0 * xs + x;
    const h11 = xc - xs;
    return y0 + dy * h01 + t0 * h10 + t1 * h11;
  };
  /**
   * Evaluate an AnimationCurve array. See AnimationCurve class of Unity for its details.
   *
   * See: https://docs.unity3d.com/ja/current/ScriptReference/AnimationCurve.html
   *
   * @param arr An array represents a curve
   * @param x An input value
   */
  const evaluateCurve = (arr, x) => {
    // -- sanity check -----------------------------------------------------------
    if (arr.length < 8) {
      throw new Error(
        "evaluateCurve: Invalid curve detected! (Array length must be 8 at least)"
      );
    }
    if (arr.length % 4 !== 0) {
      throw new Error(
        "evaluateCurve: Invalid curve detected! (Array length must be multiples of 4"
      );
    }
    // -- check range ------------------------------------------------------------
    let outNode;
    for (outNode = 0; ; outNode++) {
      if (arr.length <= 4 * outNode) {
        return arr[4 * outNode - 3]; // too further!! assume as "Clamp"
      } else if (x <= arr[4 * outNode]) {
        break;
      }
    }
    const inNode = outNode - 1;
    if (inNode < 0) {
      return arr[4 * inNode + 5]; // too behind!! assume as "Clamp"
    }
    // -- calculate local x ------------------------------------------------------
    const x0 = arr[4 * inNode];
    const x1 = arr[4 * outNode];
    const xHermite = (x - x0) / (x1 - x0);
    // -- finally do the hermite spline ------------------------------------------
    const y0 = arr[4 * inNode + 1];
    const y1 = arr[4 * outNode + 1];
    const t0 = arr[4 * inNode + 3];
    const t1 = arr[4 * outNode + 2];
    return hermiteSpline(y0, y1, t0, t1, xHermite);
  };
  /**
   * This is an equivalent of CurveMapper class defined in UniVRM.
   * Will be used for [[VRMLookAtApplyer]]s, to define behavior of LookAt.
   *
   * See: https://github.com/vrm-c/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/LookAt/CurveMapper.cs
   */
  class VRMCurveMapper {
    /**
     * Create a new [[VRMCurveMapper]].
     *
     * @param xRange The maximum input range
     * @param yRange The maximum output value
     * @param curve An array represents the curve
     */
    constructor(xRange, yRange, curve) {
      /**
       * An array represents the curve. See AnimationCurve class of Unity for its details.
       *
       * See: https://docs.unity3d.com/ja/current/ScriptReference/AnimationCurve.html
       */
      this.curve = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0];
      /**
       * The maximum input range of the [[VRMCurveMapper]].
       */
      this.curveXRangeDegree = 90.0;
      /**
       * The maximum output value of the [[VRMCurveMapper]].
       */
      this.curveYRangeDegree = 10.0;
      if (xRange !== undefined) {
        this.curveXRangeDegree = xRange;
      }
      if (yRange !== undefined) {
        this.curveYRangeDegree = yRange;
      }
      if (curve !== undefined) {
        this.curve = curve;
      }
    }
    /**
     * Evaluate an input value and output a mapped value.
     *
     * @param src The input value
     */
    map(src) {
      const clampedSrc = Math.min(Math.max(src, 0.0), this.curveXRangeDegree);
      const x = clampedSrc / this.curveXRangeDegree;
      return this.curveYRangeDegree * evaluateCurve(this.curve, x);
    }
  }

  /**
   * This class is used by [[VRMLookAtHead]], applies look at direction.
   * There are currently two variant of applier: [[VRMLookAtBoneApplyer]] and [[VRMLookAtBlendShapeApplyer]].
   */
  class VRMLookAtApplyer {}

  /**
   * This class is used by [[VRMLookAtHead]], applies look at direction to eye blend shapes of a VRM.
   */
  class VRMLookAtBlendShapeApplyer extends VRMLookAtApplyer {
    /**
     * Create a new VRMLookAtBlendShapeApplyer.
     *
     * @param blendShapeProxy A [[VRMBlendShapeProxy]] used by this applier
     * @param curveHorizontal A [[VRMCurveMapper]] used for transverse direction
     * @param curveVerticalDown A [[VRMCurveMapper]] used for down direction
     * @param curveVerticalUp A [[VRMCurveMapper]] used for up direction
     */
    constructor(
      blendShapeProxy,
      curveHorizontal,
      curveVerticalDown,
      curveVerticalUp
    ) {
      super();
      this.type = exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape;
      this._curveHorizontal = curveHorizontal;
      this._curveVerticalDown = curveVerticalDown;
      this._curveVerticalUp = curveVerticalUp;
      this._blendShapeProxy = blendShapeProxy;
    }
    name() {
      return exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape;
    }
    lookAt(euler) {
      const srcX = euler.x;
      const srcY = euler.y;
      if (srcX < 0.0) {
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookup,
          0.0
        );
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookdown,
          this._curveVerticalDown.map(-srcX)
        );
      } else {
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookdown,
          0.0
        );
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookup,
          this._curveVerticalUp.map(srcX)
        );
      }
      if (srcY < 0.0) {
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookleft,
          0.0
        );
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookright,
          this._curveHorizontal.map(-srcY)
        );
      } else {
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookright,
          0.0
        );
        this._blendShapeProxy.setValue(
          exports.VRMSchema.BlendShapePresetName.Lookleft,
          this._curveHorizontal.map(srcY)
        );
      }
    }
  }

  const VECTOR3_FRONT$1 = Object.freeze(new THREE.Vector3(0.0, 0.0, -1.0));
  const _v3A$1 = new THREE.Vector3();
  const _v3B = new THREE.Vector3();
  const _v3C = new THREE.Vector3();
  const _quat$1 = new THREE.Quaternion();
  /**
   * A class represents look at of a VRM.
   */
  class VRMLookAtHead {
    /**
     * Create a new VRMLookAtHead.
     *
     * @param firstPerson A [[VRMFirstPerson]] that will be associated with this new VRMLookAtHead
     * @param applyer A [[VRMLookAtApplyer]] that will be associated with this new VRMLookAtHead
     */
    constructor(firstPerson, applyer) {
      /**
       * If this is true, its look at direction will be updated automatically by calling [[VRMLookAtHead.update]] (which is called from [[VRM.update]]).
       *
       * See also: [[VRMLookAtHead.target]]
       */
      this.autoUpdate = true;
      this._euler = new THREE.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
      this.firstPerson = firstPerson;
      this.applyer = applyer;
    }
    /**
     * Get its look at direction in world coordinate.
     *
     * @param target A target `THREE.Vector3`
     */
    getLookAtWorldDirection(target) {
      const rot = getWorldQuaternionLite(
        this.firstPerson.firstPersonBone,
        _quat$1
      );
      return target
        .copy(VECTOR3_FRONT$1)
        .applyEuler(this._euler)
        .applyQuaternion(rot);
    }
    /**
     * Set its look at position.
     * Note that its result will be instantly overwritten if [[VRMLookAtHead.autoUpdate]] is enabled.
     *
     * @param position A target position
     */
    lookAt(position) {
      this._calcEuler(this._euler, position);
      if (this.applyer) {
        this.applyer.lookAt(this._euler);
      }
    }
    /**
     * Update the VRMLookAtHead.
     * If [[VRMLookAtHead.autoUpdate]] is disabled, it will do nothing.
     *
     * @param delta deltaTime
     */
    update(delta) {
      if (this.target && this.autoUpdate) {
        this.lookAt(this.target.getWorldPosition(_v3A$1));
        if (this.applyer) {
          this.applyer.lookAt(this._euler);
        }
      }
    }
    _calcEuler(target, position) {
      const headPosition = this.firstPerson.getFirstPersonWorldPosition(_v3B);
      // Look at direction in world coordinate
      const lookAtDir = _v3C.copy(position).sub(headPosition).normalize();
      // Transform the direction into local coordinate from the first person bone
      lookAtDir.applyQuaternion(
        quatInvertCompat(
          getWorldQuaternionLite(this.firstPerson.firstPersonBone, _quat$1)
        )
      );
      // convert the direction into euler
      target.x = Math.atan2(
        lookAtDir.y,
        Math.sqrt(lookAtDir.x * lookAtDir.x + lookAtDir.z * lookAtDir.z)
      );
      target.y = Math.atan2(-lookAtDir.x, -lookAtDir.z);
      return target;
    }
  }
  VRMLookAtHead.EULER_ORDER = "YXZ"; // yaw-pitch-roll

  const _euler = new THREE.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
  /**
   * This class is used by [[VRMLookAtHead]], applies look at direction to eye bones of a VRM.
   */
  class VRMLookAtBoneApplyer extends VRMLookAtApplyer {
    /**
     * Create a new VRMLookAtBoneApplyer.
     *
     * @param humanoid A [[VRMHumanoid]] used by this applier
     * @param curveHorizontalInner A [[VRMCurveMapper]] used for inner transverse direction
     * @param curveHorizontalOuter A [[VRMCurveMapper]] used for outer transverse direction
     * @param curveVerticalDown A [[VRMCurveMapper]] used for down direction
     * @param curveVerticalUp A [[VRMCurveMapper]] used for up direction
     */
    constructor(
      humanoid,
      curveHorizontalInner,
      curveHorizontalOuter,
      curveVerticalDown,
      curveVerticalUp
    ) {
      super();
      this.type = exports.VRMSchema.FirstPersonLookAtTypeName.Bone;
      this._curveHorizontalInner = curveHorizontalInner;
      this._curveHorizontalOuter = curveHorizontalOuter;
      this._curveVerticalDown = curveVerticalDown;
      this._curveVerticalUp = curveVerticalUp;
      this._leftEye = humanoid.getBoneNode(
        exports.VRMSchema.HumanoidBoneName.LeftEye
      );
      this._rightEye = humanoid.getBoneNode(
        exports.VRMSchema.HumanoidBoneName.RightEye
      );
    }
    lookAt(euler) {
      const srcX = euler.x;
      const srcY = euler.y;
      // left
      if (this._leftEye) {
        if (srcX < 0.0) {
          _euler.x = -this._curveVerticalDown.map(-srcX);
        } else {
          _euler.x = this._curveVerticalUp.map(srcX);
        }
        if (srcY < 0.0) {
          _euler.y = -this._curveHorizontalInner.map(-srcY);
        } else {
          _euler.y = this._curveHorizontalOuter.map(srcY);
        }
        this._leftEye.quaternion.setFromEuler(_euler);
      }
      // right
      if (this._rightEye) {
        if (srcX < 0.0) {
          _euler.x = -this._curveVerticalDown.map(-srcX);
        } else {
          _euler.x = this._curveVerticalUp.map(srcX);
        }
        if (srcY < 0.0) {
          _euler.y = -this._curveHorizontalOuter.map(-srcY);
        } else {
          _euler.y = this._curveHorizontalInner.map(srcY);
        }
        this._rightEye.quaternion.setFromEuler(_euler);
      }
    }
  }

  // THREE.Math has been renamed to THREE.MathUtils since r113.
  // We are going to define the DEG2RAD by ourselves for a while
  // https://github.com/mrdoob/three.js/pull/18270
  const DEG2RAD = Math.PI / 180; // THREE.MathUtils.DEG2RAD;
  /**
   * An importer that imports a [[VRMLookAtHead]] from a VRM extension of a GLTF.
   */
  class VRMLookAtImporter {
    /**
     * Import a [[VRMLookAtHead]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param blendShapeProxy A [[VRMBlendShapeProxy]] instance that represents the VRM
     * @param humanoid A [[VRMHumanoid]] instance that represents the VRM
     */
    import(gltf, firstPerson, blendShapeProxy, humanoid) {
      var _a;
      const vrmExt =
        (_a = gltf.parser.json.extensions) === null || _a === void 0
          ? void 0
          : _a.VRM;
      if (!vrmExt) {
        return null;
      }
      const schemaFirstPerson = vrmExt.firstPerson;
      if (!schemaFirstPerson) {
        return null;
      }
      const applyer = this._importApplyer(
        schemaFirstPerson,
        blendShapeProxy,
        humanoid
      );
      return new VRMLookAtHead(firstPerson, applyer || undefined);
    }
    _importApplyer(schemaFirstPerson, blendShapeProxy, humanoid) {
      const lookAtHorizontalInner = schemaFirstPerson.lookAtHorizontalInner;
      const lookAtHorizontalOuter = schemaFirstPerson.lookAtHorizontalOuter;
      const lookAtVerticalDown = schemaFirstPerson.lookAtVerticalDown;
      const lookAtVerticalUp = schemaFirstPerson.lookAtVerticalUp;
      switch (schemaFirstPerson.lookAtTypeName) {
        case exports.VRMSchema.FirstPersonLookAtTypeName.Bone: {
          if (
            lookAtHorizontalInner === undefined ||
            lookAtHorizontalOuter === undefined ||
            lookAtVerticalDown === undefined ||
            lookAtVerticalUp === undefined
          ) {
            return null;
          } else {
            return new VRMLookAtBoneApplyer(
              humanoid,
              this._importCurveMapperBone(lookAtHorizontalInner),
              this._importCurveMapperBone(lookAtHorizontalOuter),
              this._importCurveMapperBone(lookAtVerticalDown),
              this._importCurveMapperBone(lookAtVerticalUp)
            );
          }
        }
        case exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape: {
          if (
            lookAtHorizontalOuter === undefined ||
            lookAtVerticalDown === undefined ||
            lookAtVerticalUp === undefined
          ) {
            return null;
          } else {
            return new VRMLookAtBlendShapeApplyer(
              blendShapeProxy,
              this._importCurveMapperBlendShape(lookAtHorizontalOuter),
              this._importCurveMapperBlendShape(lookAtVerticalDown),
              this._importCurveMapperBlendShape(lookAtVerticalUp)
            );
          }
        }
        default: {
          return null;
        }
      }
    }
    _importCurveMapperBone(map) {
      return new VRMCurveMapper(
        typeof map.xRange === "number" ? DEG2RAD * map.xRange : undefined,
        typeof map.yRange === "number" ? DEG2RAD * map.yRange : undefined,
        map.curve
      );
    }
    _importCurveMapperBlendShape(map) {
      return new VRMCurveMapper(
        typeof map.xRange === "number" ? DEG2RAD * map.xRange : undefined,
        map.yRange,
        map.curve
      );
    }
  }

  const getEncodingComponents = (encoding) => {
    switch (encoding) {
      case THREE.LinearEncoding:
        return ["Linear", "( value )"];
      case THREE.sRGBEncoding:
        return ["sRGB", "( value )"];
      case THREE.RGBEEncoding:
        return ["RGBE", "( value )"];
      case THREE.RGBM7Encoding:
        return ["RGBM", "( value, 7.0 )"];
      case THREE.RGBM16Encoding:
        return ["RGBM", "( value, 16.0 )"];
      case THREE.RGBDEncoding:
        return ["RGBD", "( value, 256.0 )"];
      case THREE.GammaEncoding:
        return ["Gamma", "( value, float( GAMMA_FACTOR ) )"];
      default:
        throw new Error("unsupported encoding: " + encoding);
    }
  };
  const getTexelDecodingFunction = (functionName, encoding) => {
    const components = getEncodingComponents(encoding);
    return (
      "vec4 " +
      functionName +
      "( vec4 value ) { return " +
      components[0] +
      "ToLinear" +
      components[1] +
      "; }"
    );
  };

  var vertexShader =
    "// #define PHONG\n\nvarying vec3 vViewPosition;\n\n#ifndef FLAT_SHADED\n  varying vec3 vNormal;\n#endif\n\n#include <common>\n\n// #include <uv_pars_vertex>\n#ifdef MTOON_USE_UV\n  #ifdef MTOON_UVS_VERTEX_ONLY\n    vec2 vUv;\n  #else\n    varying vec2 vUv;\n  #endif\n\n  uniform vec4 mainTex_ST;\n#endif\n\n#include <uv2_pars_vertex>\n// #include <displacementmap_pars_vertex>\n// #include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\n#ifdef USE_OUTLINEWIDTHTEXTURE\n  uniform sampler2D outlineWidthTexture;\n#endif\n\nuniform float outlineWidth;\nuniform float outlineScaledMaxDistance;\n\nvoid main() {\n\n  // #include <uv_vertex>\n  #ifdef MTOON_USE_UV\n    vUv = uv;\n    vUv.y = 1.0 - vUv.y; // uv.y is opposite from UniVRM's\n    vUv = mainTex_ST.st + mainTex_ST.pq * vUv;\n    vUv.y = 1.0 - vUv.y; // reverting the previous flip\n  #endif\n\n  #include <uv2_vertex>\n  #include <color_vertex>\n\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinbase_vertex>\n  #include <skinnormal_vertex>\n\n  // we need this to compute the outline properly\n  objectNormal = normalize( objectNormal );\n\n  #include <defaultnormal_vertex>\n\n  #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED\n    vNormal = normalize( transformedNormal );\n  #endif\n\n  #include <begin_vertex>\n\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  // #include <displacementmap_vertex>\n  #include <project_vertex>\n  #include <logdepthbuf_vertex>\n  #include <clipping_planes_vertex>\n\n  vViewPosition = - mvPosition.xyz;\n\n  float outlineTex = 1.0;\n\n  #ifdef OUTLINE\n    #ifdef USE_OUTLINEWIDTHTEXTURE\n      outlineTex = texture2D( outlineWidthTexture, vUv ).r;\n    #endif\n\n    #ifdef OUTLINE_WIDTH_WORLD\n      float worldNormalLength = length( transformedNormal );\n      vec3 outlineOffset = 0.01 * outlineWidth * outlineTex * worldNormalLength * objectNormal;\n      gl_Position = projectionMatrix * modelViewMatrix * vec4( outlineOffset + transformed, 1.0 );\n    #endif\n\n    #ifdef OUTLINE_WIDTH_SCREEN\n      vec3 clipNormal = ( projectionMatrix * modelViewMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n      vec2 projectedNormal = normalize( clipNormal.xy );\n      projectedNormal *= min( gl_Position.w, outlineScaledMaxDistance );\n      projectedNormal.x *= projectionMatrix[ 0 ].x / projectionMatrix[ 1 ].y;\n      gl_Position.xy += 0.01 * outlineWidth * outlineTex * projectedNormal.xy;\n    #endif\n\n    gl_Position.z += 1E-6 * gl_Position.w; // anti-artifact magic\n  #endif\n\n  #include <worldpos_vertex>\n  // #include <envmap_vertex>\n  #include <shadowmap_vertex>\n  #include <fog_vertex>\n\n}";

  var fragmentShader =
    '// #define PHONG\n\n#ifdef BLENDMODE_CUTOUT\n  uniform float cutoff;\n#endif\n\nuniform vec3 color;\nuniform float colorAlpha;\nuniform vec3 shadeColor;\n#ifdef USE_SHADETEXTURE\n  uniform sampler2D shadeTexture;\n#endif\n\nuniform float receiveShadowRate;\n#ifdef USE_RECEIVESHADOWTEXTURE\n  uniform sampler2D receiveShadowTexture;\n#endif\n\nuniform float shadingGradeRate;\n#ifdef USE_SHADINGGRADETEXTURE\n  uniform sampler2D shadingGradeTexture;\n#endif\n\nuniform float shadeShift;\nuniform float shadeToony;\nuniform float lightColorAttenuation;\nuniform float indirectLightIntensity;\n\n#ifdef USE_RIMTEXTURE\n  uniform sampler2D rimTexture;\n#endif\nuniform vec3 rimColor;\nuniform float rimLightingMix;\nuniform float rimFresnelPower;\nuniform float rimLift;\n\n#ifdef USE_SPHEREADD\n  uniform sampler2D sphereAdd;\n#endif\n\nuniform vec3 emissionColor;\n\nuniform vec3 outlineColor;\nuniform float outlineLightingMix;\n\n#ifdef USE_UVANIMMASKTEXTURE\n  uniform sampler2D uvAnimMaskTexture;\n#endif\n\nuniform float uvAnimOffsetX;\nuniform float uvAnimOffsetY;\nuniform float uvAnimTheta;\n\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n\n// #include <uv_pars_fragment>\n#if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n  varying vec2 vUv;\n#endif\n\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n// #include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n// #include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n// #include <envmap_common_pars_fragment>\n// #include <envmap_pars_fragment>\n// #include <cube_uv_reflection_fragment>\n#include <fog_pars_fragment>\n#include <bsdfs>\n#include <lights_pars_begin>\n\n// #include <lights_phong_pars_fragment>\nvarying vec3 vViewPosition;\n\n#ifndef FLAT_SHADED\n  varying vec3 vNormal;\n#endif\n\nstruct MToonMaterial {\n  vec3 diffuseColor;\n  vec3 shadeColor;\n  float shadingGrade;\n  float receiveShadow;\n};\n\n#define Material_LightProbeLOD( material ) (0)\n\n#include <shadowmap_pars_fragment>\n// #include <bumpmap_pars_fragment>\n\n// #include <normalmap_pars_fragment>\n#ifdef USE_NORMALMAP\n\n  uniform sampler2D normalMap;\n  uniform vec2 normalScale;\n\n#endif\n\n#ifdef OBJECTSPACE_NORMALMAP\n\n  uniform mat3 normalMatrix;\n\n#endif\n\n#if ! defined ( USE_TANGENT ) && defined ( TANGENTSPACE_NORMALMAP )\n\n  // Per-Pixel Tangent Space Normal Mapping\n  // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html\n\n  // three-vrm specific change: it requires `uv` as an input in order to support uv scrolls\n\n  // Temporary compat against shader change @ Three.js r126\n  // See: #21205, #21307, #21299\n  #ifdef THREE_VRM_THREE_REVISION_126\n\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {\n\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      vec3 N = normalize( surf_norm );\n\n      vec3 q1perp = cross( q1, N );\n      vec3 q0perp = cross( N, q0 );\n\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\n\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\n      // TODO: Is this still required? Or shall I make a PR about it?\n      if ( length( T ) == 0.0 || length( B ) == 0.0 ) {\n        return surf_norm;\n      }\n\n      float det = max( dot( T, T ), dot( B, B ) );\n      float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );\n\n      return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );\n\n    }\n\n  #else\n\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN ) {\n\n      // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988\n\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      float scale = sign( st1.t * st0.s - st0.t * st1.s ); // we do not care about the magnitude\n\n      vec3 S = ( q0 * st1.t - q1 * st0.t ) * scale;\n      vec3 T = ( - q0 * st1.s + q1 * st0.s ) * scale;\n\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\n      // TODO: Is this still required? Or shall I make a PR about it?\n\n      if ( length( S ) == 0.0 || length( T ) == 0.0 ) {\n        return surf_norm;\n      }\n\n      S = normalize( S );\n      T = normalize( T );\n      vec3 N = normalize( surf_norm );\n\n      #ifdef DOUBLE_SIDED\n\n        // Workaround for Adreno GPUs gl_FrontFacing bug. See #15850 and #10331\n\n        bool frontFacing = dot( cross( S, T ), N ) > 0.0;\n\n        mapN.xy *= ( float( frontFacing ) * 2.0 - 1.0 );\n\n      #else\n\n        mapN.xy *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );\n\n      #endif\n\n      mat3 tsn = mat3( S, T, N );\n      return normalize( tsn * mapN );\n\n    }\n\n  #endif\n\n#endif\n\n// #include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\n// == lighting stuff ===========================================================\nfloat getLightIntensity(\n  const in IncidentLight directLight,\n  const in GeometricContext geometry,\n  const in float shadow,\n  const in float shadingGrade\n) {\n  float lightIntensity = dot( geometry.normal, directLight.direction );\n  lightIntensity = 0.5 + 0.5 * lightIntensity;\n  lightIntensity = lightIntensity * shadow;\n  lightIntensity = lightIntensity * shadingGrade;\n  lightIntensity = lightIntensity * 2.0 - 1.0;\n  return shadeToony == 1.0\n    ? step( shadeShift, lightIntensity )\n    : smoothstep( shadeShift, shadeShift + ( 1.0 - shadeToony ), lightIntensity );\n}\n\nvec3 getLighting( const in vec3 lightColor ) {\n  vec3 lighting = lightColor;\n  lighting = mix(\n    lighting,\n    vec3( max( 0.001, max( lighting.x, max( lighting.y, lighting.z ) ) ) ),\n    lightColorAttenuation\n  );\n\n  #ifndef PHYSICALLY_CORRECT_LIGHTS\n    lighting *= PI;\n  #endif\n\n  return lighting;\n}\n\nvec3 getDiffuse(\n  const in MToonMaterial material,\n  const in float lightIntensity,\n  const in vec3 lighting\n) {\n  #ifdef DEBUG_LITSHADERATE\n    return vec3( BRDF_Diffuse_Lambert( lightIntensity * lighting ) );\n  #endif\n\n  return lighting * BRDF_Diffuse_Lambert( mix( material.shadeColor, material.diffuseColor, lightIntensity ) );\n}\n\n// == post correction ==========================================================\nvoid postCorrection() {\n  #include <tonemapping_fragment>\n  #include <encodings_fragment>\n  #include <fog_fragment>\n  #include <premultiplied_alpha_fragment>\n  #include <dithering_fragment>\n}\n\n// == main procedure ===========================================================\nvoid main() {\n  #include <clipping_planes_fragment>\n\n  vec2 uv = vec2(0.5, 0.5);\n\n  #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n    uv = vUv;\n\n    float uvAnimMask = 1.0;\n    #ifdef USE_UVANIMMASKTEXTURE\n      uvAnimMask = texture2D( uvAnimMaskTexture, uv ).x;\n    #endif\n\n    uv = uv + vec2( uvAnimOffsetX, uvAnimOffsetY ) * uvAnimMask;\n    float uvRotCos = cos( uvAnimTheta * uvAnimMask );\n    float uvRotSin = sin( uvAnimTheta * uvAnimMask );\n    uv = mat2( uvRotCos, uvRotSin, -uvRotSin, uvRotCos ) * ( uv - 0.5 ) + 0.5;\n  #endif\n\n  #ifdef DEBUG_UV\n    gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n    #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n      gl_FragColor = vec4( uv, 0.0, 1.0 );\n    #endif\n    return;\n  #endif\n\n  vec4 diffuseColor = vec4( color, colorAlpha );\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n  vec3 totalEmissiveRadiance = emissionColor;\n\n  #include <logdepthbuf_fragment>\n\n  // #include <map_fragment>\n  #ifdef USE_MAP\n    diffuseColor *= mapTexelToLinear( texture2D( map, uv ) );\n  #endif\n\n  #include <color_fragment>\n  // #include <alphamap_fragment>\n\n  // -- MToon: alpha -----------------------------------------------------------\n  // #include <alphatest_fragment>\n  #ifdef BLENDMODE_CUTOUT\n    if ( diffuseColor.a <= cutoff ) { discard; }\n    diffuseColor.a = 1.0;\n  #endif\n\n  #ifdef BLENDMODE_OPAQUE\n    diffuseColor.a = 1.0;\n  #endif\n\n  #if defined( OUTLINE ) && defined( OUTLINE_COLOR_FIXED ) // omitting DebugMode\n    gl_FragColor = vec4( outlineColor, diffuseColor.a );\n    postCorrection();\n    return;\n  #endif\n\n  // #include <specularmap_fragment>\n  #include <normal_fragment_begin>\n\n  #ifdef OUTLINE\n    normal *= -1.0;\n  #endif\n\n  // #include <normal_fragment_maps>\n\n  #ifdef OBJECTSPACE_NORMALMAP\n\n    normal = texture2D( normalMap, uv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals\n\n    #ifdef FLIP_SIDED\n\n      normal = - normal;\n\n    #endif\n\n    #ifdef DOUBLE_SIDED\n\n      // Temporary compat against shader change @ Three.js r126\n      // See: #21205, #21307, #21299\n      #ifdef THREE_VRM_THREE_REVISION_126\n\n        normal = normal * faceDirection;\n\n      #else\n\n        normal = normal * ( float( gl_FrontFacing ) * 2.0 - 1.0 );\n\n      #endif\n\n    #endif\n\n    normal = normalize( normalMatrix * normal );\n\n  #elif defined( TANGENTSPACE_NORMALMAP )\n\n    vec3 mapN = texture2D( normalMap, uv ).xyz * 2.0 - 1.0;\n    mapN.xy *= normalScale;\n\n    #ifdef USE_TANGENT\n\n      normal = normalize( vTBN * mapN );\n\n    #else\n\n      // Temporary compat against shader change @ Three.js r126\n      // See: #21205, #21307, #21299\n      #ifdef THREE_VRM_THREE_REVISION_126\n\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN, faceDirection );\n\n      #else\n\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN );\n\n      #endif\n\n    #endif\n\n  #endif\n\n  // #include <emissivemap_fragment>\n  #ifdef USE_EMISSIVEMAP\n    totalEmissiveRadiance *= emissiveMapTexelToLinear( texture2D( emissiveMap, uv ) ).rgb;\n  #endif\n\n  #ifdef DEBUG_NORMAL\n    gl_FragColor = vec4( 0.5 + 0.5 * normal, 1.0 );\n    return;\n  #endif\n\n  // -- MToon: lighting --------------------------------------------------------\n  // accumulation\n  // #include <lights_phong_fragment>\n  MToonMaterial material;\n\n  material.diffuseColor = diffuseColor.rgb;\n\n  material.shadeColor = shadeColor;\n  #ifdef USE_SHADETEXTURE\n    material.shadeColor *= shadeTextureTexelToLinear( texture2D( shadeTexture, uv ) ).rgb;\n  #endif\n\n  material.shadingGrade = 1.0;\n  #ifdef USE_SHADINGGRADETEXTURE\n    material.shadingGrade = 1.0 - shadingGradeRate * ( 1.0 - texture2D( shadingGradeTexture, uv ).r );\n  #endif\n\n  material.receiveShadow = receiveShadowRate;\n  #ifdef USE_RECEIVESHADOWTEXTURE\n    material.receiveShadow *= texture2D( receiveShadowTexture, uv ).a;\n  #endif\n\n  // #include <lights_fragment_begin>\n  GeometricContext geometry;\n\n  geometry.position = - vViewPosition;\n  geometry.normal = normal;\n  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n\n  IncidentLight directLight;\n  vec3 lightingSum = vec3( 0.0 );\n\n  #if ( NUM_POINT_LIGHTS > 0 )\n    PointLight pointLight;\n\n    #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n    PointLightShadow pointLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n      pointLight = pointLights[ i ];\n      getPointDirectLightIrradiance( pointLight, geometry, directLight );\n\n      float atten = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n      pointLightShadow = pointLightShadows[ i ];\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n      #endif\n\n      float shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\n      float lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\n      vec3 lighting = getLighting( directLight.color );\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\n      lightingSum += lighting;\n    }\n    #pragma unroll_loop_end\n  #endif\n\n  #if ( NUM_SPOT_LIGHTS > 0 )\n    SpotLight spotLight;\n\n    #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n    SpotLightShadow spotLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n      spotLight = spotLights[ i ];\n      getSpotDirectLightIrradiance( spotLight, geometry, directLight );\n\n      float atten = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n      spotLightShadow = spotLightShadows[ i ];\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n      #endif\n\n      float shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\n      float lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\n      vec3 lighting = getLighting( directLight.color );\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\n      lightingSum += lighting;\n    }\n    #pragma unroll_loop_end\n  #endif\n\n  #if ( NUM_DIR_LIGHTS > 0 )\n    DirectionalLight directionalLight;\n\n    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n    DirectionalLightShadow directionalLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n      directionalLight = directionalLights[ i ];\n      getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\n      float atten = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n      directionalLightShadow = directionalLightShadows[ i ];\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n      #endif\n\n      float shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\n      float lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\n      vec3 lighting = getLighting( directLight.color );\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\n      lightingSum += lighting;\n    }\n    #pragma unroll_loop_end\n  #endif\n\n  // #if defined( RE_IndirectDiffuse )\n  vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n  irradiance += getLightProbeIrradiance( lightProbe, geometry );\n  #if ( NUM_HEMI_LIGHTS > 0 )\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n      irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\n    }\n    #pragma unroll_loop_end\n  #endif\n  // #endif\n\n  // #include <lights_fragment_maps>\n  #ifdef USE_LIGHTMAP\n    vec4 lightMapTexel = texture2D( lightMap, vUv2 );\n    vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;\n    #ifndef PHYSICALLY_CORRECT_LIGHTS\n      lightMapIrradiance *= PI;\n    #endif\n    irradiance += lightMapIrradiance;\n  #endif\n\n  // #include <lights_fragment_end>\n  // RE_IndirectDiffuse here\n  reflectedLight.indirectDiffuse += indirectLightIntensity * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );\n\n  // modulation\n  #include <aomap_fragment>\n\n  vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n\n  // The "comment out if you want to PBR absolutely" line\n  #ifndef DEBUG_LITSHADERATE\n    col = min(col, material.diffuseColor);\n  #endif\n\n  #if defined( OUTLINE ) && defined( OUTLINE_COLOR_MIXED )\n    gl_FragColor = vec4(\n      outlineColor.rgb * mix( vec3( 1.0 ), col, outlineLightingMix ),\n      diffuseColor.a\n    );\n    postCorrection();\n    return;\n  #endif\n\n  #ifdef DEBUG_LITSHADERATE\n    gl_FragColor = vec4( col, diffuseColor.a );\n    postCorrection();\n    return;\n  #endif\n\n  // -- MToon: parametric rim lighting -----------------------------------------\n  vec3 viewDir = normalize( vViewPosition );\n  vec3 rimMix = mix( vec3( 1.0 ), lightingSum + indirectLightIntensity * irradiance, rimLightingMix );\n  vec3 rim = rimColor * pow( saturate( 1.0 - dot( viewDir, normal ) + rimLift ), rimFresnelPower );\n  #ifdef USE_RIMTEXTURE\n    rim *= rimTextureTexelToLinear( texture2D( rimTexture, uv ) ).rgb;\n  #endif\n  col += rim;\n\n  // -- MToon: additive matcap -------------------------------------------------\n  #ifdef USE_SPHEREADD\n    {\n      vec3 x = normalize( vec3( viewDir.z, 0.0, -viewDir.x ) );\n      vec3 y = cross( viewDir, x ); // guaranteed to be normalized\n      vec2 sphereUv = 0.5 + 0.5 * vec2( dot( x, normal ), -dot( y, normal ) );\n      vec3 matcap = sphereAddTexelToLinear( texture2D( sphereAdd, sphereUv ) ).xyz;\n      col += matcap;\n    }\n  #endif\n\n  // -- MToon: Emission --------------------------------------------------------\n  col += totalEmissiveRadiance;\n\n  // #include <envmap_fragment>\n\n  // -- Almost done! -----------------------------------------------------------\n  gl_FragColor = vec4( col, diffuseColor.a );\n  postCorrection();\n}';

  /* tslint:disable:member-ordering */
  const TAU = 2.0 * Math.PI;
  (function (MToonMaterialCullMode) {
    MToonMaterialCullMode[(MToonMaterialCullMode["Off"] = 0)] = "Off";
    MToonMaterialCullMode[(MToonMaterialCullMode["Front"] = 1)] = "Front";
    MToonMaterialCullMode[(MToonMaterialCullMode["Back"] = 2)] = "Back";
  })(exports.MToonMaterialCullMode || (exports.MToonMaterialCullMode = {}));
  (function (MToonMaterialDebugMode) {
    MToonMaterialDebugMode[(MToonMaterialDebugMode["None"] = 0)] = "None";
    MToonMaterialDebugMode[(MToonMaterialDebugMode["Normal"] = 1)] = "Normal";
    MToonMaterialDebugMode[(MToonMaterialDebugMode["LitShadeRate"] = 2)] =
      "LitShadeRate";
    MToonMaterialDebugMode[(MToonMaterialDebugMode["UV"] = 3)] = "UV";
  })(exports.MToonMaterialDebugMode || (exports.MToonMaterialDebugMode = {}));
  (function (MToonMaterialOutlineColorMode) {
    MToonMaterialOutlineColorMode[
      (MToonMaterialOutlineColorMode["FixedColor"] = 0)
    ] = "FixedColor";
    MToonMaterialOutlineColorMode[
      (MToonMaterialOutlineColorMode["MixedLighting"] = 1)
    ] = "MixedLighting";
  })(
    exports.MToonMaterialOutlineColorMode ||
      (exports.MToonMaterialOutlineColorMode = {})
  );
  (function (MToonMaterialOutlineWidthMode) {
    MToonMaterialOutlineWidthMode[(MToonMaterialOutlineWidthMode["None"] = 0)] =
      "None";
    MToonMaterialOutlineWidthMode[
      (MToonMaterialOutlineWidthMode["WorldCoordinates"] = 1)
    ] = "WorldCoordinates";
    MToonMaterialOutlineWidthMode[
      (MToonMaterialOutlineWidthMode["ScreenCoordinates"] = 2)
    ] = "ScreenCoordinates";
  })(
    exports.MToonMaterialOutlineWidthMode ||
      (exports.MToonMaterialOutlineWidthMode = {})
  );
  (function (MToonMaterialRenderMode) {
    MToonMaterialRenderMode[(MToonMaterialRenderMode["Opaque"] = 0)] = "Opaque";
    MToonMaterialRenderMode[(MToonMaterialRenderMode["Cutout"] = 1)] = "Cutout";
    MToonMaterialRenderMode[(MToonMaterialRenderMode["Transparent"] = 2)] =
      "Transparent";
    MToonMaterialRenderMode[
      (MToonMaterialRenderMode["TransparentWithZWrite"] = 3)
    ] = "TransparentWithZWrite";
  })(exports.MToonMaterialRenderMode || (exports.MToonMaterialRenderMode = {}));
  /**
   * MToon is a material specification that has various features.
   * The spec and implementation are originally founded for Unity engine and this is a port of the material.
   *
   * See: https://github.com/Santarh/MToon
   */
  class MToonMaterial extends THREE.ShaderMaterial {
    constructor(parameters = {}) {
      super();
      /**
       * Readonly boolean that indicates this is a [[MToonMaterial]].
       */
      this.isMToonMaterial = true;
      this.cutoff = 0.5; // _Cutoff
      this.color = new THREE.Vector4(1.0, 1.0, 1.0, 1.0); // _Color
      this.shadeColor = new THREE.Vector4(0.97, 0.81, 0.86, 1.0); // _ShadeColor
      this.map = null; // _MainTex
      // eslint-disable-next-line @typescript-eslint/naming-convention
      this.mainTex_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
      this.shadeTexture = null; // _ShadeTexture
      // public shadeTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ShadeTexture_ST (unused)
      this.normalMap = null; // _BumpMap. again, THIS IS _BumpMap
      this.normalMapType = THREE.TangentSpaceNormalMap; // Three.js requires this
      this.normalScale = new THREE.Vector2(1.0, 1.0); // _BumpScale, in Vector2
      // public bumpMap_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _BumpMap_ST (unused)
      this.receiveShadowRate = 1.0; // _ReceiveShadowRate
      this.receiveShadowTexture = null; // _ReceiveShadowTexture
      // public receiveShadowTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ReceiveShadowTexture_ST (unused)
      this.shadingGradeRate = 1.0; // _ShadingGradeRate
      this.shadingGradeTexture = null; // _ShadingGradeTexture
      // public shadingGradeTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ShadingGradeTexture_ST (unused)
      this.shadeShift = 0.0; // _ShadeShift
      this.shadeToony = 0.9; // _ShadeToony
      this.lightColorAttenuation = 0.0; // _LightColorAttenuation
      this.indirectLightIntensity = 0.1; // _IndirectLightIntensity
      this.rimTexture = null; // _RimTexture
      this.rimColor = new THREE.Vector4(0.0, 0.0, 0.0, 1.0); // _RimColor
      this.rimLightingMix = 0.0; // _RimLightingMix
      this.rimFresnelPower = 1.0; // _RimFresnelPower
      this.rimLift = 0.0; // _RimLift
      this.sphereAdd = null; // _SphereAdd
      // public sphereAdd_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _SphereAdd_ST (unused)
      this.emissionColor = new THREE.Vector4(0.0, 0.0, 0.0, 1.0); // _EmissionColor
      this.emissiveMap = null; // _EmissionMap
      // public emissionMap_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _EmissionMap_ST (unused)
      this.outlineWidthTexture = null; // _OutlineWidthTexture
      // public outlineWidthTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _OutlineWidthTexture_ST (unused)
      this.outlineWidth = 0.5; // _OutlineWidth
      this.outlineScaledMaxDistance = 1.0; // _OutlineScaledMaxDistance
      this.outlineColor = new THREE.Vector4(0.0, 0.0, 0.0, 1.0); // _OutlineColor
      this.outlineLightingMix = 1.0; // _OutlineLightingMix
      this.uvAnimMaskTexture = null; // _UvAnimMaskTexture
      this.uvAnimScrollX = 0.0; // _UvAnimScrollX
      this.uvAnimScrollY = 0.0; // _UvAnimScrollY
      this.uvAnimRotation = 0.0; // _uvAnimRotation
      this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
      this._debugMode = exports.MToonMaterialDebugMode.None; // _DebugMode
      this._blendMode = exports.MToonMaterialRenderMode.Opaque; // _BlendMode
      this._outlineWidthMode = exports.MToonMaterialOutlineWidthMode.None; // _OutlineWidthMode
      this._outlineColorMode = exports.MToonMaterialOutlineColorMode.FixedColor; // _OutlineColorMode
      this._cullMode = exports.MToonMaterialCullMode.Back; // _CullMode
      this._outlineCullMode = exports.MToonMaterialCullMode.Front; // _OutlineCullMode
      // public srcBlend = 1.0; // _SrcBlend (is not supported)
      // public dstBlend = 0.0; // _DstBlend (is not supported)
      // public zWrite = 1.0; // _ZWrite (will be converted to depthWrite)
      this._isOutline = false;
      this._uvAnimOffsetX = 0.0;
      this._uvAnimOffsetY = 0.0;
      this._uvAnimPhase = 0.0;
      this.encoding = parameters.encoding || THREE.LinearEncoding;
      if (
        this.encoding !== THREE.LinearEncoding &&
        this.encoding !== THREE.sRGBEncoding
      ) {
        console.warn(
          "The specified color encoding does not work properly with MToonMaterial. You might want to use THREE.sRGBEncoding instead."
        );
      }
      // == these parameter has no compatibility with this implementation ========
      [
        "mToonVersion",
        "shadeTexture_ST",
        "bumpMap_ST",
        "receiveShadowTexture_ST",
        "shadingGradeTexture_ST",
        "rimTexture_ST",
        "sphereAdd_ST",
        "emissionMap_ST",
        "outlineWidthTexture_ST",
        "uvAnimMaskTexture_ST",
        "srcBlend",
        "dstBlend",
      ].forEach((key) => {
        if (parameters[key] !== undefined) {
          // console.warn(`THREE.${this.type}: The parameter "${key}" is not supported.`);
          delete parameters[key];
        }
      });
      // == enabling bunch of stuff ==============================================
      parameters.fog = true;
      parameters.lights = true;
      parameters.clipping = true;
      parameters.skinning = parameters.skinning || false;
      parameters.morphTargets = parameters.morphTargets || false;
      parameters.morphNormals = parameters.morphNormals || false;
      // == uniforms =============================================================
      parameters.uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.common,
        THREE.UniformsLib.normalmap,
        THREE.UniformsLib.emissivemap,
        THREE.UniformsLib.fog,
        THREE.UniformsLib.lights,
        {
          cutoff: { value: 0.5 },
          color: { value: new THREE.Color(1.0, 1.0, 1.0) },
          colorAlpha: { value: 1.0 },
          shadeColor: { value: new THREE.Color(0.97, 0.81, 0.86) },
          // eslint-disable-next-line @typescript-eslint/naming-convention
          mainTex_ST: { value: new THREE.Vector4(0.0, 0.0, 1.0, 1.0) },
          shadeTexture: { value: null },
          receiveShadowRate: { value: 1.0 },
          receiveShadowTexture: { value: null },
          shadingGradeRate: { value: 1.0 },
          shadingGradeTexture: { value: null },
          shadeShift: { value: 0.0 },
          shadeToony: { value: 0.9 },
          lightColorAttenuation: { value: 0.0 },
          indirectLightIntensity: { value: 0.1 },
          rimTexture: { value: null },
          rimColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
          rimLightingMix: { value: 0.0 },
          rimFresnelPower: { value: 1.0 },
          rimLift: { value: 0.0 },
          sphereAdd: { value: null },
          emissionColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
          outlineWidthTexture: { value: null },
          outlineWidth: { value: 0.5 },
          outlineScaledMaxDistance: { value: 1.0 },
          outlineColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
          outlineLightingMix: { value: 1.0 },
          uvAnimMaskTexture: { value: null },
          uvAnimOffsetX: { value: 0.0 },
          uvAnimOffsetY: { value: 0.0 },
          uvAnimTheta: { value: 0.0 },
        },
      ]);
      // == finally compile the shader program ===================================
      this.setValues(parameters);
      // == update shader stuff ==================================================
      this._updateShaderCode();
      this._applyUniforms();
    }
    get mainTex() {
      return this.map;
    }
    set mainTex(t) {
      this.map = t;
    }
    get bumpMap() {
      return this.normalMap;
    }
    set bumpMap(t) {
      this.normalMap = t;
    }
    /**
     * Getting the `bumpScale` reutrns its x component of `normalScale` (assuming x and y component of `normalScale` are same).
     */
    get bumpScale() {
      return this.normalScale.x;
    }
    /**
     * Setting the `bumpScale` will be convert the value into Vector2 `normalScale` .
     */
    set bumpScale(t) {
      this.normalScale.set(t, t);
    }
    get emissionMap() {
      return this.emissiveMap;
    }
    set emissionMap(t) {
      this.emissiveMap = t;
    }
    get blendMode() {
      return this._blendMode;
    }
    set blendMode(m) {
      this._blendMode = m;
      this.depthWrite =
        this._blendMode !== exports.MToonMaterialRenderMode.Transparent;
      this.transparent =
        this._blendMode === exports.MToonMaterialRenderMode.Transparent ||
        this._blendMode ===
          exports.MToonMaterialRenderMode.TransparentWithZWrite;
      this._updateShaderCode();
    }
    get debugMode() {
      return this._debugMode;
    }
    set debugMode(m) {
      this._debugMode = m;
      this._updateShaderCode();
    }
    get outlineWidthMode() {
      return this._outlineWidthMode;
    }
    set outlineWidthMode(m) {
      this._outlineWidthMode = m;
      this._updateShaderCode();
    }
    get outlineColorMode() {
      return this._outlineColorMode;
    }
    set outlineColorMode(m) {
      this._outlineColorMode = m;
      this._updateShaderCode();
    }
    get cullMode() {
      return this._cullMode;
    }
    set cullMode(m) {
      this._cullMode = m;
      this._updateCullFace();
    }
    get outlineCullMode() {
      return this._outlineCullMode;
    }
    set outlineCullMode(m) {
      this._outlineCullMode = m;
      this._updateCullFace();
    }
    get zWrite() {
      return this.depthWrite ? 1 : 0;
    }
    set zWrite(i) {
      this.depthWrite = 0.5 <= i;
    }
    get isOutline() {
      return this._isOutline;
    }
    set isOutline(b) {
      this._isOutline = b;
      this._updateShaderCode();
      this._updateCullFace();
    }
    /**
     * Update this material.
     * Usually this will be called via [[VRM.update]] so you don't have to call this manually.
     *
     * @param delta deltaTime since last update
     */
    updateVRMMaterials(delta) {
      this._uvAnimOffsetX = this._uvAnimOffsetX + delta * this.uvAnimScrollX;
      this._uvAnimOffsetY = this._uvAnimOffsetY - delta * this.uvAnimScrollY; // Negative since t axis of uvs are opposite from Unity's one
      this._uvAnimPhase = this._uvAnimPhase + delta * this.uvAnimRotation;
      this._applyUniforms();
    }
    copy(source) {
      super.copy(source);
      // == copy members =========================================================
      this.cutoff = source.cutoff;
      this.color.copy(source.color);
      this.shadeColor.copy(source.shadeColor);
      this.map = source.map;
      this.mainTex_ST.copy(source.mainTex_ST);
      this.shadeTexture = source.shadeTexture;
      this.normalMap = source.normalMap;
      this.normalMapType = source.normalMapType;
      this.normalScale.copy(this.normalScale);
      this.receiveShadowRate = source.receiveShadowRate;
      this.receiveShadowTexture = source.receiveShadowTexture;
      this.shadingGradeRate = source.shadingGradeRate;
      this.shadingGradeTexture = source.shadingGradeTexture;
      this.shadeShift = source.shadeShift;
      this.shadeToony = source.shadeToony;
      this.lightColorAttenuation = source.lightColorAttenuation;
      this.indirectLightIntensity = source.indirectLightIntensity;
      this.rimTexture = source.rimTexture;
      this.rimColor.copy(source.rimColor);
      this.rimLightingMix = source.rimLightingMix;
      this.rimFresnelPower = source.rimFresnelPower;
      this.rimLift = source.rimLift;
      this.sphereAdd = source.sphereAdd;
      this.emissionColor.copy(source.emissionColor);
      this.emissiveMap = source.emissiveMap;
      this.outlineWidthTexture = source.outlineWidthTexture;
      this.outlineWidth = source.outlineWidth;
      this.outlineScaledMaxDistance = source.outlineScaledMaxDistance;
      this.outlineColor.copy(source.outlineColor);
      this.outlineLightingMix = source.outlineLightingMix;
      this.uvAnimMaskTexture = source.uvAnimMaskTexture;
      this.uvAnimScrollX = source.uvAnimScrollX;
      this.uvAnimScrollY = source.uvAnimScrollY;
      this.uvAnimRotation = source.uvAnimRotation;
      this.debugMode = source.debugMode;
      this.blendMode = source.blendMode;
      this.outlineWidthMode = source.outlineWidthMode;
      this.outlineColorMode = source.outlineColorMode;
      this.cullMode = source.cullMode;
      this.outlineCullMode = source.outlineCullMode;
      this.isOutline = source.isOutline;
      return this;
    }
    /**
     * Apply updated uniform variables.
     */
    _applyUniforms() {
      this.uniforms.uvAnimOffsetX.value = this._uvAnimOffsetX;
      this.uniforms.uvAnimOffsetY.value = this._uvAnimOffsetY;
      this.uniforms.uvAnimTheta.value = TAU * this._uvAnimPhase;
      if (!this.shouldApplyUniforms) {
        return;
      }
      this.shouldApplyUniforms = false;
      this.uniforms.cutoff.value = this.cutoff;
      this.uniforms.color.value.setRGB(
        this.color.x,
        this.color.y,
        this.color.z
      );
      this.uniforms.colorAlpha.value = this.color.w;
      this.uniforms.shadeColor.value.setRGB(
        this.shadeColor.x,
        this.shadeColor.y,
        this.shadeColor.z
      );
      this.uniforms.map.value = this.map;
      this.uniforms.mainTex_ST.value.copy(this.mainTex_ST);
      this.uniforms.shadeTexture.value = this.shadeTexture;
      this.uniforms.normalMap.value = this.normalMap;
      this.uniforms.normalScale.value.copy(this.normalScale);
      this.uniforms.receiveShadowRate.value = this.receiveShadowRate;
      this.uniforms.receiveShadowTexture.value = this.receiveShadowTexture;
      this.uniforms.shadingGradeRate.value = this.shadingGradeRate;
      this.uniforms.shadingGradeTexture.value = this.shadingGradeTexture;
      this.uniforms.shadeShift.value = this.shadeShift;
      this.uniforms.shadeToony.value = this.shadeToony;
      this.uniforms.lightColorAttenuation.value = this.lightColorAttenuation;
      this.uniforms.indirectLightIntensity.value = this.indirectLightIntensity;
      this.uniforms.rimTexture.value = this.rimTexture;
      this.uniforms.rimColor.value.setRGB(
        this.rimColor.x,
        this.rimColor.y,
        this.rimColor.z
      );
      this.uniforms.rimLightingMix.value = this.rimLightingMix;
      this.uniforms.rimFresnelPower.value = this.rimFresnelPower;
      this.uniforms.rimLift.value = this.rimLift;
      this.uniforms.sphereAdd.value = this.sphereAdd;
      this.uniforms.emissionColor.value.setRGB(
        this.emissionColor.x,
        this.emissionColor.y,
        this.emissionColor.z
      );
      this.uniforms.emissiveMap.value = this.emissiveMap;
      this.uniforms.outlineWidthTexture.value = this.outlineWidthTexture;
      this.uniforms.outlineWidth.value = this.outlineWidth;
      this.uniforms.outlineScaledMaxDistance.value =
        this.outlineScaledMaxDistance;
      this.uniforms.outlineColor.value.setRGB(
        this.outlineColor.x,
        this.outlineColor.y,
        this.outlineColor.z
      );
      this.uniforms.outlineLightingMix.value = this.outlineLightingMix;
      this.uniforms.uvAnimMaskTexture.value = this.uvAnimMaskTexture;
      // apply color space to uniform colors
      if (this.encoding === THREE.sRGBEncoding) {
        this.uniforms.color.value.convertSRGBToLinear();
        this.uniforms.shadeColor.value.convertSRGBToLinear();
        this.uniforms.rimColor.value.convertSRGBToLinear();
        this.uniforms.emissionColor.value.convertSRGBToLinear();
        this.uniforms.outlineColor.value.convertSRGBToLinear();
      }
      this._updateCullFace();
    }
    _updateShaderCode() {
      const useUvInVert = this.outlineWidthTexture !== null;
      const useUvInFrag =
        this.map !== null ||
        this.shadeTexture !== null ||
        this.receiveShadowTexture !== null ||
        this.shadingGradeTexture !== null ||
        this.rimTexture !== null ||
        this.uvAnimMaskTexture !== null;
      this.defines = {
        // Temporary compat against shader change @ Three.js r126
        // See: #21205, #21307, #21299
        THREE_VRM_THREE_REVISION_126: parseInt(THREE.REVISION) >= 126,
        OUTLINE: this._isOutline,
        BLENDMODE_OPAQUE:
          this._blendMode === exports.MToonMaterialRenderMode.Opaque,
        BLENDMODE_CUTOUT:
          this._blendMode === exports.MToonMaterialRenderMode.Cutout,
        BLENDMODE_TRANSPARENT:
          this._blendMode === exports.MToonMaterialRenderMode.Transparent ||
          this._blendMode ===
            exports.MToonMaterialRenderMode.TransparentWithZWrite,
        MTOON_USE_UV: useUvInVert || useUvInFrag,
        MTOON_UVS_VERTEX_ONLY: useUvInVert && !useUvInFrag,
        USE_SHADETEXTURE: this.shadeTexture !== null,
        USE_RECEIVESHADOWTEXTURE: this.receiveShadowTexture !== null,
        USE_SHADINGGRADETEXTURE: this.shadingGradeTexture !== null,
        USE_RIMTEXTURE: this.rimTexture !== null,
        USE_SPHEREADD: this.sphereAdd !== null,
        USE_OUTLINEWIDTHTEXTURE: this.outlineWidthTexture !== null,
        USE_UVANIMMASKTEXTURE: this.uvAnimMaskTexture !== null,
        DEBUG_NORMAL: this._debugMode === exports.MToonMaterialDebugMode.Normal,
        DEBUG_LITSHADERATE:
          this._debugMode === exports.MToonMaterialDebugMode.LitShadeRate,
        DEBUG_UV: this._debugMode === exports.MToonMaterialDebugMode.UV,
        OUTLINE_WIDTH_WORLD:
          this._outlineWidthMode ===
          exports.MToonMaterialOutlineWidthMode.WorldCoordinates,
        OUTLINE_WIDTH_SCREEN:
          this._outlineWidthMode ===
          exports.MToonMaterialOutlineWidthMode.ScreenCoordinates,
        OUTLINE_COLOR_FIXED:
          this._outlineColorMode ===
          exports.MToonMaterialOutlineColorMode.FixedColor,
        OUTLINE_COLOR_MIXED:
          this._outlineColorMode ===
          exports.MToonMaterialOutlineColorMode.MixedLighting,
      };
      // == texture encodings ====================================================
      const encodings =
        (this.shadeTexture !== null
          ? getTexelDecodingFunction(
              "shadeTextureTexelToLinear",
              this.shadeTexture.encoding
            ) + "\n"
          : "") +
        (this.sphereAdd !== null
          ? getTexelDecodingFunction(
              "sphereAddTexelToLinear",
              this.sphereAdd.encoding
            ) + "\n"
          : "") +
        (this.rimTexture !== null
          ? getTexelDecodingFunction(
              "rimTextureTexelToLinear",
              this.rimTexture.encoding
            ) + "\n"
          : "");
      // == generate shader code =================================================
      this.vertexShader = vertexShader;
      this.fragmentShader = encodings + fragmentShader;
      // == set needsUpdate flag =================================================
      this.needsUpdate = true;
    }
    _updateCullFace() {
      if (!this.isOutline) {
        if (this.cullMode === exports.MToonMaterialCullMode.Off) {
          this.side = THREE.DoubleSide;
        } else if (this.cullMode === exports.MToonMaterialCullMode.Front) {
          this.side = THREE.BackSide;
        } else if (this.cullMode === exports.MToonMaterialCullMode.Back) {
          this.side = THREE.FrontSide;
        }
      } else {
        if (this.outlineCullMode === exports.MToonMaterialCullMode.Off) {
          this.side = THREE.DoubleSide;
        } else if (
          this.outlineCullMode === exports.MToonMaterialCullMode.Front
        ) {
          this.side = THREE.BackSide;
        } else if (
          this.outlineCullMode === exports.MToonMaterialCullMode.Back
        ) {
          this.side = THREE.FrontSide;
        }
      }
    }
  }

  var vertexShader$1 =
    "#include <common>\n\n// #include <uv_pars_vertex>\n#ifdef USE_MAP\n  varying vec2 vUv;\n  uniform vec4 mainTex_ST;\n#endif\n\n#include <uv2_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\nvoid main() {\n\n  // #include <uv_vertex>\n  #ifdef USE_MAP\n    vUv = vec2( mainTex_ST.p * uv.x + mainTex_ST.s, mainTex_ST.q * uv.y + mainTex_ST.t );\n  #endif\n\n  #include <uv2_vertex>\n  #include <color_vertex>\n  #include <skinbase_vertex>\n\n  #ifdef USE_ENVMAP\n\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinnormal_vertex>\n  #include <defaultnormal_vertex>\n\n  #endif\n\n  #include <begin_vertex>\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  #include <project_vertex>\n  #include <logdepthbuf_vertex>\n\n  #include <worldpos_vertex>\n  #include <clipping_planes_vertex>\n  #include <envmap_vertex>\n  #include <fog_vertex>\n\n}";

  var fragmentShader$1 =
    "#ifdef RENDERTYPE_CUTOUT\n  uniform float cutoff;\n#endif\n\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n// #include <alphamap_pars_fragment>\n// #include <aomap_pars_fragment>\n// #include <lightmap_pars_fragment>\n// #include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n// #include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\n// == main procedure ===========================================================\nvoid main() {\n  #include <clipping_planes_fragment>\n\n  vec4 diffuseColor = vec4( 1.0 );\n\n  #include <logdepthbuf_fragment>\n\n  // #include <map_fragment>\n  #ifdef USE_MAP\n    diffuseColor *= mapTexelToLinear( texture2D( map, vUv ) );\n  #endif\n\n  #include <color_fragment>\n  // #include <alphamap_fragment>\n\n  // MToon: alpha\n  // #include <alphatest_fragment>\n  #ifdef RENDERTYPE_CUTOUT\n    if ( diffuseColor.a <= cutoff ) { discard; }\n    diffuseColor.a = 1.0;\n  #endif\n\n  #ifdef RENDERTYPE_OPAQUE\n    diffuseColor.a = 1.0;\n  #endif\n\n  // #include <specularmap_fragment>\n\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\n  // accumulation (baked indirect lighting only)\n  #ifdef USE_LIGHTMAP\n    reflectedLight.indirectDiffuse += texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;\n  #else\n    reflectedLight.indirectDiffuse += vec3( 1.0 );\n  #endif\n\n  // modulation\n  // #include <aomap_fragment>\n\n  reflectedLight.indirectDiffuse *= diffuseColor.rgb;\n  vec3 outgoingLight = reflectedLight.indirectDiffuse;\n\n  // #include <envmap_fragment>\n\n  gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\n  #include <premultiplied_alpha_fragment>\n  #include <tonemapping_fragment>\n  #include <encodings_fragment>\n  #include <fog_fragment>\n}";

  /* tslint:disable:member-ordering */
  (function (VRMUnlitMaterialRenderType) {
    VRMUnlitMaterialRenderType[(VRMUnlitMaterialRenderType["Opaque"] = 0)] =
      "Opaque";
    VRMUnlitMaterialRenderType[(VRMUnlitMaterialRenderType["Cutout"] = 1)] =
      "Cutout";
    VRMUnlitMaterialRenderType[
      (VRMUnlitMaterialRenderType["Transparent"] = 2)
    ] = "Transparent";
    VRMUnlitMaterialRenderType[
      (VRMUnlitMaterialRenderType["TransparentWithZWrite"] = 3)
    ] = "TransparentWithZWrite";
  })(
    exports.VRMUnlitMaterialRenderType ||
      (exports.VRMUnlitMaterialRenderType = {})
  );
  /**
   * This is a material that is an equivalent of "VRM/Unlit***" on VRM spec, those materials are already kinda deprecated though...
   */
  class VRMUnlitMaterial extends THREE.ShaderMaterial {
    constructor(parameters) {
      super();
      /**
       * Readonly boolean that indicates this is a [[VRMUnlitMaterial]].
       */
      this.isVRMUnlitMaterial = true;
      this.cutoff = 0.5;
      this.map = null; // _MainTex
      // eslint-disable-next-line @typescript-eslint/naming-convention
      this.mainTex_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
      this._renderType = exports.VRMUnlitMaterialRenderType.Opaque;
      this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
      if (parameters === undefined) {
        parameters = {};
      }
      // == enabling bunch of stuff ==============================================
      parameters.fog = true;
      parameters.clipping = true;
      parameters.skinning = parameters.skinning || false;
      parameters.morphTargets = parameters.morphTargets || false;
      parameters.morphNormals = parameters.morphNormals || false;
      // == uniforms =============================================================
      parameters.uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.common,
        THREE.UniformsLib.fog,
        {
          cutoff: { value: 0.5 },
          // eslint-disable-next-line @typescript-eslint/naming-convention
          mainTex_ST: { value: new THREE.Vector4(0.0, 0.0, 1.0, 1.0) },
        },
      ]);
      // == finally compile the shader program ===================================
      this.setValues(parameters);
      // == update shader stuff ==================================================
      this._updateShaderCode();
      this._applyUniforms();
    }
    get mainTex() {
      return this.map;
    }
    set mainTex(t) {
      this.map = t;
    }
    get renderType() {
      return this._renderType;
    }
    set renderType(t) {
      this._renderType = t;
      this.depthWrite =
        this._renderType !== exports.VRMUnlitMaterialRenderType.Transparent;
      this.transparent =
        this._renderType === exports.VRMUnlitMaterialRenderType.Transparent ||
        this._renderType ===
          exports.VRMUnlitMaterialRenderType.TransparentWithZWrite;
      this._updateShaderCode();
    }
    /**
     * Update this material.
     * Usually this will be called via [[VRM.update]] so you don't have to call this manually.
     *
     * @param delta deltaTime since last update
     */
    updateVRMMaterials(delta) {
      this._applyUniforms();
    }
    copy(source) {
      super.copy(source);
      // == copy members =========================================================
      this.cutoff = source.cutoff;
      this.map = source.map;
      this.mainTex_ST.copy(source.mainTex_ST);
      this.renderType = source.renderType;
      return this;
    }
    /**
     * Apply updated uniform variables.
     */
    _applyUniforms() {
      if (!this.shouldApplyUniforms) {
        return;
      }
      this.shouldApplyUniforms = false;
      this.uniforms.cutoff.value = this.cutoff;
      this.uniforms.map.value = this.map;
      this.uniforms.mainTex_ST.value.copy(this.mainTex_ST);
    }
    _updateShaderCode() {
      this.defines = {
        RENDERTYPE_OPAQUE:
          this._renderType === exports.VRMUnlitMaterialRenderType.Opaque,
        RENDERTYPE_CUTOUT:
          this._renderType === exports.VRMUnlitMaterialRenderType.Cutout,
        RENDERTYPE_TRANSPARENT:
          this._renderType === exports.VRMUnlitMaterialRenderType.Transparent ||
          this._renderType ===
            exports.VRMUnlitMaterialRenderType.TransparentWithZWrite,
      };
      this.vertexShader = vertexShader$1;
      this.fragmentShader = fragmentShader$1;
      // == set needsUpdate flag =================================================
      this.needsUpdate = true;
    }
  }

  /**
   * An importer that imports VRM materials from a VRM extension of a GLTF.
   */
  class VRMMaterialImporter {
    /**
     * Create a new VRMMaterialImporter.
     *
     * @param options Options of the VRMMaterialImporter
     */
    constructor(options = {}) {
      this._encoding = options.encoding || THREE.LinearEncoding;
      if (
        this._encoding !== THREE.LinearEncoding &&
        this._encoding !== THREE.sRGBEncoding
      ) {
        console.warn(
          "The specified color encoding might not work properly with VRMMaterialImporter. You might want to use THREE.sRGBEncoding instead."
        );
      }
      this._requestEnvMap = options.requestEnvMap;
    }
    /**
     * Convert all the materials of given GLTF based on VRM extension field `materialProperties`.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    convertGLTFMaterials(gltf) {
      var _a;
      return __awaiter(this, void 0, void 0, function* () {
        const vrmExt =
          (_a = gltf.parser.json.extensions) === null || _a === void 0
            ? void 0
            : _a.VRM;
        if (!vrmExt) {
          return null;
        }
        const materialProperties = vrmExt.materialProperties;
        if (!materialProperties) {
          return null;
        }
        const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
        const materialList = {};
        const materials = []; // result
        yield Promise.all(
          Array.from(nodePrimitivesMap.entries()).map(
            ([nodeIndex, primitives]) =>
              __awaiter(this, void 0, void 0, function* () {
                const schemaNode = gltf.parser.json.nodes[nodeIndex];
                const schemaMesh = gltf.parser.json.meshes[schemaNode.mesh];
                yield Promise.all(
                  primitives.map((primitive, primitiveIndex) =>
                    __awaiter(this, void 0, void 0, function* () {
                      const schemaPrimitive =
                        schemaMesh.primitives[primitiveIndex];
                      // some glTF might have both `node.mesh` and `node.children` at once
                      // and GLTFLoader handles both mesh primitives and "children" in glTF as "children" in THREE
                      // It seems GLTFLoader handles primitives first then handles "children" in glTF (it's lucky!)
                      // so we should ignore (primitives.length)th and following children of `mesh.children`
                      // TODO: sanitize this after GLTFLoader plugin system gets introduced : https://github.com/mrdoob/three.js/pull/18421
                      if (!schemaPrimitive) {
                        return;
                      }
                      const primitiveGeometry = primitive.geometry;
                      const primitiveVertices = primitiveGeometry.index
                        ? primitiveGeometry.index.count
                        : primitiveGeometry.attributes.position.count / 3;
                      // if primitives material is not an array, make it an array
                      if (!Array.isArray(primitive.material)) {
                        primitive.material = [primitive.material];
                        primitiveGeometry.addGroup(0, primitiveVertices, 0);
                      }
                      // create / push to cache (or pop from cache) vrm materials
                      const vrmMaterialIndex = schemaPrimitive.material;
                      let props = materialProperties[vrmMaterialIndex];
                      if (!props) {
                        console.warn(
                          `VRMMaterialImporter: There are no material definition for material #${vrmMaterialIndex} on VRM extension.`
                        );
                        props = { shader: "VRM_USE_GLTFSHADER" }; // fallback
                      }
                      let vrmMaterials;
                      if (materialList[vrmMaterialIndex]) {
                        vrmMaterials = materialList[vrmMaterialIndex];
                      } else {
                        vrmMaterials = yield this.createVRMMaterials(
                          primitive.material[0],
                          props,
                          gltf
                        );
                        materialList[vrmMaterialIndex] = vrmMaterials;
                        materials.push(vrmMaterials.surface);
                        if (vrmMaterials.outline) {
                          materials.push(vrmMaterials.outline);
                        }
                      }
                      // surface
                      primitive.material[0] = vrmMaterials.surface;
                      // envmap
                      if (
                        this._requestEnvMap &&
                        vrmMaterials.surface.isMeshStandardMaterial
                      ) {
                        this._requestEnvMap().then((envMap) => {
                          vrmMaterials.surface.envMap = envMap;
                          vrmMaterials.surface.needsUpdate = true;
                        });
                      }
                      // render order
                      primitive.renderOrder = props.renderQueue || 2000;
                      // outline ("2 pass shading using groups" trick here)
                      if (vrmMaterials.outline) {
                        primitive.material[1] = vrmMaterials.outline;
                        primitiveGeometry.addGroup(0, primitiveVertices, 1);
                      }
                    })
                  )
                );
              })
          )
        );
        return materials;
      });
    }
    createVRMMaterials(originalMaterial, vrmProps, gltf) {
      return __awaiter(this, void 0, void 0, function* () {
        let newSurface;
        let newOutline;
        if (vrmProps.shader === "VRM/MToon") {
          const params = yield this._extractMaterialProperties(
            originalMaterial,
            vrmProps,
            gltf
          );
          // we need to get rid of these properties
          ["srcBlend", "dstBlend", "isFirstSetup"].forEach((name) => {
            if (params[name] !== undefined) {
              delete params[name];
            }
          });
          // these textures must be sRGB Encoding, depends on current colorspace
          [
            "mainTex",
            "shadeTexture",
            "emissionMap",
            "sphereAdd",
            "rimTexture",
          ].forEach((name) => {
            if (params[name] !== undefined) {
              params[name].encoding = this._encoding;
            }
          });
          // specify uniform color encodings
          params.encoding = this._encoding;
          // done
          newSurface = new MToonMaterial(params);
          // outline
          if (
            params.outlineWidthMode !==
            exports.MToonMaterialOutlineWidthMode.None
          ) {
            params.isOutline = true;
            newOutline = new MToonMaterial(params);
          }
        } else if (vrmProps.shader === "VRM/UnlitTexture") {
          // this is very legacy
          const params = yield this._extractMaterialProperties(
            originalMaterial,
            vrmProps,
            gltf
          );
          params.renderType = exports.VRMUnlitMaterialRenderType.Opaque;
          newSurface = new VRMUnlitMaterial(params);
        } else if (vrmProps.shader === "VRM/UnlitCutout") {
          // this is very legacy
          const params = yield this._extractMaterialProperties(
            originalMaterial,
            vrmProps,
            gltf
          );
          params.renderType = exports.VRMUnlitMaterialRenderType.Cutout;
          newSurface = new VRMUnlitMaterial(params);
        } else if (vrmProps.shader === "VRM/UnlitTransparent") {
          // this is very legacy
          const params = yield this._extractMaterialProperties(
            originalMaterial,
            vrmProps,
            gltf
          );
          params.renderType = exports.VRMUnlitMaterialRenderType.Transparent;
          newSurface = new VRMUnlitMaterial(params);
        } else if (vrmProps.shader === "VRM/UnlitTransparentZWrite") {
          // this is very legacy
          const params = yield this._extractMaterialProperties(
            originalMaterial,
            vrmProps,
            gltf
          );
          params.renderType =
            exports.VRMUnlitMaterialRenderType.TransparentWithZWrite;
          newSurface = new VRMUnlitMaterial(params);
        } else {
          if (vrmProps.shader !== "VRM_USE_GLTFSHADER") {
            console.warn(`Unknown shader detected: "${vrmProps.shader}"`);
            // then presume as VRM_USE_GLTFSHADER
          }
          newSurface = this._convertGLTFMaterial(originalMaterial.clone());
        }
        newSurface.name = originalMaterial.name;
        newSurface.userData = JSON.parse(
          JSON.stringify(originalMaterial.userData)
        );
        newSurface.userData.vrmMaterialProperties = vrmProps;
        if (newOutline) {
          newOutline.name = originalMaterial.name + " (Outline)";
          newOutline.userData = JSON.parse(
            JSON.stringify(originalMaterial.userData)
          );
          newOutline.userData.vrmMaterialProperties = vrmProps;
        }
        return {
          surface: newSurface,
          outline: newOutline,
        };
      });
    }
    _renameMaterialProperty(name) {
      if (name[0] !== "_") {
        console.warn(
          `VRMMaterials: Given property name "${name}" might be invalid`
        );
        return name;
      }
      name = name.substring(1);
      if (!/[A-Z]/.test(name[0])) {
        console.warn(
          `VRMMaterials: Given property name "${name}" might be invalid`
        );
        return name;
      }
      return name[0].toLowerCase() + name.substring(1);
    }
    _convertGLTFMaterial(material) {
      if (material.isMeshStandardMaterial) {
        const mtl = material;
        if (mtl.map) {
          mtl.map.encoding = this._encoding;
        }
        if (mtl.emissiveMap) {
          mtl.emissiveMap.encoding = this._encoding;
        }
        if (this._encoding === THREE.LinearEncoding) {
          mtl.color.convertLinearToSRGB();
          mtl.emissive.convertLinearToSRGB();
        }
      }
      if (material.isMeshBasicMaterial) {
        const mtl = material;
        if (mtl.map) {
          mtl.map.encoding = this._encoding;
        }
        if (this._encoding === THREE.LinearEncoding) {
          mtl.color.convertLinearToSRGB();
        }
      }
      return material;
    }
    _extractMaterialProperties(originalMaterial, vrmProps, gltf) {
      const taskList = [];
      const params = {};
      // extract texture properties
      if (vrmProps.textureProperties) {
        for (const name of Object.keys(vrmProps.textureProperties)) {
          const newName = this._renameMaterialProperty(name);
          const textureIndex = vrmProps.textureProperties[name];
          taskList.push(
            gltf.parser
              .getDependency("texture", textureIndex)
              .then((texture) => {
                params[newName] = texture;
              })
          );
        }
      }
      // extract float properties
      if (vrmProps.floatProperties) {
        for (const name of Object.keys(vrmProps.floatProperties)) {
          const newName = this._renameMaterialProperty(name);
          params[newName] = vrmProps.floatProperties[name];
        }
      }
      // extract vector (color tbh) properties
      if (vrmProps.vectorProperties) {
        for (const name of Object.keys(vrmProps.vectorProperties)) {
          let newName = this._renameMaterialProperty(name);
          // if this is textureST (same name as texture name itself), add '_ST'
          const isTextureST = [
            "_MainTex",
            "_ShadeTexture",
            "_BumpMap",
            "_ReceiveShadowTexture",
            "_ShadingGradeTexture",
            "_RimTexture",
            "_SphereAdd",
            "_EmissionMap",
            "_OutlineWidthTexture",
            "_UvAnimMaskTexture",
          ].some((textureName) => name === textureName);
          if (isTextureST) {
            newName += "_ST";
          }
          params[newName] = new THREE.Vector4(
            ...vrmProps.vectorProperties[name]
          );
        }
      }
      // set whether it needs skinning and morphing or not
      params.skinning = originalMaterial.skinning || false;
      params.morphTargets = originalMaterial.morphTargets || false;
      params.morphNormals = originalMaterial.morphNormals || false;
      return Promise.all(taskList).then(() => params);
    }
  }

  /**
   * An importer that imports a {@link VRMMeta} from a VRM extension of a GLTF.
   */
  class VRMMetaImporter {
    constructor(options) {
      var _a;
      this.ignoreTexture =
        (_a =
          options === null || options === void 0
            ? void 0
            : options.ignoreTexture) !== null && _a !== void 0
          ? _a
          : false;
    }
    import(gltf) {
      var _a;
      return __awaiter(this, void 0, void 0, function* () {
        const vrmExt =
          (_a = gltf.parser.json.extensions) === null || _a === void 0
            ? void 0
            : _a.VRM;
        if (!vrmExt) {
          return null;
        }
        const schemaMeta = vrmExt.meta;
        if (!schemaMeta) {
          return null;
        }
        let texture;
        if (
          !this.ignoreTexture &&
          schemaMeta.texture != null &&
          schemaMeta.texture !== -1
        ) {
          texture = yield gltf.parser.getDependency(
            "texture",
            schemaMeta.texture
          );
        }
        return {
          allowedUserName: schemaMeta.allowedUserName,
          author: schemaMeta.author,
          commercialUssageName: schemaMeta.commercialUssageName,
          contactInformation: schemaMeta.contactInformation,
          licenseName: schemaMeta.licenseName,
          otherLicenseUrl: schemaMeta.otherLicenseUrl,
          otherPermissionUrl: schemaMeta.otherPermissionUrl,
          reference: schemaMeta.reference,
          sexualUssageName: schemaMeta.sexualUssageName,
          texture: texture !== null && texture !== void 0 ? texture : undefined,
          title: schemaMeta.title,
          version: schemaMeta.version,
          violentUssageName: schemaMeta.violentUssageName,
        };
      });
    }
  }

  const _matA = new THREE.Matrix4();
  /**
   * A compat function for `Matrix4.invert()` / `Matrix4.getInverse()`.
   * `Matrix4.invert()` is introduced in r123 and `Matrix4.getInverse()` emits a warning.
   * We are going to use this compat for a while.
   * @param target A target matrix
   */
  function mat4InvertCompat(target) {
    if (target.invert) {
      target.invert();
    } else {
      target.getInverse(_matA.copy(target));
    }
    return target;
  }

  class Matrix4InverseCache {
    constructor(matrix) {
      /**
       * A cache of inverse of current matrix.
       */
      this._inverseCache = new THREE.Matrix4();
      /**
       * A flag that makes it want to recalculate its {@link _inverseCache}.
       * Will be set `true` when `elements` are mutated and be used in `getInverse`.
       */
      this._shouldUpdateInverse = true;
      this.matrix = matrix;
      const handler = {
        set: (obj, prop, newVal) => {
          this._shouldUpdateInverse = true;
          obj[prop] = newVal;
          return true;
        },
      };
      this._originalElements = matrix.elements;
      matrix.elements = new Proxy(matrix.elements, handler);
    }
    /**
     * Inverse of given matrix.
     * Note that it will return its internal private instance.
     * Make sure copying this before mutate this.
     */
    get inverse() {
      if (this._shouldUpdateInverse) {
        mat4InvertCompat(this._inverseCache.copy(this.matrix));
        this._shouldUpdateInverse = false;
      }
      return this._inverseCache;
    }
    revert() {
      this.matrix.elements = this._originalElements;
    }
  }

  // based on
  // http://rocketjump.skr.jp/unity3d/109/
  // https://github.com/dwango/UniVRM/blob/master/Scripts/SpringBone/VRMSpringBone.cs
  const IDENTITY_MATRIX4 = Object.freeze(new THREE.Matrix4());
  const IDENTITY_QUATERNION = Object.freeze(new THREE.Quaternion());
  // 計算中の一時保存用変数（一度インスタンスを作ったらあとは使い回す）
  const _v3A$2 = new THREE.Vector3();
  const _v3B$1 = new THREE.Vector3();
  const _v3C$1 = new THREE.Vector3();
  const _quatA$1 = new THREE.Quaternion();
  const _matA$1 = new THREE.Matrix4();
  const _matB = new THREE.Matrix4();
  /**
   * A class represents a single spring bone of a VRM.
   * It should be managed by a [[VRMSpringBoneManager]].
   */
  class VRMSpringBone {
    /**
     * Create a new VRMSpringBone.
     *
     * @param bone An Object3D that will be attached to this bone
     * @param params Several parameters related to behavior of the spring bone
     */
    constructor(bone, params = {}) {
      var _a, _b, _c, _d, _e, _f;
      /**
       * Current position of child tail, in world unit. Will be used for verlet integration.
       */
      this._currentTail = new THREE.Vector3();
      /**
       * Previous position of child tail, in world unit. Will be used for verlet integration.
       */
      this._prevTail = new THREE.Vector3();
      /**
       * Next position of child tail, in world unit. Will be used for verlet integration.
       * Actually used only in [[update]] and it's kind of temporary variable.
       */
      this._nextTail = new THREE.Vector3();
      /**
       * Initial axis of the bone, in local unit.
       */
      this._boneAxis = new THREE.Vector3();
      /**
       * Position of this bone in relative space, kind of a temporary variable.
       */
      this._centerSpacePosition = new THREE.Vector3();
      /**
       * This springbone will be calculated based on the space relative from this object.
       * If this is `null`, springbone will be calculated in world space.
       */
      this._center = null;
      /**
       * Rotation of parent bone, in world unit.
       * We should update this constantly in [[update]].
       */
      this._parentWorldRotation = new THREE.Quaternion();
      /**
       * Initial state of the local matrix of the bone.
       */
      this._initialLocalMatrix = new THREE.Matrix4();
      /**
       * Initial state of the rotation of the bone.
       */
      this._initialLocalRotation = new THREE.Quaternion();
      /**
       * Initial state of the position of its child.
       */
      this._initialLocalChildPosition = new THREE.Vector3();
      this.bone = bone; // uniVRMでの parent
      this.bone.matrixAutoUpdate = false; // updateにより計算されるのでthree.js内での自動処理は不要
      this.radius = (_a = params.radius) !== null && _a !== void 0 ? _a : 0.02;
      this.stiffnessForce =
        (_b = params.stiffnessForce) !== null && _b !== void 0 ? _b : 1.0;
      this.gravityDir = params.gravityDir
        ? new THREE.Vector3().copy(params.gravityDir)
        : new THREE.Vector3().set(0.0, -1.0, 0.0);
      this.gravityPower =
        (_c = params.gravityPower) !== null && _c !== void 0 ? _c : 0.0;
      this.dragForce =
        (_d = params.dragForce) !== null && _d !== void 0 ? _d : 0.4;
      this.colliders =
        (_e = params.colliders) !== null && _e !== void 0 ? _e : [];
      this._centerSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
      this._initialLocalMatrix.copy(this.bone.matrix);
      this._initialLocalRotation.copy(this.bone.quaternion);
      if (this.bone.children.length === 0) {
        // 末端のボーン。子ボーンがいないため「自分の少し先」が子ボーンということにする
        // https://github.com/dwango/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/SpringBone/VRMSpringBone.cs#L246
        this._initialLocalChildPosition
          .copy(this.bone.position)
          .normalize()
          .multiplyScalar(0.07); // magic number! derives from original source
      } else {
        const firstChild = this.bone.children[0];
        this._initialLocalChildPosition.copy(firstChild.position);
      }
      this.bone.localToWorld(
        this._currentTail.copy(this._initialLocalChildPosition)
      );
      this._prevTail.copy(this._currentTail);
      this._nextTail.copy(this._currentTail);
      this._boneAxis.copy(this._initialLocalChildPosition).normalize();
      this._centerSpaceBoneLength = _v3A$2
        .copy(this._initialLocalChildPosition)
        .applyMatrix4(this.bone.matrixWorld)
        .sub(this._centerSpacePosition)
        .length();
      this.center = (_f = params.center) !== null && _f !== void 0 ? _f : null;
    }
    get center() {
      return this._center;
    }
    set center(center) {
      var _a;
      // convert tails to world space
      this._getMatrixCenterToWorld(_matA$1);
      this._currentTail.applyMatrix4(_matA$1);
      this._prevTail.applyMatrix4(_matA$1);
      this._nextTail.applyMatrix4(_matA$1);
      // uninstall inverse cache
      if (
        (_a = this._center) === null || _a === void 0
          ? void 0
          : _a.userData.inverseCacheProxy
      ) {
        this._center.userData.inverseCacheProxy.revert();
        delete this._center.userData.inverseCacheProxy;
      }
      // change the center
      this._center = center;
      // install inverse cache
      if (this._center) {
        if (!this._center.userData.inverseCacheProxy) {
          this._center.userData.inverseCacheProxy = new Matrix4InverseCache(
            this._center.matrixWorld
          );
        }
      }
      // convert tails to center space
      this._getMatrixWorldToCenter(_matA$1);
      this._currentTail.applyMatrix4(_matA$1);
      this._prevTail.applyMatrix4(_matA$1);
      this._nextTail.applyMatrix4(_matA$1);
      // convert center space dependant state
      _matA$1.multiply(this.bone.matrixWorld); // 🔥 ??
      this._centerSpacePosition.setFromMatrixPosition(_matA$1);
      this._centerSpaceBoneLength = _v3A$2
        .copy(this._initialLocalChildPosition)
        .applyMatrix4(_matA$1)
        .sub(this._centerSpacePosition)
        .length();
    }
    /**
     * Reset the state of this bone.
     * You might want to call [[VRMSpringBoneManager.reset]] instead.
     */
    reset() {
      this.bone.quaternion.copy(this._initialLocalRotation);
      // We need to update its matrixWorld manually, since we tweaked the bone by our hand
      this.bone.updateMatrix();
      this.bone.matrixWorld.multiplyMatrices(
        this._getParentMatrixWorld(),
        this.bone.matrix
      );
      this._centerSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
      // Apply updated position to tail states
      this.bone.localToWorld(
        this._currentTail.copy(this._initialLocalChildPosition)
      );
      this._prevTail.copy(this._currentTail);
      this._nextTail.copy(this._currentTail);
    }
    /**
     * Update the state of this bone.
     * You might want to call [[VRMSpringBoneManager.update]] instead.
     *
     * @param delta deltaTime
     */
    update(delta) {
      if (delta <= 0) return;
      // 親スプリングボーンの姿勢は常に変化している。
      // それに基づいて処理直前に自分のworldMatrixを更新しておく
      this.bone.matrixWorld.multiplyMatrices(
        this._getParentMatrixWorld(),
        this.bone.matrix
      );
      if (this.bone.parent) {
        // SpringBoneは親から順に処理されていくため、
        // 親のmatrixWorldは最新状態の前提でworldMatrixからquaternionを取り出す。
        // 制限はあるけれど、計算は少ないのでgetWorldQuaternionではなくこの方法を取る。
        getWorldQuaternionLite(this.bone.parent, this._parentWorldRotation);
      } else {
        this._parentWorldRotation.copy(IDENTITY_QUATERNION);
      }
      // Get bone position in center space
      this._getMatrixWorldToCenter(_matA$1);
      _matA$1.multiply(this.bone.matrixWorld); // 🔥 ??
      this._centerSpacePosition.setFromMatrixPosition(_matA$1);
      // Get parent position in center space
      this._getMatrixWorldToCenter(_matB);
      _matB.multiply(this._getParentMatrixWorld());
      // several parameters
      const stiffness = this.stiffnessForce * delta;
      const external = _v3B$1
        .copy(this.gravityDir)
        .multiplyScalar(this.gravityPower * delta);
      // verlet積分で次の位置を計算
      this._nextTail
        .copy(this._currentTail)
        .add(
          _v3A$2
            .copy(this._currentTail)
            .sub(this._prevTail)
            .multiplyScalar(1 - this.dragForce)
        ) // 前フレームの移動を継続する(減衰もあるよ)
        .add(
          _v3A$2
            .copy(this._boneAxis)
            .applyMatrix4(this._initialLocalMatrix)
            .applyMatrix4(_matB)
            .sub(this._centerSpacePosition)
            .normalize()
            .multiplyScalar(stiffness)
        ) // 親の回転による子ボーンの移動目標
        .add(external); // 外力による移動量
      // normalize bone length
      this._nextTail
        .sub(this._centerSpacePosition)
        .normalize()
        .multiplyScalar(this._centerSpaceBoneLength)
        .add(this._centerSpacePosition);
      // Collisionで移動
      this._collision(this._nextTail);
      this._prevTail.copy(this._currentTail);
      this._currentTail.copy(this._nextTail);
      // Apply rotation, convert vector3 thing into actual quaternion
      // Original UniVRM is doing world unit calculus at here but we're gonna do this on local unit
      // since Three.js is not good at world coordination stuff
      const initialCenterSpaceMatrixInv = mat4InvertCompat(
        _matA$1.copy(_matB.multiply(this._initialLocalMatrix))
      );
      const applyRotation = _quatA$1.setFromUnitVectors(
        this._boneAxis,
        _v3A$2
          .copy(this._nextTail)
          .applyMatrix4(initialCenterSpaceMatrixInv)
          .normalize()
      );
      this.bone.quaternion
        .copy(this._initialLocalRotation)
        .multiply(applyRotation);
      // We need to update its matrixWorld manually, since we tweaked the bone by our hand
      this.bone.updateMatrix();
      this.bone.matrixWorld.multiplyMatrices(
        this._getParentMatrixWorld(),
        this.bone.matrix
      );
    }
    /**
     * Do collision math against every colliders attached to this bone.
     *
     * @param tail The tail you want to process
     */
    _collision(tail) {
      this.colliders.forEach((collider) => {
        this._getMatrixWorldToCenter(_matA$1);
        _matA$1.multiply(collider.matrixWorld);
        const colliderCenterSpacePosition =
          _v3A$2.setFromMatrixPosition(_matA$1);
        const colliderRadius = collider.geometry.boundingSphere.radius; // the bounding sphere is guaranteed to be exist by VRMSpringBoneImporter._createColliderMesh
        const r = this.radius + colliderRadius;
        if (tail.distanceToSquared(colliderCenterSpacePosition) <= r * r) {
          // ヒット。Colliderの半径方向に押し出す
          const normal = _v3B$1
            .subVectors(tail, colliderCenterSpacePosition)
            .normalize();
          const posFromCollider = _v3C$1.addVectors(
            colliderCenterSpacePosition,
            normal.multiplyScalar(r)
          );
          // normalize bone length
          tail.copy(
            posFromCollider
              .sub(this._centerSpacePosition)
              .normalize()
              .multiplyScalar(this._centerSpaceBoneLength)
              .add(this._centerSpacePosition)
          );
        }
      });
    }
    /**
     * Create a matrix that converts center space into world space.
     * @param target Target matrix
     */
    _getMatrixCenterToWorld(target) {
      if (this._center) {
        target.copy(this._center.matrixWorld);
      } else {
        target.identity();
      }
      return target;
    }
    /**
     * Create a matrix that converts world space into center space.
     * @param target Target matrix
     */
    _getMatrixWorldToCenter(target) {
      if (this._center) {
        target.copy(this._center.userData.inverseCacheProxy.inverse);
      } else {
        target.identity();
      }
      return target;
    }
    /**
     * Returns the world matrix of its parent object.
     */
    _getParentMatrixWorld() {
      return this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY_MATRIX4;
    }
  }

  /**
   * A class manages every spring bones on a VRM.
   */
  class VRMSpringBoneManager {
    /**
     * Create a new [[VRMSpringBoneManager]]
     *
     * @param springBoneGroupList An array of [[VRMSpringBoneGroup]]
     */
    constructor(colliderGroups, springBoneGroupList) {
      this.colliderGroups = [];
      this.springBoneGroupList = [];
      this.colliderGroups = colliderGroups;
      this.springBoneGroupList = springBoneGroupList;
    }
    /**
     * Set all bones be calculated based on the space relative from this object.
     * If `null` is given, springbone will be calculated in world space.
     * @param root Root object, or `null`
     */
    setCenter(root) {
      this.springBoneGroupList.forEach((springBoneGroup) => {
        springBoneGroup.forEach((springBone) => {
          springBone.center = root;
        });
      });
    }
    /**
     * Update every spring bone attached to this manager.
     *
     * @param delta deltaTime
     */
    lateUpdate(delta) {
      this.springBoneGroupList.forEach((springBoneGroup) => {
        springBoneGroup.forEach((springBone) => {
          springBone.update(delta);
        });
      });
    }
    /**
     * Reset every spring bone attached to this manager.
     */
    reset() {
      this.springBoneGroupList.forEach((springBoneGroup) => {
        springBoneGroup.forEach((springBone) => {
          springBone.reset();
        });
      });
    }
  }

  const _v3A$3 = new THREE.Vector3();
  const _colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
  /**
   * An importer that imports a [[VRMSpringBoneManager]] from a VRM extension of a GLTF.
   */
  class VRMSpringBoneImporter {
    /**
     * Import a [[VRMLookAtHead]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
      var _a;
      return __awaiter(this, void 0, void 0, function* () {
        const vrmExt =
          (_a = gltf.parser.json.extensions) === null || _a === void 0
            ? void 0
            : _a.VRM;
        if (!vrmExt) return null;
        const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
        if (!schemaSecondaryAnimation) return null;
        // 衝突判定球体メッシュ。
        const colliderGroups = yield this._importColliderMeshGroups(
          gltf,
          schemaSecondaryAnimation
        );
        // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
        // 一列だけではないことに注意。
        const springBoneGroupList = yield this._importSpringBoneGroupList(
          gltf,
          schemaSecondaryAnimation,
          colliderGroups
        );
        return new VRMSpringBoneManager(colliderGroups, springBoneGroupList);
      });
    }
    _createSpringBone(bone, params = {}) {
      return new VRMSpringBone(bone, params);
    }
    _importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups) {
      return __awaiter(this, void 0, void 0, function* () {
        const springBoneGroups = schemaSecondaryAnimation.boneGroups || [];
        const springBoneGroupList = [];
        yield Promise.all(
          springBoneGroups.map((vrmBoneGroup) =>
            __awaiter(this, void 0, void 0, function* () {
              if (
                vrmBoneGroup.stiffiness === undefined ||
                vrmBoneGroup.gravityDir === undefined ||
                vrmBoneGroup.gravityDir.x === undefined ||
                vrmBoneGroup.gravityDir.y === undefined ||
                vrmBoneGroup.gravityDir.z === undefined ||
                vrmBoneGroup.gravityPower === undefined ||
                vrmBoneGroup.dragForce === undefined ||
                vrmBoneGroup.hitRadius === undefined ||
                vrmBoneGroup.colliderGroups === undefined ||
                vrmBoneGroup.bones === undefined ||
                vrmBoneGroup.center === undefined
              ) {
                return;
              }
              const stiffnessForce = vrmBoneGroup.stiffiness;
              const gravityDir = new THREE.Vector3(
                vrmBoneGroup.gravityDir.x,
                vrmBoneGroup.gravityDir.y,
                -vrmBoneGroup.gravityDir.z
              );
              const gravityPower = vrmBoneGroup.gravityPower;
              const dragForce = vrmBoneGroup.dragForce;
              const radius = vrmBoneGroup.hitRadius;
              const colliders = [];
              vrmBoneGroup.colliderGroups.forEach((colliderIndex) => {
                colliders.push(...colliderGroups[colliderIndex].colliders);
              });
              const springBoneGroup = [];
              yield Promise.all(
                vrmBoneGroup.bones.map((nodeIndex) =>
                  __awaiter(this, void 0, void 0, function* () {
                    // VRMの情報から「揺れモノ」ボーンのルートが取れる
                    const springRootBone = yield gltf.parser.getDependency(
                      "node",
                      nodeIndex
                    );
                    const center =
                      vrmBoneGroup.center !== -1
                        ? yield gltf.parser.getDependency(
                            "node",
                            vrmBoneGroup.center
                          )
                        : null;
                    // it's weird but there might be cases we can't find the root bone
                    if (!springRootBone) {
                      return;
                    }
                    springRootBone.traverse((bone) => {
                      const springBone = this._createSpringBone(bone, {
                        radius,
                        stiffnessForce,
                        gravityDir,
                        gravityPower,
                        dragForce,
                        colliders,
                        center,
                      });
                      springBoneGroup.push(springBone);
                    });
                  })
                )
              );
              springBoneGroupList.push(springBoneGroup);
            })
          )
        );
        return springBoneGroupList;
      });
    }
    /**
     * Create an array of [[VRMSpringBoneColliderGroup]].
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param schemaSecondaryAnimation A `secondaryAnimation` field of VRM
     */
    _importColliderMeshGroups(gltf, schemaSecondaryAnimation) {
      return __awaiter(this, void 0, void 0, function* () {
        const vrmColliderGroups = schemaSecondaryAnimation.colliderGroups;
        if (vrmColliderGroups === undefined) return [];
        const colliderGroups = [];
        vrmColliderGroups.forEach((colliderGroup) =>
          __awaiter(this, void 0, void 0, function* () {
            if (
              colliderGroup.node === undefined ||
              colliderGroup.colliders === undefined
            ) {
              return;
            }
            const bone = yield gltf.parser.getDependency(
              "node",
              colliderGroup.node
            );
            const colliders = [];
            colliderGroup.colliders.forEach((collider) => {
              if (
                collider.offset === undefined ||
                collider.offset.x === undefined ||
                collider.offset.y === undefined ||
                collider.offset.z === undefined ||
                collider.radius === undefined
              ) {
                return;
              }
              const offset = _v3A$3.set(
                collider.offset.x,
                collider.offset.y,
                -collider.offset.z
              );
              const colliderMesh = this._createColliderMesh(
                collider.radius,
                offset
              );
              bone.add(colliderMesh);
              colliders.push(colliderMesh);
            });
            const colliderMeshGroup = {
              node: colliderGroup.node,
              colliders,
            };
            colliderGroups.push(colliderMeshGroup);
          })
        );
        return colliderGroups;
      });
    }
    /**
     * Create a collider mesh.
     *
     * @param radius Radius of the new collider mesh
     * @param offset Offest of the new collider mesh
     */
    _createColliderMesh(radius, offset) {
      const colliderMesh = new THREE.Mesh(
        new THREE.SphereBufferGeometry(radius, 8, 4),
        _colliderMaterial
      );
      colliderMesh.position.copy(offset);
      // the name have to be this in order to exclude colliders from bounding box
      // (See Viewer.ts, search for child.name === 'vrmColliderSphere')
      colliderMesh.name = "vrmColliderSphere";
      // We will use the radius of the sphere for collision vs bones.
      // `boundingSphere` must be created to compute the radius.
      colliderMesh.geometry.computeBoundingSphere();
      return colliderMesh;
    }
  }

  /**
   * An importer that imports a [[VRM]] from a VRM extension of a GLTF.
   */
  class VRMImporter {
    /**
     * Create a new VRMImporter.
     *
     * @param options [[VRMImporterOptions]], optionally contains importers for each component
     */
    constructor(options = {}) {
      this._metaImporter = options.metaImporter || new VRMMetaImporter();
      this._blendShapeImporter =
        options.blendShapeImporter || new VRMBlendShapeImporter();
      this._lookAtImporter = options.lookAtImporter || new VRMLookAtImporter();
      this._humanoidImporter =
        options.humanoidImporter || new VRMHumanoidImporter();
      this._firstPersonImporter =
        options.firstPersonImporter || new VRMFirstPersonImporter();
      this._materialImporter =
        options.materialImporter || new VRMMaterialImporter();
      this._springBoneImporter =
        options.springBoneImporter || new VRMSpringBoneImporter();
    }
    /**
     * Receive a GLTF object retrieved from `THREE.GLTFLoader` and create a new [[VRM]] instance.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
      return __awaiter(this, void 0, void 0, function* () {
        if (
          gltf.parser.json.extensions === undefined ||
          gltf.parser.json.extensions.VRM === undefined
        ) {
          throw new Error("Could not find VRM extension on the GLTF");
        }
        const scene = gltf.scene;
        scene.updateMatrixWorld(false);
        // Skinned object should not be frustumCulled
        // Since pre-skinned position might be outside of view
        scene.traverse((object3d) => {
          if (object3d.isMesh) {
            object3d.frustumCulled = false;
          }
        });
        const meta = (yield this._metaImporter.import(gltf)) || undefined;
        const materials =
          (yield this._materialImporter.convertGLTFMaterials(gltf)) ||
          undefined;
        const humanoid =
          (yield this._humanoidImporter.import(gltf)) || undefined;
        const firstPerson = humanoid
          ? (yield this._firstPersonImporter.import(gltf, humanoid)) ||
            undefined
          : undefined;
        const blendShapeProxy =
          (yield this._blendShapeImporter.import(gltf)) || undefined;
        const lookAt =
          firstPerson && blendShapeProxy && humanoid
            ? (yield this._lookAtImporter.import(
                gltf,
                firstPerson,
                blendShapeProxy,
                humanoid
              )) || undefined
            : undefined;
        const springBoneManager =
          (yield this._springBoneImporter.import(gltf)) || undefined;
        return new VRM({
          scene: gltf.scene,
          meta,
          materials,
          humanoid,
          firstPerson,
          blendShapeProxy,
          lookAt,
          springBoneManager,
        });
      });
    }
  }

  /**
   * A class that represents a single VRM model.
   * See the documentation of [[VRM.from]] for the most basic use of VRM.
   */
  class VRM {
    /**
     * Create a new VRM instance.
     *
     * @param params [[VRMParameters]] that represents components of the VRM
     */
    constructor(params) {
      this.scene = params.scene;
      this.humanoid = params.humanoid;
      this.blendShapeProxy = params.blendShapeProxy;
      this.firstPerson = params.firstPerson;
      this.lookAt = params.lookAt;
      this.materials = params.materials;
      this.springBoneManager = params.springBoneManager;
      this.meta = params.meta;
    }
    /**
     * Create a new VRM from a parsed result of GLTF taken from GLTFLoader.
     * It's probably a thing what you want to get started with VRMs.
     *
     * @example Most basic use of VRM
     * ```
     * const scene = new THREE.Scene();
     *
     * new THREE.GLTFLoader().load( 'models/three-vrm-girl.vrm', ( gltf ) => {
     *
     *   THREE.VRM.from( gltf ).then( ( vrm ) => {
     *
     *     scene.add( vrm.scene );
     *
     *   } );
     *
     * } );
     * ```
     *
     * @param gltf A parsed GLTF object taken from GLTFLoader
     * @param options Options that will be used in importer
     */
    static from(gltf, options = {}) {
      return __awaiter(this, void 0, void 0, function* () {
        const importer = new VRMImporter(options);
        return yield importer.import(gltf);
      });
    }
    /**
     * **You need to call this on your update loop.**
     *
     * This function updates every VRM components.
     *
     * @param delta deltaTime
     */
    update(delta) {
      if (this.lookAt) {
        this.lookAt.update(delta);
      }
      if (this.blendShapeProxy) {
        this.blendShapeProxy.update();
      }
      if (this.springBoneManager) {
        this.springBoneManager.lateUpdate(delta);
      }
      if (this.materials) {
        this.materials.forEach((material) => {
          if (material.updateVRMMaterials) {
            material.updateVRMMaterials(delta);
          }
        });
      }
    }
    /**
     * Dispose everything about the VRM instance.
     */
    dispose() {
      var _a, _b;
      const scene = this.scene;
      if (scene) {
        deepDispose(scene);
      }
      (_b =
        (_a = this.meta) === null || _a === void 0 ? void 0 : _a.texture) ===
        null || _b === void 0
        ? void 0
        : _b.dispose();
    }
  }

  const _v2A = new THREE.Vector2();
  const _camera = new THREE.OrthographicCamera(-1, 1, -1, 1, -1, 1);
  const _material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const _plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), _material);
  const _scene = new THREE.Scene();
  _scene.add(_plane);
  /**
   * Extract a thumbnail image blob from a {@link VRM}.
   * If the vrm does not have a thumbnail, it will throw an error.
   * @param renderer Renderer
   * @param vrm VRM with a thumbnail
   * @param size width / height of the image
   */
  function extractThumbnailBlob(renderer, vrm, size = 512) {
    var _a;
    // get the texture
    const texture =
      (_a = vrm.meta) === null || _a === void 0 ? void 0 : _a.texture;
    if (!texture) {
      throw new Error(
        "extractThumbnailBlob: This VRM does not have a thumbnail"
      );
    }
    const canvas = renderer.getContext().canvas;
    // store the current resolution
    renderer.getSize(_v2A);
    const prevWidth = _v2A.x;
    const prevHeight = _v2A.y;
    // overwrite the resolution
    renderer.setSize(size, size, false);
    // assign the texture to plane
    _material.map = texture;
    // render
    renderer.render(_scene, _camera);
    // unassign the texture
    _material.map = null;
    // get blob
    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob().finally(() => {
        // revert to previous resolution
        renderer.setSize(prevWidth, prevHeight, false);
      });
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        // revert to previous resolution
        renderer.setSize(prevWidth, prevHeight, false);
        if (blob == null) {
          reject("extractThumbnailBlob: Failed to create a blob");
        } else {
          resolve(blob);
        }
      });
    });
  }

  /**
   * Traverse given object and remove unnecessarily bound joints from every `THREE.SkinnedMesh`.
   * Some environments like mobile devices have a lower limit of bones and might be unable to perform mesh skinning, this function might resolve such an issue.
   * Also this function might greatly improve the performance of mesh skinning.
   *
   * @param root Root object that will be traversed
   */
  function removeUnnecessaryJoints(root) {
    // some meshes might share a same skinIndex attribute and this map prevents to convert the attribute twice
    const skeletonList = new Map();
    // Traverse an entire tree
    root.traverse((obj) => {
      if (obj.type !== "SkinnedMesh") {
        return;
      }
      const mesh = obj;
      const geometry = mesh.geometry;
      const attribute = geometry.getAttribute("skinIndex");
      // look for existing skeleton
      let skeleton = skeletonList.get(attribute);
      if (!skeleton) {
        // generate reduced bone list
        const bones = []; // new list of bone
        const boneInverses = []; // new list of boneInverse
        const boneIndexMap = {}; // map of old bone index vs. new bone index
        // create a new bone map
        const array = attribute.array;
        for (let i = 0; i < array.length; i++) {
          const index = array[i];
          // new skinIndex buffer
          if (boneIndexMap[index] === undefined) {
            boneIndexMap[index] = bones.length;
            bones.push(mesh.skeleton.bones[index]);
            boneInverses.push(mesh.skeleton.boneInverses[index]);
          }
          array[i] = boneIndexMap[index];
        }
        // replace with new indices
        attribute.copyArray(array);
        attribute.needsUpdate = true;
        // replace with new indices
        skeleton = new THREE.Skeleton(bones, boneInverses);
        skeletonList.set(attribute, skeleton);
      }
      mesh.bind(skeleton, new THREE.Matrix4());
      //                  ^^^^^^^^^^^^^^^^^^^ transform of meshes should be ignored
      // See: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
    });
  }

  class VRMUtils {
    constructor() {
      // this class is not meant to be instantiated
    }
  }
  VRMUtils.extractThumbnailBlob = extractThumbnailBlob;
  VRMUtils.removeUnnecessaryJoints = removeUnnecessaryJoints;

  const _v3$1 = new THREE.Vector3();
  class VRMLookAtHeadDebug extends VRMLookAtHead {
    setupHelper(scene, debugOption) {
      if (!debugOption.disableFaceDirectionHelper) {
        this._faceDirectionHelper = new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, -1),
          new THREE.Vector3(0, 0, 0),
          0.5,
          0xff00ff
        );
        scene.add(this._faceDirectionHelper);
      }
    }
    update(delta) {
      super.update(delta);
      if (this._faceDirectionHelper) {
        this.firstPerson.getFirstPersonWorldPosition(
          this._faceDirectionHelper.position
        );
        this._faceDirectionHelper.setDirection(
          this.getLookAtWorldDirection(_v3$1)
        );
      }
    }
  }

  class VRMLookAtImporterDebug extends VRMLookAtImporter {
    import(gltf, firstPerson, blendShapeProxy, humanoid) {
      var _a;
      const vrmExt =
        (_a = gltf.parser.json.extensions) === null || _a === void 0
          ? void 0
          : _a.VRM;
      if (!vrmExt) {
        return null;
      }
      const schemaFirstPerson = vrmExt.firstPerson;
      if (!schemaFirstPerson) {
        return null;
      }
      const applyer = this._importApplyer(
        schemaFirstPerson,
        blendShapeProxy,
        humanoid
      );
      return new VRMLookAtHeadDebug(firstPerson, applyer || undefined);
    }
  }

  const _colliderGizmoMaterial = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true,
    transparent: true,
    depthTest: false,
  });
  class VRMSpringBoneManagerDebug extends VRMSpringBoneManager {
    setupHelper(scene, debugOption) {
      if (debugOption.disableSpringBoneHelper) return;
      this.springBoneGroupList.forEach((springBoneGroup) => {
        springBoneGroup.forEach((springBone) => {
          if (springBone.getGizmo) {
            const gizmo = springBone.getGizmo();
            scene.add(gizmo);
          }
        });
      });
      this.colliderGroups.forEach((colliderGroup) => {
        colliderGroup.colliders.forEach((collider) => {
          collider.material = _colliderGizmoMaterial;
          collider.renderOrder = VRM_GIZMO_RENDER_ORDER;
        });
      });
    }
  }

  const _v3A$4 = new THREE.Vector3();
  class VRMSpringBoneDebug extends VRMSpringBone {
    constructor(bone, params) {
      super(bone, params);
    }
    /**
     * Return spring bone gizmo, as `THREE.ArrowHelper`.
     * Useful for debugging spring bones.
     */
    getGizmo() {
      // return if gizmo is already existed
      if (this._gizmo) {
        return this._gizmo;
      }
      const nextTailRelative = _v3A$4
        .copy(this._nextTail)
        .sub(this._centerSpacePosition);
      const nextTailRelativeLength = nextTailRelative.length();
      this._gizmo = new THREE.ArrowHelper(
        nextTailRelative.normalize(),
        this._centerSpacePosition,
        nextTailRelativeLength,
        0xffff00,
        this.radius,
        this.radius
      );
      // it should be always visible
      this._gizmo.line.renderOrder = VRM_GIZMO_RENDER_ORDER;
      this._gizmo.cone.renderOrder = VRM_GIZMO_RENDER_ORDER;
      this._gizmo.line.material.depthTest = false;
      this._gizmo.line.material.transparent = true;
      this._gizmo.cone.material.depthTest = false;
      this._gizmo.cone.material.transparent = true;
      return this._gizmo;
    }
    update(delta) {
      super.update(delta);
      // lastly we're gonna update gizmo
      this._updateGizmo();
    }
    _updateGizmo() {
      if (!this._gizmo) {
        return;
      }
      const nextTailRelative = _v3A$4
        .copy(this._currentTail)
        .sub(this._centerSpacePosition);
      const nextTailRelativeLength = nextTailRelative.length();
      this._gizmo.setDirection(nextTailRelative.normalize());
      this._gizmo.setLength(nextTailRelativeLength, this.radius, this.radius);
      this._gizmo.position.copy(this._centerSpacePosition);
    }
  }

  class VRMSpringBoneImporterDebug extends VRMSpringBoneImporter {
    import(gltf) {
      var _a;
      return __awaiter(this, void 0, void 0, function* () {
        const vrmExt =
          (_a = gltf.parser.json.extensions) === null || _a === void 0
            ? void 0
            : _a.VRM;
        if (!vrmExt) return null;
        const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
        if (!schemaSecondaryAnimation) return null;
        // 衝突判定球体メッシュ。
        const colliderGroups = yield this._importColliderMeshGroups(
          gltf,
          schemaSecondaryAnimation
        );
        // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
        // 一列だけではないことに注意。
        const springBoneGroupList = yield this._importSpringBoneGroupList(
          gltf,
          schemaSecondaryAnimation,
          colliderGroups
        );
        return new VRMSpringBoneManagerDebug(
          colliderGroups,
          springBoneGroupList
        );
      });
    }
    _createSpringBone(bone, params) {
      return new VRMSpringBoneDebug(bone, params);
    }
  }

  /**
   * An importer that imports a [[VRMDebug]] from a VRM extension of a GLTF.
   */
  class VRMImporterDebug extends VRMImporter {
    constructor(options = {}) {
      options.lookAtImporter =
        options.lookAtImporter || new VRMLookAtImporterDebug();
      options.springBoneImporter =
        options.springBoneImporter || new VRMSpringBoneImporterDebug();
      super(options);
    }
    import(gltf, debugOptions = {}) {
      return __awaiter(this, void 0, void 0, function* () {
        if (
          gltf.parser.json.extensions === undefined ||
          gltf.parser.json.extensions.VRM === undefined
        ) {
          throw new Error("Could not find VRM extension on the GLTF");
        }
        const scene = gltf.scene;
        scene.updateMatrixWorld(false);
        // Skinned object should not be frustumCulled
        // Since pre-skinned position might be outside of view
        scene.traverse((object3d) => {
          if (object3d.isMesh) {
            object3d.frustumCulled = false;
          }
        });
        const meta = (yield this._metaImporter.import(gltf)) || undefined;
        const materials =
          (yield this._materialImporter.convertGLTFMaterials(gltf)) ||
          undefined;
        const humanoid =
          (yield this._humanoidImporter.import(gltf)) || undefined;
        const firstPerson = humanoid
          ? (yield this._firstPersonImporter.import(gltf, humanoid)) ||
            undefined
          : undefined;
        const blendShapeProxy =
          (yield this._blendShapeImporter.import(gltf)) || undefined;
        const lookAt =
          firstPerson && blendShapeProxy && humanoid
            ? (yield this._lookAtImporter.import(
                gltf,
                firstPerson,
                blendShapeProxy,
                humanoid
              )) || undefined
            : undefined;
        if (lookAt.setupHelper) {
          lookAt.setupHelper(scene, debugOptions);
        }
        const springBoneManager =
          (yield this._springBoneImporter.import(gltf)) || undefined;
        if (springBoneManager.setupHelper) {
          springBoneManager.setupHelper(scene, debugOptions);
        }
        return new VRMDebug(
          {
            scene: gltf.scene,
            meta,
            materials,
            humanoid,
            firstPerson,
            blendShapeProxy,
            lookAt,
            springBoneManager,
          },
          debugOptions
        );
      });
    }
  }

  const VRM_GIZMO_RENDER_ORDER = 10000;
  /**
   * [[VRM]] but it has some useful gizmos.
   */
  class VRMDebug extends VRM {
    /**
     * Create a new VRMDebug from a parsed result of GLTF taken from GLTFLoader.
     *
     * See [[VRM.from]] for a detailed example.
     *
     * @param gltf A parsed GLTF object taken from GLTFLoader
     * @param options Options that will be used in importer
     * @param debugOption Options for VRMDebug features
     */
    static from(gltf, options = {}, debugOption = {}) {
      return __awaiter(this, void 0, void 0, function* () {
        const importer = new VRMImporterDebug(options);
        return yield importer.import(gltf, debugOption);
      });
    }
    /**
     * Create a new VRMDebug instance.
     *
     * @param params [[VRMParameters]] that represents components of the VRM
     * @param debugOption Options for VRMDebug features
     */
    constructor(params, debugOption = {}) {
      super(params);
      // Gizmoを展開
      if (!debugOption.disableBoxHelper) {
        this.scene.add(new THREE.BoxHelper(this.scene));
      }
      if (!debugOption.disableSkeletonHelper) {
        this.scene.add(new THREE.SkeletonHelper(this.scene));
      }
    }
    update(delta) {
      super.update(delta);
    }
  }

  exports.MToonMaterial = MToonMaterial;
  exports.VRM = VRM;
  exports.VRMBlendShapeGroup = VRMBlendShapeGroup;
  exports.VRMBlendShapeImporter = VRMBlendShapeImporter;
  exports.VRMBlendShapeProxy = VRMBlendShapeProxy;
  exports.VRMCurveMapper = VRMCurveMapper;
  exports.VRMDebug = VRMDebug;
  exports.VRMFirstPerson = VRMFirstPerson;
  exports.VRMFirstPersonImporter = VRMFirstPersonImporter;
  exports.VRMHumanBone = VRMHumanBone;
  exports.VRMHumanoid = VRMHumanoid;
  exports.VRMHumanoidImporter = VRMHumanoidImporter;
  exports.VRMImporter = VRMImporter;
  exports.VRMLookAtApplyer = VRMLookAtApplyer;
  exports.VRMLookAtBlendShapeApplyer = VRMLookAtBlendShapeApplyer;
  exports.VRMLookAtBoneApplyer = VRMLookAtBoneApplyer;
  exports.VRMLookAtHead = VRMLookAtHead;
  exports.VRMLookAtImporter = VRMLookAtImporter;
  exports.VRMMaterialImporter = VRMMaterialImporter;
  exports.VRMMetaImporter = VRMMetaImporter;
  exports.VRMRendererFirstPersonFlags = VRMRendererFirstPersonFlags;
  exports.VRMSpringBone = VRMSpringBone;
  exports.VRMSpringBoneDebug = VRMSpringBoneDebug;
  exports.VRMSpringBoneImporter = VRMSpringBoneImporter;
  exports.VRMSpringBoneImporterDebug = VRMSpringBoneImporterDebug;
  exports.VRMSpringBoneManager = VRMSpringBoneManager;
  exports.VRMUnlitMaterial = VRMUnlitMaterial;
  exports.VRMUtils = VRMUtils;
  exports.VRM_GIZMO_RENDER_ORDER = VRM_GIZMO_RENDER_ORDER;

  Object.defineProperty(exports, "__esModule", { value: true });

  Object.assign(THREE, exports);
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9ub2RlX21vZHVsZXMvdHNsaWIvdHNsaWIuZXM2LmpzIiwiLi4vc3JjL3V0aWxzL2Rpc3Bvc2VyLnRzIiwiLi4vc3JjL2JsZW5kc2hhcGUvVlJNQmxlbmRTaGFwZUdyb3VwLnRzIiwiLi4vc3JjL3R5cGVzL1ZSTVNjaGVtYS50cyIsIi4uL3NyYy91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZS50cyIsIi4uL3NyYy91dGlscy9yZW5hbWVNYXRlcmlhbFByb3BlcnR5LnRzIiwiLi4vc3JjL3V0aWxzL21hdGgudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlUHJveHkudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlSW1wb3J0ZXIudHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb24udHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb25JbXBvcnRlci50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmUudHMiLCIuLi9zcmMvdXRpbHMvcXVhdEludmVydENvbXBhdC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZEltcG9ydGVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1DdXJ2ZU1hcHBlci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QXBwbHllci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEhlYWQudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEJvbmVBcHBseWVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlci50cyIsIi4uL3NyYy9tYXRlcmlhbC9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24udHMiLCIuLi9zcmMvbWF0ZXJpYWwvTVRvb25NYXRlcmlhbC50cyIsIi4uL3NyYy9tYXRlcmlhbC9WUk1VbmxpdE1hdGVyaWFsLnRzIiwiLi4vc3JjL21hdGVyaWFsL1ZSTU1hdGVyaWFsSW1wb3J0ZXIudHMiLCIuLi9zcmMvbWV0YS9WUk1NZXRhSW1wb3J0ZXIudHMiLCIuLi9zcmMvdXRpbHMvbWF0NEludmVydENvbXBhdC50cyIsIi4uL3NyYy91dGlscy9NYXRyaXg0SW52ZXJzZUNhY2hlLnRzIiwiLi4vc3JjL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZS50cyIsIi4uL3NyYy9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyLnRzIiwiLi4vc3JjL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZUltcG9ydGVyLnRzIiwiLi4vc3JjL1ZSTUltcG9ydGVyLnRzIiwiLi4vc3JjL1ZSTS50cyIsIi4uL3NyYy9WUk1VdGlscy9leHRyYWN0VGh1bWJuYWlsQmxvYi50cyIsIi4uL3NyYy9WUk1VdGlscy9yZW1vdmVVbm5lY2Vzc2FyeUpvaW50cy50cyIsIi4uL3NyYy9WUk1VdGlscy9pbmRleC50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1Mb29rQXRIZWFkRGVidWcudHMiLCIuLi9zcmMvZGVidWcvVlJNTG9va0F0SW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTVNwcmluZ0JvbmVEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1JbXBvcnRlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTURlYnVnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBmcm9tLmxlbmd0aCwgaiA9IHRvLmxlbmd0aDsgaSA8IGlsOyBpKyssIGorKylcclxuICAgICAgICB0b1tqXSA9IGZyb21baV07XHJcbiAgICByZXR1cm4gdG87XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHByaXZhdGVNYXApIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBnZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcHJpdmF0ZU1hcC5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgcHJpdmF0ZU1hcCwgdmFsdWUpIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBzZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICBwcml2YXRlTWFwLnNldChyZWNlaXZlciwgdmFsdWUpO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59XHJcbiIsIi8vIFNlZTogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNtYW51YWwvZW4vaW50cm9kdWN0aW9uL0hvdy10by1kaXNwb3NlLW9mLW9iamVjdHNcblxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG5mdW5jdGlvbiBkaXNwb3NlTWF0ZXJpYWwobWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsKTogdm9pZCB7XG4gIE9iamVjdC5rZXlzKG1hdGVyaWFsKS5mb3JFYWNoKChwcm9wZXJ0eU5hbWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV07XG4gICAgaWYgKHZhbHVlPy5pc1RleHR1cmUpIHtcbiAgICAgIGNvbnN0IHRleHR1cmUgPSB2YWx1ZSBhcyBUSFJFRS5UZXh0dXJlO1xuICAgICAgdGV4dHVyZS5kaXNwb3NlKCk7XG4gICAgfVxuICB9KTtcblxuICBtYXRlcmlhbC5kaXNwb3NlKCk7XG59XG5cbmZ1bmN0aW9uIGRpc3Bvc2Uob2JqZWN0M0Q6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gIGNvbnN0IGdlb21ldHJ5OiBUSFJFRS5CdWZmZXJHZW9tZXRyeSB8IHVuZGVmaW5lZCA9IChvYmplY3QzRCBhcyBhbnkpLmdlb21ldHJ5O1xuICBpZiAoZ2VvbWV0cnkpIHtcbiAgICBnZW9tZXRyeS5kaXNwb3NlKCk7XG4gIH1cblxuICBjb25zdCBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwgfCBUSFJFRS5NYXRlcmlhbFtdID0gKG9iamVjdDNEIGFzIGFueSkubWF0ZXJpYWw7XG4gIGlmIChtYXRlcmlhbCkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGVyaWFsKSkge1xuICAgICAgbWF0ZXJpYWwuZm9yRWFjaCgobWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsKSA9PiBkaXNwb3NlTWF0ZXJpYWwobWF0ZXJpYWwpKTtcbiAgICB9IGVsc2UgaWYgKG1hdGVyaWFsKSB7XG4gICAgICBkaXNwb3NlTWF0ZXJpYWwobWF0ZXJpYWwpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVlcERpc3Bvc2Uob2JqZWN0M0Q6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gIG9iamVjdDNELnRyYXZlcnNlKGRpc3Bvc2UpO1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURlByaW1pdGl2ZSB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGludGVyZmFjZSBWUk1CbGVuZFNoYXBlQmluZCB7XG4gIG1lc2hlczogR0xURlByaW1pdGl2ZVtdO1xuICBtb3JwaFRhcmdldEluZGV4OiBudW1iZXI7XG4gIHdlaWdodDogbnVtYmVyO1xufVxuXG5lbnVtIFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZSB7XG4gIE5VTUJFUixcbiAgVkVDVE9SMixcbiAgVkVDVE9SMyxcbiAgVkVDVE9SNCxcbiAgQ09MT1IsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWUge1xuICBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICBkZWZhdWx0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICB0YXJnZXRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG4gIGRlbHRhVmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yOyAvLyB0YXJnZXRWYWx1ZSAtIGRlZmF1bHRWYWx1ZVxuICB0eXBlOiBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGU7XG59XG5cbmNvbnN0IF92MiA9IG5ldyBUSFJFRS5WZWN0b3IyKCk7XG5jb25zdCBfdjMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3Y0ID0gbmV3IFRIUkVFLlZlY3RvcjQoKTtcbmNvbnN0IF9jb2xvciA9IG5ldyBUSFJFRS5Db2xvcigpO1xuXG4vLyBhbmltYXRpb25NaXhlciDjga7nm6Poppblr77osaHjga/jgIFTY2VuZSDjga7kuK3jgavlhaXjgaPjgabjgYTjgovlv4XopoHjgYzjgYLjgovjgIJcbi8vIOOBneOBruOBn+OCgeOAgeihqOekuuOCquODluOCuOOCp+OCr+ODiOOBp+OBr+OBquOBhOOBkeOCjOOBqeOAgU9iamVjdDNEIOOCkue2meaJv+OBl+OBpiBTY2VuZSDjgavmipXlhaXjgafjgY3jgovjgojjgYbjgavjgZnjgovjgIJcbmV4cG9ydCBjbGFzcyBWUk1CbGVuZFNoYXBlR3JvdXAgZXh0ZW5kcyBUSFJFRS5PYmplY3QzRCB7XG4gIHB1YmxpYyB3ZWlnaHQgPSAwLjA7XG4gIHB1YmxpYyBpc0JpbmFyeSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgX2JpbmRzOiBWUk1CbGVuZFNoYXBlQmluZFtdID0gW107XG4gIHByaXZhdGUgX21hdGVyaWFsVmFsdWVzOiBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoZXhwcmVzc2lvbk5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5uYW1lID0gYEJsZW5kU2hhcGVDb250cm9sbGVyXyR7ZXhwcmVzc2lvbk5hbWV9YDtcblxuICAgIC8vIHRyYXZlcnNlIOaZguOBruaVkea4iOaJi+auteOBqOOBl+OBpiBPYmplY3QzRCDjgafjga/jgarjgYTjgZPjgajjgpLmmI7npLrjgZfjgabjgYrjgY9cbiAgICB0aGlzLnR5cGUgPSAnQmxlbmRTaGFwZUNvbnRyb2xsZXInO1xuICAgIC8vIOihqOekuuebrueahOOBruOCquODluOCuOOCp+OCr+ODiOOBp+OBr+OBquOBhOOBruOBp+OAgeiyoOiNt+i7vea4m+OBruOBn+OCgeOBqyB2aXNpYmxlIOOCkiBmYWxzZSDjgavjgZfjgabjgYrjgY/jgIJcbiAgICAvLyDjgZPjgozjgavjgojjgorjgIHjgZPjga7jgqTjg7Pjgrnjgr/jg7Pjgrnjgavlr77jgZnjgovmr47jg5Xjg6zjg7zjg6Djga4gbWF0cml4IOiHquWLleioiOeul+OCkuecgeeVpeOBp+OBjeOCi+OAglxuICAgIHRoaXMudmlzaWJsZSA9IGZhbHNlO1xuICB9XG5cbiAgcHVibGljIGFkZEJpbmQoYXJnczogeyBtZXNoZXM6IEdMVEZQcmltaXRpdmVbXTsgbW9ycGhUYXJnZXRJbmRleDogbnVtYmVyOyB3ZWlnaHQ6IG51bWJlciB9KTogdm9pZCB7XG4gICAgLy8gb3JpZ2luYWwgd2VpZ2h0IGlzIDAtMTAwIGJ1dCB3ZSB3YW50IHRvIGRlYWwgd2l0aCB0aGlzIHZhbHVlIHdpdGhpbiAwLTFcbiAgICBjb25zdCB3ZWlnaHQgPSBhcmdzLndlaWdodCAvIDEwMDtcblxuICAgIHRoaXMuX2JpbmRzLnB1c2goe1xuICAgICAgbWVzaGVzOiBhcmdzLm1lc2hlcyxcbiAgICAgIG1vcnBoVGFyZ2V0SW5kZXg6IGFyZ3MubW9ycGhUYXJnZXRJbmRleCxcbiAgICAgIHdlaWdodCxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRNYXRlcmlhbFZhbHVlKGFyZ3M6IHtcbiAgICBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XG4gICAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gICAgdGFyZ2V0VmFsdWU6IG51bWJlcltdO1xuICAgIGRlZmF1bHRWYWx1ZT86IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICB9KTogdm9pZCB7XG4gICAgY29uc3QgbWF0ZXJpYWwgPSBhcmdzLm1hdGVyaWFsO1xuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IGFyZ3MucHJvcGVydHlOYW1lO1xuXG4gICAgbGV0IHZhbHVlID0gKG1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXTtcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAvLyBwcm9wZXJ0eSBoYXMgbm90IGJlZW4gZm91bmRcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFsdWUgPSBhcmdzLmRlZmF1bHRWYWx1ZSB8fCB2YWx1ZTtcblxuICAgIGxldCB0eXBlOiBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGU7XG4gICAgbGV0IGRlZmF1bHRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG4gICAgbGV0IHRhcmdldFZhbHVlOiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjtcbiAgICBsZXQgZGVsdGFWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG5cbiAgICBpZiAodmFsdWUuaXNWZWN0b3IyKSB7XG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjI7XG4gICAgICBkZWZhdWx0VmFsdWUgPSAodmFsdWUgYXMgVEhSRUUuVmVjdG9yMikuY2xvbmUoKTtcbiAgICAgIHRhcmdldFZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjIoKS5mcm9tQXJyYXkoYXJncy50YXJnZXRWYWx1ZSk7XG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUuY2xvbmUoKS5zdWIoZGVmYXVsdFZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlLmlzVmVjdG9yMykge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IzO1xuICAgICAgZGVmYXVsdFZhbHVlID0gKHZhbHVlIGFzIFRIUkVFLlZlY3RvcjMpLmNsb25lKCk7XG4gICAgICB0YXJnZXRWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IzKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5pc1ZlY3RvcjQpIHtcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SNDtcbiAgICAgIGRlZmF1bHRWYWx1ZSA9ICh2YWx1ZSBhcyBUSFJFRS5WZWN0b3I0KS5jbG9uZSgpO1xuXG4gICAgICAvLyB2ZWN0b3JQcm9wZXJ0eSBhbmQgdGFyZ2V0VmFsdWUgaW5kZXggaXMgZGlmZmVyZW50IGZyb20gZWFjaCBvdGhlclxuICAgICAgLy8gZXhwb3J0ZWQgdnJtIGJ5IFVuaVZSTSBmaWxlIGlzXG4gICAgICAvL1xuICAgICAgLy8gdmVjdG9yUHJvcGVydHlcbiAgICAgIC8vIG9mZnNldCA9IHRhcmdldFZhbHVlWzBdLCB0YXJnZXRWYWx1ZVsxXVxuICAgICAgLy8gdGlsaW5nID0gdGFyZ2V0VmFsdWVbMl0sIHRhcmdldFZhbHVlWzNdXG4gICAgICAvL1xuICAgICAgLy8gdGFyZ2V0VmFsdWVcbiAgICAgIC8vIG9mZnNldCA9IHRhcmdldFZhbHVlWzJdLCB0YXJnZXRWYWx1ZVszXVxuICAgICAgLy8gdGlsaW5nID0gdGFyZ2V0VmFsdWVbMF0sIHRhcmdldFZhbHVlWzFdXG4gICAgICB0YXJnZXRWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3I0KCkuZnJvbUFycmF5KFtcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVsyXSxcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVszXSxcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVswXSxcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVsxXSxcbiAgICAgIF0pO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5pc0NvbG9yKSB7XG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLkNPTE9SO1xuICAgICAgZGVmYXVsdFZhbHVlID0gKHZhbHVlIGFzIFRIUkVFLkNvbG9yKS5jbG9uZSgpO1xuICAgICAgdGFyZ2V0VmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoKS5mcm9tQXJyYXkoYXJncy50YXJnZXRWYWx1ZSk7XG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUuY2xvbmUoKS5zdWIoZGVmYXVsdFZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5OVU1CRVI7XG4gICAgICBkZWZhdWx0VmFsdWUgPSB2YWx1ZSBhcyBudW1iZXI7XG4gICAgICB0YXJnZXRWYWx1ZSA9IGFyZ3MudGFyZ2V0VmFsdWVbMF07XG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUgLSBkZWZhdWx0VmFsdWU7XG4gICAgfVxuXG4gICAgdGhpcy5fbWF0ZXJpYWxWYWx1ZXMucHVzaCh7XG4gICAgICBtYXRlcmlhbCxcbiAgICAgIHByb3BlcnR5TmFtZSxcbiAgICAgIGRlZmF1bHRWYWx1ZSxcbiAgICAgIHRhcmdldFZhbHVlLFxuICAgICAgZGVsdGFWYWx1ZSxcbiAgICAgIHR5cGUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQXBwbHkgd2VpZ2h0IHRvIGV2ZXJ5IGFzc2lnbmVkIGJsZW5kIHNoYXBlcy5cbiAgICogU2hvdWxkIGJlIGNhbGxlZCB2aWEge0BsaW5rIEJsZW5kU2hhcGVNYXN0ZXIjdXBkYXRlfS5cbiAgICovXG4gIHB1YmxpYyBhcHBseVdlaWdodCgpOiB2b2lkIHtcbiAgICBjb25zdCB3ID0gdGhpcy5pc0JpbmFyeSA/ICh0aGlzLndlaWdodCA8IDAuNSA/IDAuMCA6IDEuMCkgOiB0aGlzLndlaWdodDtcblxuICAgIHRoaXMuX2JpbmRzLmZvckVhY2goKGJpbmQpID0+IHtcbiAgICAgIGJpbmQubWVzaGVzLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgaWYgKCFtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlcykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRCaW5kYFxuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1tiaW5kLm1vcnBoVGFyZ2V0SW5kZXhdICs9IHcgKiBiaW5kLndlaWdodDtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fbWF0ZXJpYWxWYWx1ZXMuZm9yRWFjaCgobWF0ZXJpYWxWYWx1ZSkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdO1xuICAgICAgaWYgKHByb3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXG5cbiAgICAgIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5OVU1CRVIpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBudW1iZXI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdICs9IGRlbHRhVmFsdWUgKiB3O1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IyKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgVEhSRUUuVmVjdG9yMjtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uYWRkKF92Mi5jb3B5KGRlbHRhVmFsdWUpLm11bHRpcGx5U2NhbGFyKHcpKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMykge1xuICAgICAgICBjb25zdCBkZWx0YVZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWx0YVZhbHVlIGFzIFRIUkVFLlZlY3RvcjM7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmFkZChfdjMuY29weShkZWx0YVZhbHVlKS5tdWx0aXBseVNjYWxhcih3KSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjQpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5WZWN0b3I0O1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX3Y0LmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5DT0xPUikge1xuICAgICAgICBjb25zdCBkZWx0YVZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWx0YVZhbHVlIGFzIFRIUkVFLkNvbG9yO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX2NvbG9yLmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXIgcHJldmlvdXNseSBhc3NpZ25lZCBibGVuZCBzaGFwZXMuXG4gICAqL1xuICBwdWJsaWMgY2xlYXJBcHBsaWVkV2VpZ2h0KCk6IHZvaWQge1xuICAgIHRoaXMuX2JpbmRzLmZvckVhY2goKGJpbmQpID0+IHtcbiAgICAgIGJpbmQubWVzaGVzLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgaWYgKCFtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlcykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRCaW5kYFxuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1tiaW5kLm1vcnBoVGFyZ2V0SW5kZXhdID0gMC4wO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl9tYXRlcmlhbFZhbHVlcy5mb3JFYWNoKChtYXRlcmlhbFZhbHVlKSA9PiB7XG4gICAgICBjb25zdCBwcm9wID0gKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV07XG4gICAgICBpZiAocHJvcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkTWF0ZXJpYWxWYWx1ZWBcblxuICAgICAgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLk5VTUJFUikge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBudW1iZXI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdID0gZGVmYXVsdFZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IyKSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVmYXVsdFZhbHVlIGFzIFRIUkVFLlZlY3RvcjI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmNvcHkoZGVmYXVsdFZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMykge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBUSFJFRS5WZWN0b3IzO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5jb3B5KGRlZmF1bHRWYWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjQpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuVmVjdG9yNDtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5DT0xPUikge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBUSFJFRS5Db2xvcjtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiIsIi8vIFR5cGVkb2MgZG9lcyBub3Qgc3VwcG9ydCBleHBvcnQgZGVjbGFyYXRpb25zIHlldFxuLy8gdGhlbiB3ZSBoYXZlIHRvIHVzZSBgbmFtZXNwYWNlYCBpbnN0ZWFkIG9mIGV4cG9ydCBkZWNsYXJhdGlvbnMgZm9yIG5vdy5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1R5cGVTdHJvbmcvdHlwZWRvYy9wdWxsLzgwMVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5hbWVzcGFjZVxuZXhwb3J0IG5hbWVzcGFjZSBWUk1TY2hlbWEge1xuICAvKipcbiAgICogVlJNIGV4dGVuc2lvbiBpcyBmb3IgM2QgaHVtYW5vaWQgYXZhdGFycyAoYW5kIG1vZGVscykgaW4gVlIgYXBwbGljYXRpb25zLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBWUk0ge1xuICAgIGJsZW5kU2hhcGVNYXN0ZXI/OiBCbGVuZFNoYXBlO1xuICAgIC8qKlxuICAgICAqIFZlcnNpb24gb2YgZXhwb3J0ZXIgdGhhdCB2cm0gY3JlYXRlZC4gVW5pVlJNLTAuNTMuMFxuICAgICAqL1xuICAgIGV4cG9ydGVyVmVyc2lvbj86IHN0cmluZztcbiAgICBmaXJzdFBlcnNvbj86IEZpcnN0UGVyc29uO1xuICAgIGh1bWFub2lkPzogSHVtYW5vaWQ7XG4gICAgbWF0ZXJpYWxQcm9wZXJ0aWVzPzogTWF0ZXJpYWxbXTtcbiAgICBtZXRhPzogTWV0YTtcbiAgICBzZWNvbmRhcnlBbmltYXRpb24/OiBTZWNvbmRhcnlBbmltYXRpb247XG4gICAgLyoqXG4gICAgICogVmVyc2lvbiBvZiBWUk0gc3BlY2lmaWNhdGlvbi4gMC4wXG4gICAgICovXG4gICAgc3BlY1ZlcnNpb24/OiBzdHJpbmc7XG4gIH1cblxuICAvKipcbiAgICogQmxlbmRTaGFwZUF2YXRhciBvZiBVbmlWUk1cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZSB7XG4gICAgYmxlbmRTaGFwZUdyb3Vwcz86IEJsZW5kU2hhcGVHcm91cFtdO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBCbGVuZFNoYXBlR3JvdXAge1xuICAgIC8qKlxuICAgICAqIExvdyBsZXZlbCBibGVuZHNoYXBlIHJlZmVyZW5jZXMuXG4gICAgICovXG4gICAgYmluZHM/OiBCbGVuZFNoYXBlQmluZFtdO1xuICAgIC8qKlxuICAgICAqIDAgb3IgMS4gRG8gbm90IGFsbG93IGFuIGludGVybWVkaWF0ZSB2YWx1ZS4gVmFsdWUgc2hvdWxkIHJvdW5kZWRcbiAgICAgKi9cbiAgICBpc0JpbmFyeT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogTWF0ZXJpYWwgYW5pbWF0aW9uIHJlZmVyZW5jZXMuXG4gICAgICovXG4gICAgbWF0ZXJpYWxWYWx1ZXM/OiBCbGVuZFNoYXBlTWF0ZXJpYWxiaW5kW107XG4gICAgLyoqXG4gICAgICogRXhwcmVzc2lvbiBuYW1lXG4gICAgICovXG4gICAgbmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQcmVkZWZpbmVkIEV4cHJlc3Npb24gbmFtZVxuICAgICAqL1xuICAgIHByZXNldE5hbWU/OiBCbGVuZFNoYXBlUHJlc2V0TmFtZTtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZUJpbmQge1xuICAgIGluZGV4PzogbnVtYmVyO1xuICAgIG1lc2g/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogU2tpbm5lZE1lc2hSZW5kZXJlci5TZXRCbGVuZFNoYXBlV2VpZ2h0XG4gICAgICovXG4gICAgd2VpZ2h0PzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBCbGVuZFNoYXBlTWF0ZXJpYWxiaW5kIHtcbiAgICBtYXRlcmlhbE5hbWU/OiBzdHJpbmc7XG4gICAgcHJvcGVydHlOYW1lPzogc3RyaW5nO1xuICAgIHRhcmdldFZhbHVlPzogbnVtYmVyW107XG4gIH1cblxuICAvKipcbiAgICogUHJlZGVmaW5lZCBFeHByZXNzaW9uIG5hbWVcbiAgICovXG4gIGV4cG9ydCBlbnVtIEJsZW5kU2hhcGVQcmVzZXROYW1lIHtcbiAgICBBID0gJ2EnLFxuICAgIEFuZ3J5ID0gJ2FuZ3J5JyxcbiAgICBCbGluayA9ICdibGluaycsXG4gICAgQmxpbmtMID0gJ2JsaW5rX2wnLFxuICAgIEJsaW5rUiA9ICdibGlua19yJyxcbiAgICBFID0gJ2UnLFxuICAgIEZ1biA9ICdmdW4nLFxuICAgIEkgPSAnaScsXG4gICAgSm95ID0gJ2pveScsXG4gICAgTG9va2Rvd24gPSAnbG9va2Rvd24nLFxuICAgIExvb2tsZWZ0ID0gJ2xvb2tsZWZ0JyxcbiAgICBMb29rcmlnaHQgPSAnbG9va3JpZ2h0JyxcbiAgICBMb29rdXAgPSAnbG9va3VwJyxcbiAgICBOZXV0cmFsID0gJ25ldXRyYWwnLFxuICAgIE8gPSAnbycsXG4gICAgU29ycm93ID0gJ3NvcnJvdycsXG4gICAgVSA9ICd1JyxcbiAgICBVbmtub3duID0gJ3Vua25vd24nLFxuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbiB7XG4gICAgLyoqXG4gICAgICogVGhlIGJvbmUgd2hvc2UgcmVuZGVyaW5nIHNob3VsZCBiZSB0dXJuZWQgb2ZmIGluIGZpcnN0LXBlcnNvbiB2aWV3LiBVc3VhbGx5IEhlYWQgaXNcbiAgICAgKiBzcGVjaWZpZWQuXG4gICAgICovXG4gICAgZmlyc3RQZXJzb25Cb25lPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSB0YXJnZXQgcG9zaXRpb24gb2YgdGhlIFZSIGhlYWRzZXQgaW4gZmlyc3QtcGVyc29uIHZpZXcuIEl0IGlzIGFzc3VtZWQgdGhhdCBhbiBvZmZzZXRcbiAgICAgKiBmcm9tIHRoZSBoZWFkIGJvbmUgdG8gdGhlIFZSIGhlYWRzZXQgaXMgYWRkZWQuXG4gICAgICovXG4gICAgZmlyc3RQZXJzb25Cb25lT2Zmc2V0PzogVmVjdG9yMztcbiAgICBsb29rQXRIb3Jpem9udGFsSW5uZXI/OiBGaXJzdFBlcnNvbkRlZ3JlZU1hcDtcbiAgICBsb29rQXRIb3Jpem9udGFsT3V0ZXI/OiBGaXJzdFBlcnNvbkRlZ3JlZU1hcDtcbiAgICAvKipcbiAgICAgKiBFeWUgY29udHJvbGxlciBtb2RlLlxuICAgICAqL1xuICAgIGxvb2tBdFR5cGVOYW1lPzogRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZTtcbiAgICBsb29rQXRWZXJ0aWNhbERvd24/OiBGaXJzdFBlcnNvbkRlZ3JlZU1hcDtcbiAgICBsb29rQXRWZXJ0aWNhbFVwPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgLyoqXG4gICAgICogU3dpdGNoIGRpc3BsYXkgLyB1bmRpc3BsYXkgZm9yIGVhY2ggbWVzaCBpbiBmaXJzdC1wZXJzb24gdmlldyBvciB0aGUgb3RoZXJzLlxuICAgICAqL1xuICAgIG1lc2hBbm5vdGF0aW9ucz86IEZpcnN0UGVyc29uTWVzaGFubm90YXRpb25bXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeWUgY29udHJvbGxlciBzZXR0aW5nLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbkRlZ3JlZU1hcCB7XG4gICAgLyoqXG4gICAgICogTm9uZSBsaW5lYXIgbWFwcGluZyBwYXJhbXMuIHRpbWUsIHZhbHVlLCBpblRhbmdlbnQsIG91dFRhbmdlbnRcbiAgICAgKi9cbiAgICBjdXJ2ZT86IG51bWJlcltdO1xuICAgIC8qKlxuICAgICAqIExvb2sgYXQgaW5wdXQgY2xhbXAgcmFuZ2UgZGVncmVlLlxuICAgICAqL1xuICAgIHhSYW5nZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBMb29rIGF0IG1hcCByYW5nZSBkZWdyZWUgZnJvbSB4UmFuZ2UuXG4gICAgICovXG4gICAgeVJhbmdlPzogbnVtYmVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEV5ZSBjb250cm9sbGVyIG1vZGUuXG4gICAqL1xuICBleHBvcnQgZW51bSBGaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lIHtcbiAgICBCbGVuZFNoYXBlID0gJ0JsZW5kU2hhcGUnLFxuICAgIEJvbmUgPSAnQm9uZScsXG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIEZpcnN0UGVyc29uTWVzaGFubm90YXRpb24ge1xuICAgIGZpcnN0UGVyc29uRmxhZz86IHN0cmluZztcbiAgICBtZXNoPzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBIdW1hbm9pZCB7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmFybVN0cmV0Y2hcbiAgICAgKi9cbiAgICBhcm1TdHJldGNoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5mZWV0U3BhY2luZ1xuICAgICAqL1xuICAgIGZlZXRTcGFjaW5nPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5oYXNUcmFuc2xhdGlvbkRvRlxuICAgICAqL1xuICAgIGhhc1RyYW5zbGF0aW9uRG9GPzogYm9vbGVhbjtcbiAgICBodW1hbkJvbmVzPzogSHVtYW5vaWRCb25lW107XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmxlZ1N0cmV0Y2hcbiAgICAgKi9cbiAgICBsZWdTdHJldGNoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5sb3dlckFybVR3aXN0XG4gICAgICovXG4gICAgbG93ZXJBcm1Ud2lzdD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24ubG93ZXJMZWdUd2lzdFxuICAgICAqL1xuICAgIGxvd2VyTGVnVHdpc3Q/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLnVwcGVyQXJtVHdpc3RcbiAgICAgKi9cbiAgICB1cHBlckFybVR3aXN0PzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi51cHBlckxlZ1R3aXN0XG4gICAgICovXG4gICAgdXBwZXJMZWdUd2lzdD86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgSHVtYW5vaWRCb25lIHtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQuYXhpc0xlbmd0aFxuICAgICAqL1xuICAgIGF4aXNMZW5ndGg/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogSHVtYW4gYm9uZSBuYW1lLlxuICAgICAqL1xuICAgIGJvbmU/OiBIdW1hbm9pZEJvbmVOYW1lO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5MaW1pdC5jZW50ZXJcbiAgICAgKi9cbiAgICBjZW50ZXI/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5MaW1pdC5tYXhcbiAgICAgKi9cbiAgICBtYXg/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5MaW1pdC5taW5cbiAgICAgKi9cbiAgICBtaW4/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFJlZmVyZW5jZSBub2RlIGluZGV4XG4gICAgICovXG4gICAgbm9kZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQudXNlRGVmYXVsdFZhbHVlc1xuICAgICAqL1xuICAgIHVzZURlZmF1bHRWYWx1ZXM/OiBib29sZWFuO1xuICB9XG5cbiAgLyoqXG4gICAqIEh1bWFuIGJvbmUgbmFtZS5cbiAgICovXG4gIGV4cG9ydCBlbnVtIEh1bWFub2lkQm9uZU5hbWUge1xuICAgIENoZXN0ID0gJ2NoZXN0JyxcbiAgICBIZWFkID0gJ2hlYWQnLFxuICAgIEhpcHMgPSAnaGlwcycsXG4gICAgSmF3ID0gJ2phdycsXG4gICAgTGVmdEV5ZSA9ICdsZWZ0RXllJyxcbiAgICBMZWZ0Rm9vdCA9ICdsZWZ0Rm9vdCcsXG4gICAgTGVmdEhhbmQgPSAnbGVmdEhhbmQnLFxuICAgIExlZnRJbmRleERpc3RhbCA9ICdsZWZ0SW5kZXhEaXN0YWwnLFxuICAgIExlZnRJbmRleEludGVybWVkaWF0ZSA9ICdsZWZ0SW5kZXhJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRJbmRleFByb3hpbWFsID0gJ2xlZnRJbmRleFByb3hpbWFsJyxcbiAgICBMZWZ0TGl0dGxlRGlzdGFsID0gJ2xlZnRMaXR0bGVEaXN0YWwnLFxuICAgIExlZnRMaXR0bGVJbnRlcm1lZGlhdGUgPSAnbGVmdExpdHRsZUludGVybWVkaWF0ZScsXG4gICAgTGVmdExpdHRsZVByb3hpbWFsID0gJ2xlZnRMaXR0bGVQcm94aW1hbCcsXG4gICAgTGVmdExvd2VyQXJtID0gJ2xlZnRMb3dlckFybScsXG4gICAgTGVmdExvd2VyTGVnID0gJ2xlZnRMb3dlckxlZycsXG4gICAgTGVmdE1pZGRsZURpc3RhbCA9ICdsZWZ0TWlkZGxlRGlzdGFsJyxcbiAgICBMZWZ0TWlkZGxlSW50ZXJtZWRpYXRlID0gJ2xlZnRNaWRkbGVJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRNaWRkbGVQcm94aW1hbCA9ICdsZWZ0TWlkZGxlUHJveGltYWwnLFxuICAgIExlZnRSaW5nRGlzdGFsID0gJ2xlZnRSaW5nRGlzdGFsJyxcbiAgICBMZWZ0UmluZ0ludGVybWVkaWF0ZSA9ICdsZWZ0UmluZ0ludGVybWVkaWF0ZScsXG4gICAgTGVmdFJpbmdQcm94aW1hbCA9ICdsZWZ0UmluZ1Byb3hpbWFsJyxcbiAgICBMZWZ0U2hvdWxkZXIgPSAnbGVmdFNob3VsZGVyJyxcbiAgICBMZWZ0VGh1bWJEaXN0YWwgPSAnbGVmdFRodW1iRGlzdGFsJyxcbiAgICBMZWZ0VGh1bWJJbnRlcm1lZGlhdGUgPSAnbGVmdFRodW1iSW50ZXJtZWRpYXRlJyxcbiAgICBMZWZ0VGh1bWJQcm94aW1hbCA9ICdsZWZ0VGh1bWJQcm94aW1hbCcsXG4gICAgTGVmdFRvZXMgPSAnbGVmdFRvZXMnLFxuICAgIExlZnRVcHBlckFybSA9ICdsZWZ0VXBwZXJBcm0nLFxuICAgIExlZnRVcHBlckxlZyA9ICdsZWZ0VXBwZXJMZWcnLFxuICAgIE5lY2sgPSAnbmVjaycsXG4gICAgUmlnaHRFeWUgPSAncmlnaHRFeWUnLFxuICAgIFJpZ2h0Rm9vdCA9ICdyaWdodEZvb3QnLFxuICAgIFJpZ2h0SGFuZCA9ICdyaWdodEhhbmQnLFxuICAgIFJpZ2h0SW5kZXhEaXN0YWwgPSAncmlnaHRJbmRleERpc3RhbCcsXG4gICAgUmlnaHRJbmRleEludGVybWVkaWF0ZSA9ICdyaWdodEluZGV4SW50ZXJtZWRpYXRlJyxcbiAgICBSaWdodEluZGV4UHJveGltYWwgPSAncmlnaHRJbmRleFByb3hpbWFsJyxcbiAgICBSaWdodExpdHRsZURpc3RhbCA9ICdyaWdodExpdHRsZURpc3RhbCcsXG4gICAgUmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUgPSAncmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUnLFxuICAgIFJpZ2h0TGl0dGxlUHJveGltYWwgPSAncmlnaHRMaXR0bGVQcm94aW1hbCcsXG4gICAgUmlnaHRMb3dlckFybSA9ICdyaWdodExvd2VyQXJtJyxcbiAgICBSaWdodExvd2VyTGVnID0gJ3JpZ2h0TG93ZXJMZWcnLFxuICAgIFJpZ2h0TWlkZGxlRGlzdGFsID0gJ3JpZ2h0TWlkZGxlRGlzdGFsJyxcbiAgICBSaWdodE1pZGRsZUludGVybWVkaWF0ZSA9ICdyaWdodE1pZGRsZUludGVybWVkaWF0ZScsXG4gICAgUmlnaHRNaWRkbGVQcm94aW1hbCA9ICdyaWdodE1pZGRsZVByb3hpbWFsJyxcbiAgICBSaWdodFJpbmdEaXN0YWwgPSAncmlnaHRSaW5nRGlzdGFsJyxcbiAgICBSaWdodFJpbmdJbnRlcm1lZGlhdGUgPSAncmlnaHRSaW5nSW50ZXJtZWRpYXRlJyxcbiAgICBSaWdodFJpbmdQcm94aW1hbCA9ICdyaWdodFJpbmdQcm94aW1hbCcsXG4gICAgUmlnaHRTaG91bGRlciA9ICdyaWdodFNob3VsZGVyJyxcbiAgICBSaWdodFRodW1iRGlzdGFsID0gJ3JpZ2h0VGh1bWJEaXN0YWwnLFxuICAgIFJpZ2h0VGh1bWJJbnRlcm1lZGlhdGUgPSAncmlnaHRUaHVtYkludGVybWVkaWF0ZScsXG4gICAgUmlnaHRUaHVtYlByb3hpbWFsID0gJ3JpZ2h0VGh1bWJQcm94aW1hbCcsXG4gICAgUmlnaHRUb2VzID0gJ3JpZ2h0VG9lcycsXG4gICAgUmlnaHRVcHBlckFybSA9ICdyaWdodFVwcGVyQXJtJyxcbiAgICBSaWdodFVwcGVyTGVnID0gJ3JpZ2h0VXBwZXJMZWcnLFxuICAgIFNwaW5lID0gJ3NwaW5lJyxcbiAgICBVcHBlckNoZXN0ID0gJ3VwcGVyQ2hlc3QnLFxuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBNYXRlcmlhbCB7XG4gICAgZmxvYXRQcm9wZXJ0aWVzPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICBrZXl3b3JkTWFwPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIHJlbmRlclF1ZXVlPzogbnVtYmVyO1xuICAgIHNoYWRlcj86IHN0cmluZztcbiAgICB0YWdNYXA/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9O1xuICAgIHRleHR1cmVQcm9wZXJ0aWVzPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICB2ZWN0b3JQcm9wZXJ0aWVzPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgTWV0YSB7XG4gICAgLyoqXG4gICAgICogQSBwZXJzb24gd2hvIGNhbiBwZXJmb3JtIHdpdGggdGhpcyBhdmF0YXJcbiAgICAgKi9cbiAgICBhbGxvd2VkVXNlck5hbWU/OiBNZXRhQWxsb3dlZFVzZXJOYW1lO1xuICAgIC8qKlxuICAgICAqIEF1dGhvciBvZiBWUk0gbW9kZWxcbiAgICAgKi9cbiAgICBhdXRob3I/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRm9yIGNvbW1lcmNpYWwgdXNlXG4gICAgICovXG4gICAgY29tbWVyY2lhbFVzc2FnZU5hbWU/OiBNZXRhVXNzYWdlTmFtZTtcbiAgICAvKipcbiAgICAgKiBDb250YWN0IEluZm9ybWF0aW9uIG9mIFZSTSBtb2RlbCBhdXRob3JcbiAgICAgKi9cbiAgICBjb250YWN0SW5mb3JtYXRpb24/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogTGljZW5zZSB0eXBlXG4gICAgICovXG4gICAgbGljZW5zZU5hbWU/OiBNZXRhTGljZW5zZU5hbWU7XG4gICAgLyoqXG4gICAgICogSWYg4oCcT3RoZXLigJ0gaXMgc2VsZWN0ZWQsIHB1dCB0aGUgVVJMIGxpbmsgb2YgdGhlIGxpY2Vuc2UgZG9jdW1lbnQgaGVyZS5cbiAgICAgKi9cbiAgICBvdGhlckxpY2Vuc2VVcmw/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogSWYgdGhlcmUgYXJlIGFueSBjb25kaXRpb25zIG5vdCBtZW50aW9uZWQgYWJvdmUsIHB1dCB0aGUgVVJMIGxpbmsgb2YgdGhlIGxpY2Vuc2UgZG9jdW1lbnRcbiAgICAgKiBoZXJlLlxuICAgICAqL1xuICAgIG90aGVyUGVybWlzc2lvblVybD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2Ugb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgcmVmZXJlbmNlPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBlcm1pc3Npb24gdG8gcGVyZm9ybSBzZXh1YWwgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAgICovXG4gICAgc2V4dWFsVXNzYWdlTmFtZT86IE1ldGFVc3NhZ2VOYW1lO1xuICAgIC8qKlxuICAgICAqIFRodW1ibmFpbCBvZiBWUk0gbW9kZWxcbiAgICAgKi9cbiAgICB0ZXh0dXJlPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRpdGxlIG9mIFZSTSBtb2RlbFxuICAgICAqL1xuICAgIHRpdGxlPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFZlcnNpb24gb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQZXJtaXNzaW9uIHRvIHBlcmZvcm0gdmlvbGVudCBhY3RzIHdpdGggdGhpcyBhdmF0YXJcbiAgICAgKi9cbiAgICB2aW9sZW50VXNzYWdlTmFtZT86IE1ldGFVc3NhZ2VOYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgcGVyc29uIHdobyBjYW4gcGVyZm9ybSB3aXRoIHRoaXMgYXZhdGFyXG4gICAqL1xuICBleHBvcnQgZW51bSBNZXRhQWxsb3dlZFVzZXJOYW1lIHtcbiAgICBFdmVyeW9uZSA9ICdFdmVyeW9uZScsXG4gICAgRXhwbGljaXRseUxpY2Vuc2VkUGVyc29uID0gJ0V4cGxpY2l0bHlMaWNlbnNlZFBlcnNvbicsXG4gICAgT25seUF1dGhvciA9ICdPbmx5QXV0aG9yJyxcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgY29tbWVyY2lhbCB1c2VcbiAgICpcbiAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHNleHVhbCBhY3RzIHdpdGggdGhpcyBhdmF0YXJcbiAgICpcbiAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHZpb2xlbnQgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAqL1xuICBleHBvcnQgZW51bSBNZXRhVXNzYWdlTmFtZSB7XG4gICAgQWxsb3cgPSAnQWxsb3cnLFxuICAgIERpc2FsbG93ID0gJ0Rpc2FsbG93JyxcbiAgfVxuXG4gIC8qKlxuICAgKiBMaWNlbnNlIHR5cGVcbiAgICovXG4gIGV4cG9ydCBlbnVtIE1ldGFMaWNlbnNlTmFtZSB7XG4gICAgQ2MwID0gJ0NDMCcsXG4gICAgQ2NCeSA9ICdDQ19CWScsXG4gICAgQ2NCeU5jID0gJ0NDX0JZX05DJyxcbiAgICBDY0J5TmNOZCA9ICdDQ19CWV9OQ19ORCcsXG4gICAgQ2NCeU5jU2EgPSAnQ0NfQllfTkNfU0EnLFxuICAgIENjQnlOZCA9ICdDQ19CWV9ORCcsXG4gICAgQ2NCeVNhID0gJ0NDX0JZX1NBJyxcbiAgICBPdGhlciA9ICdPdGhlcicsXG4gICAgUmVkaXN0cmlidXRpb25Qcm9oaWJpdGVkID0gJ1JlZGlzdHJpYnV0aW9uX1Byb2hpYml0ZWQnLFxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBzZXR0aW5nIG9mIGF1dG9tYXRpYyBhbmltYXRpb24gb2Ygc3RyaW5nLWxpa2Ugb2JqZWN0cyBzdWNoIGFzIHRhaWxzIGFuZCBoYWlycy5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgU2Vjb25kYXJ5QW5pbWF0aW9uIHtcbiAgICBib25lR3JvdXBzPzogU2Vjb25kYXJ5QW5pbWF0aW9uU3ByaW5nW107XG4gICAgY29sbGlkZXJHcm91cHM/OiBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlcmdyb3VwW107XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvblNwcmluZyB7XG4gICAgLyoqXG4gICAgICogU3BlY2lmeSB0aGUgbm9kZSBpbmRleCBvZiB0aGUgcm9vdCBib25lIG9mIHRoZSBzd2F5aW5nIG9iamVjdC5cbiAgICAgKi9cbiAgICBib25lcz86IG51bWJlcltdO1xuICAgIC8qKlxuICAgICAqIFRoZSByZWZlcmVuY2UgcG9pbnQgb2YgYSBzd2F5aW5nIG9iamVjdCBjYW4gYmUgc2V0IGF0IGFueSBsb2NhdGlvbiBleGNlcHQgdGhlIG9yaWdpbi5cbiAgICAgKiBXaGVuIGltcGxlbWVudGluZyBVSSBtb3Zpbmcgd2l0aCB3YXJwLCB0aGUgcGFyZW50IG5vZGUgdG8gbW92ZSB3aXRoIHdhcnAgY2FuIGJlIHNwZWNpZmllZFxuICAgICAqIGlmIHlvdSBkb24ndCB3YW50IHRvIG1ha2UgdGhlIG9iamVjdCBzd2F5aW5nIHdpdGggd2FycCBtb3ZlbWVudC5cbiAgICAgKi9cbiAgICBjZW50ZXI/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogU3BlY2lmeSB0aGUgaW5kZXggb2YgdGhlIGNvbGxpZGVyIGdyb3VwIGZvciBjb2xsaXNpb25zIHdpdGggc3dheWluZyBvYmplY3RzLlxuICAgICAqL1xuICAgIGNvbGxpZGVyR3JvdXBzPzogbnVtYmVyW107XG4gICAgLyoqXG4gICAgICogQW5ub3RhdGlvbiBjb21tZW50XG4gICAgICovXG4gICAgY29tbWVudD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgcmVzaXN0YW5jZSAoZGVjZWxlcmF0aW9uKSBvZiBhdXRvbWF0aWMgYW5pbWF0aW9uLlxuICAgICAqL1xuICAgIGRyYWdGb3JjZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaGUgZGlyZWN0aW9uIG9mIGdyYXZpdHkuIFNldCAoMCwgLTEsIDApIGZvciBzaW11bGF0aW5nIHRoZSBncmF2aXR5LiBTZXQgKDEsIDAsIDApIGZvclxuICAgICAqIHNpbXVsYXRpbmcgdGhlIHdpbmQuXG4gICAgICovXG4gICAgZ3Jhdml0eURpcj86IFZlY3RvcjM7XG4gICAgLyoqXG4gICAgICogVGhlIHN0cmVuZ3RoIG9mIGdyYXZpdHkuXG4gICAgICovXG4gICAgZ3Jhdml0eVBvd2VyPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSB1c2VkIGZvciB0aGUgY29sbGlzaW9uIGRldGVjdGlvbiB3aXRoIGNvbGxpZGVycy5cbiAgICAgKi9cbiAgICBoaXRSYWRpdXM/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVGhlIHJlc2lsaWVuY2Ugb2YgdGhlIHN3YXlpbmcgb2JqZWN0ICh0aGUgcG93ZXIgb2YgcmV0dXJuaW5nIHRvIHRoZSBpbml0aWFsIHBvc2UpLlxuICAgICAqL1xuICAgIHN0aWZmaW5lc3M/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvbkNvbGxpZGVyZ3JvdXAge1xuICAgIGNvbGxpZGVycz86IFNlY29uZGFyeUFuaW1hdGlvbkNvbGxpZGVyW107XG4gICAgLyoqXG4gICAgICogVGhlIG5vZGUgb2YgdGhlIGNvbGxpZGVyIGdyb3VwIGZvciBzZXR0aW5nIHVwIGNvbGxpc2lvbiBkZXRlY3Rpb25zLlxuICAgICAqL1xuICAgIG5vZGU/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvbkNvbGxpZGVyIHtcbiAgICAvKipcbiAgICAgKiBUaGUgbG9jYWwgY29vcmRpbmF0ZSBmcm9tIHRoZSBub2RlIG9mIHRoZSBjb2xsaWRlciBncm91cC5cbiAgICAgKi9cbiAgICBvZmZzZXQ/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFRoZSByYWRpdXMgb2YgdGhlIGNvbGxpZGVyLlxuICAgICAqL1xuICAgIHJhZGl1cz86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgVmVjdG9yMyB7XG4gICAgeD86IG51bWJlcjtcbiAgICB5PzogbnVtYmVyO1xuICAgIHo/OiBudW1iZXI7XG4gIH1cbn1cbiIsImltcG9ydCB0eXBlIHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xuaW1wb3J0IHR5cGUgeyBHTFRGUHJpbWl0aXZlLCBHTFRGU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5mdW5jdGlvbiBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsKGdsdGY6IEdMVEYsIG5vZGVJbmRleDogbnVtYmVyLCBub2RlOiBUSFJFRS5PYmplY3QzRCk6IEdMVEZQcmltaXRpdmVbXSB8IG51bGwge1xuICAvKipcbiAgICogTGV0J3MgbGlzdCB1cCBldmVyeSBwb3NzaWJsZSBwYXR0ZXJucyB0aGF0IHBhcnNlZCBnbHRmIG5vZGVzIHdpdGggYSBtZXNoIGNhbiBoYXZlLCwsXG4gICAqXG4gICAqIFwiKlwiIGluZGljYXRlcyB0aGF0IHRob3NlIG1lc2hlcyBzaG91bGQgYmUgbGlzdGVkIHVwIHVzaW5nIHRoaXMgZnVuY3Rpb25cbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIGEgc2lnbmxlIHByaW1pdGl2ZSlcbiAgICpcbiAgICogLSBgVEhSRUUuTWVzaGA6IFRoZSBvbmx5IHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgYSBzaW5nbGUgcHJpbWl0aXZlKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIGEgTUVTSCBPRiBUSEUgQ0hJTERcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGRcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGQgKDIpXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXG4gICAqXG4gICAqIC0gYFRIUkVFLkJvbmVgOiBUaGUgcm9vdCBvZiB0aGUgbm9kZSwgYXMgYSBib25lXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXG4gICAqXG4gICAqIC0gYFRIUkVFLkJvbmVgOiBUaGUgcm9vdCBvZiB0aGUgbm9kZSwgYXMgYSBib25lXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZCAoMilcbiAgICpcbiAgICogLi4uSSB3aWxsIHRha2UgYSBzdHJhdGVneSB0aGF0IHRyYXZlcnNlcyB0aGUgcm9vdCBvZiB0aGUgbm9kZSBhbmQgdGFrZSBmaXJzdCAocHJpbWl0aXZlQ291bnQpIG1lc2hlcy5cbiAgICovXG5cbiAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIG5vZGUgaGFzIGEgbWVzaFxuICBjb25zdCBzY2hlbWFOb2RlOiBHTFRGU2NoZW1hLk5vZGUgPSBnbHRmLnBhcnNlci5qc29uLm5vZGVzW25vZGVJbmRleF07XG4gIGNvbnN0IG1lc2hJbmRleCA9IHNjaGVtYU5vZGUubWVzaDtcbiAgaWYgKG1lc2hJbmRleCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBIb3cgbWFueSBwcmltaXRpdmVzIHRoZSBtZXNoIGhhcz9cbiAgY29uc3Qgc2NoZW1hTWVzaDogR0xURlNjaGVtYS5NZXNoID0gZ2x0Zi5wYXJzZXIuanNvbi5tZXNoZXNbbWVzaEluZGV4XTtcbiAgY29uc3QgcHJpbWl0aXZlQ291bnQgPSBzY2hlbWFNZXNoLnByaW1pdGl2ZXMubGVuZ3RoO1xuXG4gIC8vIFRyYXZlcnNlIHRoZSBub2RlIGFuZCB0YWtlIGZpcnN0IChwcmltaXRpdmVDb3VudCkgbWVzaGVzXG4gIGNvbnN0IHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXSA9IFtdO1xuICBub2RlLnRyYXZlcnNlKChvYmplY3QpID0+IHtcbiAgICBpZiAocHJpbWl0aXZlcy5sZW5ndGggPCBwcmltaXRpdmVDb3VudCkge1xuICAgICAgaWYgKChvYmplY3QgYXMgYW55KS5pc01lc2gpIHtcbiAgICAgICAgcHJpbWl0aXZlcy5wdXNoKG9iamVjdCBhcyBHTFRGUHJpbWl0aXZlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBwcmltaXRpdmVzO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgcHJpbWl0aXZlcyAoIGBUSFJFRS5NZXNoW11gICkgb2YgYSBub2RlIGZyb20gYSBsb2FkZWQgR0xURi5cbiAqIFRoZSBtYWluIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBkaXN0aW5ndWlzaCBwcmltaXRpdmVzIGFuZCBjaGlsZHJlbiBmcm9tIGEgbm9kZSB0aGF0IGhhcyBib3RoIG1lc2hlcyBhbmQgY2hpbGRyZW4uXG4gKlxuICogSXQgdXRpbGl6ZXMgdGhlIGJlaGF2aW9yIHRoYXQgR0xURkxvYWRlciBhZGRzIG1lc2ggcHJpbWl0aXZlcyB0byB0aGUgbm9kZSBvYmplY3QgKCBgVEhSRUUuR3JvdXBgICkgZmlyc3QgdGhlbiBhZGRzIGl0cyBjaGlsZHJlbi5cbiAqXG4gKiBAcGFyYW0gZ2x0ZiBBIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxuICogQHBhcmFtIG5vZGVJbmRleCBUaGUgaW5kZXggb2YgdGhlIG5vZGVcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlKGdsdGY6IEdMVEYsIG5vZGVJbmRleDogbnVtYmVyKTogUHJvbWlzZTxHTFRGUHJpbWl0aXZlW10gfCBudWxsPiB7XG4gIGNvbnN0IG5vZGU6IFRIUkVFLk9iamVjdDNEID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIG5vZGVJbmRleCk7XG4gIHJldHVybiBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsKGdsdGYsIG5vZGVJbmRleCwgbm9kZSk7XG59XG5cbi8qKlxuICogRXh0cmFjdCBwcmltaXRpdmVzICggYFRIUkVFLk1lc2hbXWAgKSBvZiBub2RlcyBmcm9tIGEgbG9hZGVkIEdMVEYuXG4gKiBTZWUge0BsaW5rIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlfSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIEl0IHJldHVybnMgYSBtYXAgZnJvbSBub2RlIGluZGV4IHRvIGV4dHJhY3Rpb24gcmVzdWx0LlxuICogSWYgYSBub2RlIGRvZXMgbm90IGhhdmUgYSBtZXNoLCB0aGUgZW50cnkgZm9yIHRoZSBub2RlIHdpbGwgbm90IGJlIHB1dCBpbiB0aGUgcmV0dXJuaW5nIG1hcC5cbiAqXG4gKiBAcGFyYW0gZ2x0ZiBBIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGY6IEdMVEYpOiBQcm9taXNlPE1hcDxudW1iZXIsIEdMVEZQcmltaXRpdmVbXT4+IHtcbiAgY29uc3Qgbm9kZXM6IFRIUkVFLk9iamVjdDNEW10gPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmNpZXMoJ25vZGUnKTtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxudW1iZXIsIEdMVEZQcmltaXRpdmVbXT4oKTtcblxuICBub2Rlcy5mb3JFYWNoKChub2RlLCBpbmRleCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWwoZ2x0ZiwgaW5kZXgsIG5vZGUpO1xuICAgIGlmIChyZXN1bHQgIT0gbnVsbCkge1xuICAgICAgbWFwLnNldChpbmRleCwgcmVzdWx0KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBtYXA7XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAobmFtZVswXSAhPT0gJ18nKSB7XG4gICAgY29uc29sZS53YXJuKGByZW5hbWVNYXRlcmlhbFByb3BlcnR5OiBHaXZlbiBwcm9wZXJ0eSBuYW1lIFwiJHtuYW1lfVwiIG1pZ2h0IGJlIGludmFsaWRgKTtcbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoMSk7XG5cbiAgaWYgKCEvW0EtWl0vLnRlc3QobmFtZVswXSkpIHtcbiAgICBjb25zb2xlLndhcm4oYHJlbmFtZU1hdGVyaWFsUHJvcGVydHk6IEdpdmVuIHByb3BlcnR5IG5hbWUgXCIke25hbWV9XCIgbWlnaHQgYmUgaW52YWxpZGApO1xuICAgIHJldHVybiBuYW1lO1xuICB9XG4gIHJldHVybiBuYW1lWzBdLnRvTG93ZXJDYXNlKCkgKyBuYW1lLnN1YnN0cmluZygxKTtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuLyoqXG4gKiBDbGFtcCBhbiBpbnB1dCBudW1iZXIgd2l0aGluIFsgYDAuMGAgLSBgMS4wYCBdLlxuICpcbiAqIEBwYXJhbSB2YWx1ZSBUaGUgaW5wdXQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNhdHVyYXRlKHZhbHVlOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4odmFsdWUsIDEuMCksIDAuMCk7XG59XG5cbi8qKlxuICogTWFwIHRoZSByYW5nZSBvZiBhbiBpbnB1dCB2YWx1ZSBmcm9tIFsgYG1pbmAgLSBgbWF4YCBdIHRvIFsgYDAuMGAgLSBgMS4wYCBdLlxuICogSWYgaW5wdXQgdmFsdWUgaXMgbGVzcyB0aGFuIGBtaW5gICwgaXQgcmV0dXJucyBgMC4wYC5cbiAqIElmIGlucHV0IHZhbHVlIGlzIGdyZWF0ZXIgdGhhbiBgbWF4YCAsIGl0IHJldHVybnMgYDEuMGAuXG4gKlxuICogU2VlIGFsc286IGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL21hdGgvTWF0aC5zbW9vdGhzdGVwXG4gKlxuICogQHBhcmFtIHggVGhlIHZhbHVlIHRoYXQgd2lsbCBiZSBtYXBwZWQgaW50byB0aGUgc3BlY2lmaWVkIHJhbmdlXG4gKiBAcGFyYW0gbWluIE1pbmltdW0gdmFsdWUgb2YgdGhlIHJhbmdlXG4gKiBAcGFyYW0gbWF4IE1heGltdW0gdmFsdWUgb2YgdGhlIHJhbmdlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsaW5zdGVwKHg6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcbiAgaWYgKHggPD0gbWluKSByZXR1cm4gMDtcbiAgaWYgKHggPj0gbWF4KSByZXR1cm4gMTtcblxuICByZXR1cm4gKHggLSBtaW4pIC8gKG1heCAtIG1pbik7XG59XG5cbmNvbnN0IF9wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfc2NhbGUgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3JvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuLyoqXG4gKiBFeHRyYWN0IHdvcmxkIHBvc2l0aW9uIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxuICpcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdFxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRXb3JsZFBvc2l0aW9uTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShvdXQsIF9yb3RhdGlvbiwgX3NjYWxlKTtcbiAgcmV0dXJuIG91dDtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHdvcmxkIHNjYWxlIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxuICpcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdFxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRXb3JsZFNjYWxlTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShfcG9zaXRpb24sIF9yb3RhdGlvbiwgb3V0KTtcbiAgcmV0dXJuIG91dDtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHdvcmxkIHJvdGF0aW9uIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxuICpcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdFxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRXb3JsZFF1YXRlcm5pb25MaXRlKG9iamVjdDogVEhSRUUuT2JqZWN0M0QsIG91dDogVEhSRUUuUXVhdGVybmlvbik6IFRIUkVFLlF1YXRlcm5pb24ge1xuICBvYmplY3QubWF0cml4V29ybGQuZGVjb21wb3NlKF9wb3NpdGlvbiwgb3V0LCBfc2NhbGUpO1xuICByZXR1cm4gb3V0O1xufVxuIiwiaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgc2F0dXJhdGUgfSBmcm9tICcuLi91dGlscy9tYXRoJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVHcm91cCB9IGZyb20gJy4vVlJNQmxlbmRTaGFwZUdyb3VwJztcblxuZXhwb3J0IGNsYXNzIFZSTUJsZW5kU2hhcGVQcm94eSB7XG4gIC8qKlxuICAgKiBMaXN0IG9mIHJlZ2lzdGVyZWQgYmxlbmQgc2hhcGUuXG4gICAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF9ibGVuZFNoYXBlR3JvdXBzOiB7IFtuYW1lOiBzdHJpbmddOiBWUk1CbGVuZFNoYXBlR3JvdXAgfSA9IHt9O1xuXG4gIC8qKlxuICAgKiBBIG1hcCBmcm9tIFtbVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXV0gdG8gaXRzIGFjdHVhbCBibGVuZCBzaGFwZSBuYW1lLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZVByZXNldE1hcDogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0gPSB7fTtcblxuICAvKipcbiAgICogQSBsaXN0IG9mIG5hbWUgb2YgdW5rbm93biBibGVuZCBzaGFwZXMuXG4gICAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF91bmtub3duR3JvdXBOYW1lczogc3RyaW5nW10gPSBbXTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUJsZW5kU2hhcGUuXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gZG8gbm90aGluZ1xuICB9XG5cbiAgLyoqXG4gICAqIExpc3Qgb2YgbmFtZSBvZiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKi9cbiAgcHVibGljIGdldCBleHByZXNzaW9ucygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbWFwIGZyb20gW1tWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdXSB0byBpdHMgYWN0dWFsIGJsZW5kIHNoYXBlIG5hbWUuXG4gICAqL1xuICBwdWJsaWMgZ2V0IGJsZW5kU2hhcGVQcmVzZXRNYXAoKTogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0ge1xuICAgIHJldHVybiB0aGlzLl9ibGVuZFNoYXBlUHJlc2V0TWFwO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbGlzdCBvZiBuYW1lIG9mIHVua25vd24gYmxlbmQgc2hhcGVzLlxuICAgKi9cbiAgcHVibGljIGdldCB1bmtub3duR3JvdXBOYW1lcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMuX3Vua25vd25Hcm91cE5hbWVzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxuICAgKi9cbiAgcHVibGljIGdldEJsZW5kU2hhcGVHcm91cChuYW1lOiBzdHJpbmcgfCBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUpOiBWUk1CbGVuZFNoYXBlR3JvdXAgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHByZXNldE5hbWUgPSB0aGlzLl9ibGVuZFNoYXBlUHJlc2V0TWFwW25hbWUgYXMgVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXTtcbiAgICBjb25zdCBjb250cm9sbGVyID0gcHJlc2V0TmFtZSA/IHRoaXMuX2JsZW5kU2hhcGVHcm91cHNbcHJlc2V0TmFtZV0gOiB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdO1xuICAgIGlmICghY29udHJvbGxlcikge1xuICAgICAgY29uc29sZS53YXJuKGBubyBibGVuZCBzaGFwZSBmb3VuZCBieSAke25hbWV9YCk7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gY29udHJvbGxlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBnb3J1cFxuICAgKiBAcGFyYW0gY29udHJvbGxlciBWUk1CbGVuZFNoYXBlQ29udHJvbGxlciB0aGF0IGRlc2NyaWJlcyB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICovXG4gIHB1YmxpYyByZWdpc3RlckJsZW5kU2hhcGVHcm91cChcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcHJlc2V0TmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgdW5kZWZpbmVkLFxuICAgIGNvbnRyb2xsZXI6IFZSTUJsZW5kU2hhcGVHcm91cCxcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXSA9IGNvbnRyb2xsZXI7XG4gICAgaWYgKHByZXNldE5hbWUpIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcmVzZXRNYXBbcHJlc2V0TmFtZV0gPSBuYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl91bmtub3duR3JvdXBOYW1lcy5wdXNoKG5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY3VycmVudCB3ZWlnaHQgb2Ygc3BlY2lmaWVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxuICAgKi9cbiAgcHVibGljIGdldFZhbHVlKG5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmdldEJsZW5kU2hhcGVHcm91cChuYW1lKTtcbiAgICByZXR1cm4gY29udHJvbGxlcj8ud2VpZ2h0ID8/IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogU2V0IGEgd2VpZ2h0IHRvIHNwZWNpZmllZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICogQHBhcmFtIHdlaWdodCBXZWlnaHRcbiAgICovXG4gIHB1YmxpYyBzZXRWYWx1ZShuYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCBzdHJpbmcsIHdlaWdodDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgY29udHJvbGxlciA9IHRoaXMuZ2V0QmxlbmRTaGFwZUdyb3VwKG5hbWUpO1xuICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICBjb250cm9sbGVyLndlaWdodCA9IHNhdHVyYXRlKHdlaWdodCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHRyYWNrIG5hbWUgb2Ygc3BlY2lmaWVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKiBUaGlzIHRyYWNrIG5hbWUgaXMgbmVlZGVkIHRvIG1hbmlwdWxhdGUgaXRzIGJsZW5kIHNoYXBlIGdyb3VwIHZpYSBrZXlmcmFtZSBhbmltYXRpb25zLlxuICAgKlxuICAgKiBAZXhhbXBsZSBNYW5pcHVsYXRlIGEgYmxlbmQgc2hhcGUgZ3JvdXAgdXNpbmcga2V5ZnJhbWUgYW5pbWF0aW9uXG4gICAqIGBgYGpzXG4gICAqIGNvbnN0IHRyYWNrTmFtZSA9IHZybS5ibGVuZFNoYXBlUHJveHkuZ2V0QmxlbmRTaGFwZVRyYWNrTmFtZSggVEhSRUUuVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkJsaW5rICk7XG4gICAqIGNvbnN0IHRyYWNrID0gbmV3IFRIUkVFLk51bWJlcktleWZyYW1lVHJhY2soXG4gICAqICAgbmFtZSxcbiAgICogICBbIDAuMCwgMC41LCAxLjAgXSwgLy8gdGltZXNcbiAgICogICBbIDAuMCwgMS4wLCAwLjAgXSAvLyB2YWx1ZXNcbiAgICogKTtcbiAgICpcbiAgICogY29uc3QgY2xpcCA9IG5ldyBUSFJFRS5BbmltYXRpb25DbGlwKFxuICAgKiAgICdibGluaycsIC8vIG5hbWVcbiAgICogICAxLjAsIC8vIGR1cmF0aW9uXG4gICAqICAgWyB0cmFjayBdIC8vIHRyYWNrc1xuICAgKiApO1xuICAgKlxuICAgKiBjb25zdCBtaXhlciA9IG5ldyBUSFJFRS5BbmltYXRpb25NaXhlciggdnJtLnNjZW5lICk7XG4gICAqIGNvbnN0IGFjdGlvbiA9IG1peGVyLmNsaXBBY3Rpb24oIGNsaXAgKTtcbiAgICogYWN0aW9uLnBsYXkoKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJsZW5kIHNoYXBlIGdyb3VwXG4gICAqL1xuICBwdWJsaWMgZ2V0QmxlbmRTaGFwZVRyYWNrTmFtZShuYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5nZXRCbGVuZFNoYXBlR3JvdXAobmFtZSk7XG4gICAgcmV0dXJuIGNvbnRyb2xsZXIgPyBgJHtjb250cm9sbGVyLm5hbWV9LndlaWdodGAgOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBldmVyeSBibGVuZCBzaGFwZSBncm91cHMuXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlKCk6IHZvaWQge1xuICAgIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdO1xuICAgICAgY29udHJvbGxlci5jbGVhckFwcGxpZWRXZWlnaHQoKTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdO1xuICAgICAgY29udHJvbGxlci5hcHBseVdlaWdodCgpO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlcic7XG5pbXBvcnQgeyBHTFRGU2NoZW1hLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSB9IGZyb20gJy4uL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlJztcbmltcG9ydCB7IHJlbmFtZU1hdGVyaWFsUHJvcGVydHkgfSBmcm9tICcuLi91dGlscy9yZW5hbWVNYXRlcmlhbFByb3BlcnR5JztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVHcm91cCB9IGZyb20gJy4vVlJNQmxlbmRTaGFwZUdyb3VwJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4vVlJNQmxlbmRTaGFwZVByb3h5JztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUJsZW5kU2hhcGVdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1CbGVuZFNoYXBlSW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1CbGVuZFNoYXBlXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTUJsZW5kU2hhcGVQcm94eSB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hQmxlbmRTaGFwZTogVlJNU2NoZW1hLkJsZW5kU2hhcGUgfCB1bmRlZmluZWQgPSB2cm1FeHQuYmxlbmRTaGFwZU1hc3RlcjtcbiAgICBpZiAoIXNjaGVtYUJsZW5kU2hhcGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGJsZW5kU2hhcGUgPSBuZXcgVlJNQmxlbmRTaGFwZVByb3h5KCk7XG5cbiAgICBjb25zdCBibGVuZFNoYXBlR3JvdXBzOiBWUk1TY2hlbWEuQmxlbmRTaGFwZUdyb3VwW10gfCB1bmRlZmluZWQgPSBzY2hlbWFCbGVuZFNoYXBlLmJsZW5kU2hhcGVHcm91cHM7XG4gICAgaWYgKCFibGVuZFNoYXBlR3JvdXBzKSB7XG4gICAgICByZXR1cm4gYmxlbmRTaGFwZTtcbiAgICB9XG5cbiAgICBjb25zdCBibGVuZFNoYXBlUHJlc2V0TWFwOiB7IFtwcmVzZXROYW1lIGluIFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV0/OiBzdHJpbmcgfSA9IHt9O1xuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBibGVuZFNoYXBlR3JvdXBzLm1hcChhc3luYyAoc2NoZW1hR3JvdXApID0+IHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHNjaGVtYUdyb3VwLm5hbWU7XG4gICAgICAgIGlmIChuYW1lID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1ZSTUJsZW5kU2hhcGVJbXBvcnRlcjogT25lIG9mIGJsZW5kU2hhcGVHcm91cHMgaGFzIG5vIG5hbWUnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJlc2V0TmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgdW5kZWZpbmVkO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2NoZW1hR3JvdXAucHJlc2V0TmFtZSAmJlxuICAgICAgICAgIHNjaGVtYUdyb3VwLnByZXNldE5hbWUgIT09IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Vbmtub3duICYmXG4gICAgICAgICAgIWJsZW5kU2hhcGVQcmVzZXRNYXBbc2NoZW1hR3JvdXAucHJlc2V0TmFtZV1cbiAgICAgICAgKSB7XG4gICAgICAgICAgcHJlc2V0TmFtZSA9IHNjaGVtYUdyb3VwLnByZXNldE5hbWU7XG4gICAgICAgICAgYmxlbmRTaGFwZVByZXNldE1hcFtzY2hlbWFHcm91cC5wcmVzZXROYW1lXSA9IG5hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncm91cCA9IG5ldyBWUk1CbGVuZFNoYXBlR3JvdXAobmFtZSk7XG4gICAgICAgIGdsdGYuc2NlbmUuYWRkKGdyb3VwKTtcblxuICAgICAgICBncm91cC5pc0JpbmFyeSA9IHNjaGVtYUdyb3VwLmlzQmluYXJ5IHx8IGZhbHNlO1xuXG4gICAgICAgIGlmIChzY2hlbWFHcm91cC5iaW5kcykge1xuICAgICAgICAgIHNjaGVtYUdyb3VwLmJpbmRzLmZvckVhY2goYXN5bmMgKGJpbmQpID0+IHtcbiAgICAgICAgICAgIGlmIChiaW5kLm1lc2ggPT09IHVuZGVmaW5lZCB8fCBiaW5kLmluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2Rlc1VzaW5nTWVzaDogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgIChnbHRmLnBhcnNlci5qc29uLm5vZGVzIGFzIEdMVEZTY2hlbWEuTm9kZVtdKS5mb3JFYWNoKChub2RlLCBpKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChub2RlLm1lc2ggPT09IGJpbmQubWVzaCkge1xuICAgICAgICAgICAgICAgIG5vZGVzVXNpbmdNZXNoLnB1c2goaSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBtb3JwaFRhcmdldEluZGV4ID0gYmluZC5pbmRleDtcblxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgIG5vZGVzVXNpbmdNZXNoLm1hcChhc3luYyAobm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlcyA9IChhd2FpdCBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZShnbHRmLCBub2RlSW5kZXgpKSE7XG5cbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiB0aGUgbWVzaCBoYXMgdGhlIHRhcmdldCBtb3JwaCB0YXJnZXRcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAhcHJpbWl0aXZlcy5ldmVyeShcbiAgICAgICAgICAgICAgICAgICAgKHByaW1pdGl2ZSkgPT5cbiAgICAgICAgICAgICAgICAgICAgICBBcnJheS5pc0FycmF5KHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMpICYmXG4gICAgICAgICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCA8IHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgICAgICBgVlJNQmxlbmRTaGFwZUltcG9ydGVyOiAke3NjaGVtYUdyb3VwLm5hbWV9IGF0dGVtcHRzIHRvIGluZGV4ICR7bW9ycGhUYXJnZXRJbmRleH10aCBtb3JwaCBidXQgbm90IGZvdW5kLmAsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGdyb3VwLmFkZEJpbmQoe1xuICAgICAgICAgICAgICAgICAgbWVzaGVzOiBwcmltaXRpdmVzLFxuICAgICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCxcbiAgICAgICAgICAgICAgICAgIHdlaWdodDogYmluZC53ZWlnaHQgPz8gMTAwLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYXRlcmlhbFZhbHVlcyA9IHNjaGVtYUdyb3VwLm1hdGVyaWFsVmFsdWVzO1xuICAgICAgICBpZiAobWF0ZXJpYWxWYWx1ZXMpIHtcbiAgICAgICAgICBtYXRlcmlhbFZhbHVlcy5mb3JFYWNoKChtYXRlcmlhbFZhbHVlKSA9PiB7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICAgbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWUgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICBtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlID09PSB1bmRlZmluZWRcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsczogVEhSRUUuTWF0ZXJpYWxbXSA9IFtdO1xuICAgICAgICAgICAgZ2x0Zi5zY2VuZS50cmF2ZXJzZSgob2JqZWN0KSA9PiB7XG4gICAgICAgICAgICAgIGlmICgob2JqZWN0IGFzIGFueSkubWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWxbXSB8IFRIUkVFLk1hdGVyaWFsID0gKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGVyaWFsKSkge1xuICAgICAgICAgICAgICAgICAgbWF0ZXJpYWxzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIC4uLm1hdGVyaWFsLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgICAobXRsKSA9PiBtdGwubmFtZSA9PT0gbWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbE5hbWUhICYmIG1hdGVyaWFscy5pbmRleE9mKG10bCkgPT09IC0xLFxuICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsLm5hbWUgPT09IG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lICYmIG1hdGVyaWFscy5pbmRleE9mKG1hdGVyaWFsKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKG1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBtYXRlcmlhbHMuZm9yRWFjaCgobWF0ZXJpYWwpID0+IHtcbiAgICAgICAgICAgICAgZ3JvdXAuYWRkTWF0ZXJpYWxWYWx1ZSh7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlOYW1lOiByZW5hbWVNYXRlcmlhbFByb3BlcnR5KG1hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lISksXG4gICAgICAgICAgICAgICAgdGFyZ2V0VmFsdWU6IG1hdGVyaWFsVmFsdWUudGFyZ2V0VmFsdWUhLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgYmxlbmRTaGFwZS5yZWdpc3RlckJsZW5kU2hhcGVHcm91cChuYW1lLCBwcmVzZXROYW1lLCBncm91cCk7XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcmV0dXJuIGJsZW5kU2hhcGU7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEZOb2RlLCBHTFRGUHJpbWl0aXZlIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSB9IGZyb20gJy4uL3V0aWxzL21hdGgnO1xuXG5jb25zdCBWRUNUT1IzX0ZST05UID0gT2JqZWN0LmZyZWV6ZShuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgLTEuMCkpO1xuXG5jb25zdCBfcXVhdCA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5cbmVudW0gRmlyc3RQZXJzb25GbGFnIHtcbiAgQXV0byxcbiAgQm90aCxcbiAgVGhpcmRQZXJzb25Pbmx5LFxuICBGaXJzdFBlcnNvbk9ubHksXG59XG5cbi8qKlxuICogVGhpcyBjbGFzcyByZXByZXNlbnRzIGEgc2luZ2xlIFtgbWVzaEFubm90YXRpb25gXShodHRwczovL2dpdGh1Yi5jb20vdnJtLWMvVW5pVlJNL2Jsb2IvbWFzdGVyL3NwZWNpZmljYXRpb24vMC4wL3NjaGVtYS92cm0uZmlyc3RwZXJzb24ubWVzaGFubm90YXRpb24uc2NoZW1hLmpzb24pIGVudHJ5LlxuICogRWFjaCBtZXNoIHdpbGwgYmUgYXNzaWduZWQgdG8gc3BlY2lmaWVkIGxheWVyIHdoZW4geW91IGNhbGwgW1tWUk1GaXJzdFBlcnNvbi5zZXR1cF1dLlxuICovXG5leHBvcnQgY2xhc3MgVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzIHtcbiAgcHJpdmF0ZSBzdGF0aWMgX3BhcnNlRmlyc3RQZXJzb25GbGFnKGZpcnN0UGVyc29uRmxhZzogc3RyaW5nIHwgdW5kZWZpbmVkKTogRmlyc3RQZXJzb25GbGFnIHtcbiAgICBzd2l0Y2ggKGZpcnN0UGVyc29uRmxhZykge1xuICAgICAgY2FzZSAnQm90aCc6XG4gICAgICAgIHJldHVybiBGaXJzdFBlcnNvbkZsYWcuQm90aDtcbiAgICAgIGNhc2UgJ1RoaXJkUGVyc29uT25seSc6XG4gICAgICAgIHJldHVybiBGaXJzdFBlcnNvbkZsYWcuVGhpcmRQZXJzb25Pbmx5O1xuICAgICAgY2FzZSAnRmlyc3RQZXJzb25Pbmx5JzpcbiAgICAgICAgcmV0dXJuIEZpcnN0UGVyc29uRmxhZy5GaXJzdFBlcnNvbk9ubHk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gRmlyc3RQZXJzb25GbGFnLkF1dG87XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEEgW1tGaXJzdFBlcnNvbkZsYWddXSBvZiB0aGUgYW5ub3RhdGlvbiBlbnRyeS5cbiAgICovXG4gIHB1YmxpYyBmaXJzdFBlcnNvbkZsYWc6IEZpcnN0UGVyc29uRmxhZztcblxuICAvKipcbiAgICogQSBtZXNoIHByaW1pdGl2ZXMgb2YgdGhlIGFubm90YXRpb24gZW50cnkuXG4gICAqL1xuICBwdWJsaWMgcHJpbWl0aXZlczogR0xURlByaW1pdGl2ZVtdO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbWVzaCBhbm5vdGF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb25GbGFnIEEgW1tGaXJzdFBlcnNvbkZsYWddXSBvZiB0aGUgYW5ub3RhdGlvbiBlbnRyeVxuICAgKiBAcGFyYW0gbm9kZSBBIG5vZGUgb2YgdGhlIGFubm90YXRpb24gZW50cnkuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihmaXJzdFBlcnNvbkZsYWc6IHN0cmluZyB8IHVuZGVmaW5lZCwgcHJpbWl0aXZlczogR0xURlByaW1pdGl2ZVtdKSB7XG4gICAgdGhpcy5maXJzdFBlcnNvbkZsYWcgPSBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3MuX3BhcnNlRmlyc3RQZXJzb25GbGFnKGZpcnN0UGVyc29uRmxhZyk7XG4gICAgdGhpcy5wcmltaXRpdmVzID0gcHJpbWl0aXZlcztcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVlJNRmlyc3RQZXJzb24ge1xuICAvKipcbiAgICogQSBkZWZhdWx0IGNhbWVyYSBsYXllciBmb3IgYEZpcnN0UGVyc29uT25seWAgbGF5ZXIuXG4gICAqXG4gICAqIEBzZWUgW1tnZXRGaXJzdFBlcnNvbk9ubHlMYXllcl1dXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBfREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSID0gOTtcblxuICAvKipcbiAgICogQSBkZWZhdWx0IGNhbWVyYSBsYXllciBmb3IgYFRoaXJkUGVyc29uT25seWAgbGF5ZXIuXG4gICAqXG4gICAqIEBzZWUgW1tnZXRUaGlyZFBlcnNvbk9ubHlMYXllcl1dXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBfREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSID0gMTA7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfZmlyc3RQZXJzb25Cb25lOiBHTFRGTm9kZTtcbiAgcHJpdmF0ZSByZWFkb25seSBfbWVzaEFubm90YXRpb25zOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSA9IFtdO1xuICBwcml2YXRlIHJlYWRvbmx5IF9maXJzdFBlcnNvbkJvbmVPZmZzZXQ6IFRIUkVFLlZlY3RvcjM7XG5cbiAgcHJpdmF0ZSBfZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5fREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSO1xuICBwcml2YXRlIF90aGlyZFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVI7XG5cbiAgcHJpdmF0ZSBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUZpcnN0UGVyc29uIG9iamVjdC5cbiAgICpcbiAgICogQHBhcmFtIGZpcnN0UGVyc29uQm9uZSBBIGZpcnN0IHBlcnNvbiBib25lXG4gICAqIEBwYXJhbSBmaXJzdFBlcnNvbkJvbmVPZmZzZXQgQW4gb2Zmc2V0IGZyb20gdGhlIHNwZWNpZmllZCBmaXJzdCBwZXJzb24gYm9uZVxuICAgKiBAcGFyYW0gbWVzaEFubm90YXRpb25zIEEgcmVuZGVyZXIgc2V0dGluZ3MuIFNlZSB0aGUgZGVzY3JpcHRpb24gb2YgW1tSZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NdXSBmb3IgbW9yZSBpbmZvXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBmaXJzdFBlcnNvbkJvbmU6IEdMVEZOb2RlLFxuICAgIGZpcnN0UGVyc29uQm9uZU9mZnNldDogVEhSRUUuVmVjdG9yMyxcbiAgICBtZXNoQW5ub3RhdGlvbnM6IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFnc1tdLFxuICApIHtcbiAgICB0aGlzLl9maXJzdFBlcnNvbkJvbmUgPSBmaXJzdFBlcnNvbkJvbmU7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25Cb25lT2Zmc2V0ID0gZmlyc3RQZXJzb25Cb25lT2Zmc2V0O1xuICAgIHRoaXMuX21lc2hBbm5vdGF0aW9ucyA9IG1lc2hBbm5vdGF0aW9ucztcbiAgfVxuXG4gIHB1YmxpYyBnZXQgZmlyc3RQZXJzb25Cb25lKCk6IEdMVEZOb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RQZXJzb25Cb25lO1xuICB9XG5cbiAgcHVibGljIGdldCBtZXNoQW5ub3RhdGlvbnMoKTogVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzW10ge1xuICAgIHJldHVybiB0aGlzLl9tZXNoQW5ub3RhdGlvbnM7XG4gIH1cblxuICBwdWJsaWMgZ2V0Rmlyc3RQZXJzb25Xb3JsZERpcmVjdGlvbih0YXJnZXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcbiAgICByZXR1cm4gdGFyZ2V0LmNvcHkoVkVDVE9SM19GUk9OVCkuYXBwbHlRdWF0ZXJuaW9uKGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5fZmlyc3RQZXJzb25Cb25lLCBfcXVhdCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgY2FtZXJhIGxheWVyIHJlcHJlc2VudHMgYEZpcnN0UGVyc29uT25seWAgbGF5ZXIuXG4gICAqIE5vdGUgdGhhdCAqKnlvdSBtdXN0IGNhbGwgW1tzZXR1cF1dIGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlKiogb3IgaXQgZG9lcyBub3Qgd29yayBwcm9wZXJseS5cbiAgICpcbiAgICogVGhlIHZhbHVlIGlzIFtbREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSXV0gYnkgZGVmYXVsdCBidXQgeW91IGNhbiBjaGFuZ2UgdGhlIGxheWVyIGJ5IHNwZWNpZnlpbmcgdmlhIFtbc2V0dXBdXSBpZiB5b3UgcHJlZmVyLlxuICAgKlxuICAgKiBAc2VlIGh0dHBzOi8vdnJtLmRldi9lbi91bml2cm0vYXBpL3VuaXZybV91c2VfZmlyc3RwZXJzb24vXG4gICAqIEBzZWUgaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vY29yZS9MYXllcnNcbiAgICovXG4gIHB1YmxpYyBnZXQgZmlyc3RQZXJzb25Pbmx5TGF5ZXIoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXI7XG4gIH1cblxuICAvKipcbiAgICogQSBjYW1lcmEgbGF5ZXIgcmVwcmVzZW50cyBgVGhpcmRQZXJzb25Pbmx5YCBsYXllci5cbiAgICogTm90ZSB0aGF0ICoqeW91IG11c3QgY2FsbCBbW3NldHVwXV0gZmlyc3QgYmVmb3JlIHlvdSB1c2UgdGhlIGxheWVyIGZlYXR1cmUqKiBvciBpdCBkb2VzIG5vdCB3b3JrIHByb3Blcmx5LlxuICAgKlxuICAgKiBUaGUgdmFsdWUgaXMgW1tERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVJdXSBieSBkZWZhdWx0IGJ1dCB5b3UgY2FuIGNoYW5nZSB0aGUgbGF5ZXIgYnkgc3BlY2lmeWluZyB2aWEgW1tzZXR1cF1dIGlmIHlvdSBwcmVmZXIuXG4gICAqXG4gICAqIEBzZWUgaHR0cHM6Ly92cm0uZGV2L2VuL3VuaXZybS9hcGkvdW5pdnJtX3VzZV9maXJzdHBlcnNvbi9cbiAgICogQHNlZSBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9jb3JlL0xheWVyc1xuICAgKi9cbiAgcHVibGljIGdldCB0aGlyZFBlcnNvbk9ubHlMYXllcigpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRGaXJzdFBlcnNvbkJvbmVPZmZzZXQodGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgcmV0dXJuIHRhcmdldC5jb3B5KHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgd29ybGQgcG9zaXRpb24gb2YgdGhlIGZpcnN0IHBlcnNvbi5cbiAgICogVGhlIHBvc2l0aW9uIHRha2VzIFtbRmlyc3RQZXJzb25Cb25lXV0gYW5kIFtbRmlyc3RQZXJzb25PZmZzZXRdXSBpbnRvIGFjY291bnQuXG4gICAqXG4gICAqIEBwYXJhbSB2MyB0YXJnZXRcbiAgICogQHJldHVybnMgQ3VycmVudCB3b3JsZCBwb3NpdGlvbiBvZiB0aGUgZmlyc3QgcGVyc29uXG4gICAqL1xuICBwdWJsaWMgZ2V0Rmlyc3RQZXJzb25Xb3JsZFBvc2l0aW9uKHYzOiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgLy8gVW5pVlJNI1ZSTUZpcnN0UGVyc29uRWRpdG9yXG4gICAgLy8gdmFyIHdvcmxkT2Zmc2V0ID0gaGVhZC5sb2NhbFRvV29ybGRNYXRyaXguTXVsdGlwbHlQb2ludChjb21wb25lbnQuRmlyc3RQZXJzb25PZmZzZXQpO1xuICAgIGNvbnN0IG9mZnNldCA9IHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldDtcbiAgICBjb25zdCB2NCA9IG5ldyBUSFJFRS5WZWN0b3I0KG9mZnNldC54LCBvZmZzZXQueSwgb2Zmc2V0LnosIDEuMCk7XG4gICAgdjQuYXBwbHlNYXRyaXg0KHRoaXMuX2ZpcnN0UGVyc29uQm9uZS5tYXRyaXhXb3JsZCk7XG4gICAgcmV0dXJuIHYzLnNldCh2NC54LCB2NC55LCB2NC56KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbiB0aGlzIG1ldGhvZCwgaXQgYXNzaWducyBsYXllcnMgZm9yIGV2ZXJ5IG1lc2hlcyBiYXNlZCBvbiBtZXNoIGFubm90YXRpb25zLlxuICAgKiBZb3UgbXVzdCBjYWxsIHRoaXMgbWV0aG9kIGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlLlxuICAgKlxuICAgKiBUaGlzIGlzIGFuIGVxdWl2YWxlbnQgb2YgW1ZSTUZpcnN0UGVyc29uLlNldHVwXShodHRwczovL2dpdGh1Yi5jb20vdnJtLWMvVW5pVlJNL2Jsb2IvbWFzdGVyL0Fzc2V0cy9WUk0vVW5pVlJNL1NjcmlwdHMvRmlyc3RQZXJzb24vVlJNRmlyc3RQZXJzb24uY3MpIG9mIHRoZSBVbmlWUk0uXG4gICAqXG4gICAqIFRoZSBgY2FtZXJhTGF5ZXJgIHBhcmFtZXRlciBzcGVjaWZpZXMgd2hpY2ggbGF5ZXIgd2lsbCBiZSBhc3NpZ25lZCBmb3IgYEZpcnN0UGVyc29uT25seWAgLyBgVGhpcmRQZXJzb25Pbmx5YC5cbiAgICogSW4gVW5pVlJNLCB3ZSBzcGVjaWZpZWQgdGhvc2UgYnkgbmFtaW5nIGVhY2ggZGVzaXJlZCBsYXllciBhcyBgRklSU1RQRVJTT05fT05MWV9MQVlFUmAgLyBgVEhJUkRQRVJTT05fT05MWV9MQVlFUmBcbiAgICogYnV0IHdlIGFyZSBnb2luZyB0byBzcGVjaWZ5IHRoZXNlIGxheWVycyBhdCBoZXJlIHNpbmNlIHdlIGFyZSB1bmFibGUgdG8gbmFtZSBsYXllcnMgaW4gVGhyZWUuanMuXG4gICAqXG4gICAqIEBwYXJhbSBjYW1lcmFMYXllciBTcGVjaWZ5IHdoaWNoIGxheWVyIHdpbGwgYmUgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIC8gYFRoaXJkUGVyc29uT25seWAuXG4gICAqL1xuICBwdWJsaWMgc2V0dXAoe1xuICAgIGZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uX0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUixcbiAgICB0aGlyZFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVIsXG4gIH0gPSB7fSk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9pbml0aWFsaXplZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBmaXJzdFBlcnNvbk9ubHlMYXllcjtcbiAgICB0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllciA9IHRoaXJkUGVyc29uT25seUxheWVyO1xuXG4gICAgdGhpcy5fbWVzaEFubm90YXRpb25zLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgIGlmIChpdGVtLmZpcnN0UGVyc29uRmxhZyA9PT0gRmlyc3RQZXJzb25GbGFnLkZpcnN0UGVyc29uT25seSkge1xuICAgICAgICBpdGVtLnByaW1pdGl2ZXMuZm9yRWFjaCgocHJpbWl0aXZlKSA9PiB7XG4gICAgICAgICAgcHJpbWl0aXZlLmxheWVycy5zZXQodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbS5maXJzdFBlcnNvbkZsYWcgPT09IEZpcnN0UGVyc29uRmxhZy5UaGlyZFBlcnNvbk9ubHkpIHtcbiAgICAgICAgaXRlbS5wcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xuICAgICAgICAgIHByaW1pdGl2ZS5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0uZmlyc3RQZXJzb25GbGFnID09PSBGaXJzdFBlcnNvbkZsYWcuQXV0bykge1xuICAgICAgICB0aGlzLl9jcmVhdGVIZWFkbGVzc01vZGVsKGl0ZW0ucHJpbWl0aXZlcyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9leGNsdWRlVHJpYW5nbGVzKHRyaWFuZ2xlczogbnVtYmVyW10sIGJ3czogbnVtYmVyW11bXSwgc2tpbkluZGV4OiBudW1iZXJbXVtdLCBleGNsdWRlOiBudW1iZXJbXSk6IG51bWJlciB7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBpZiAoYndzICE9IG51bGwgJiYgYndzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGNvbnN0IGEgPSB0cmlhbmdsZXNbaV07XG4gICAgICAgIGNvbnN0IGIgPSB0cmlhbmdsZXNbaSArIDFdO1xuICAgICAgICBjb25zdCBjID0gdHJpYW5nbGVzW2kgKyAyXTtcbiAgICAgICAgY29uc3QgYncwID0gYndzW2FdO1xuICAgICAgICBjb25zdCBza2luMCA9IHNraW5JbmRleFthXTtcblxuICAgICAgICBpZiAoYncwWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzBdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzBbMV0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbMV0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MFsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFsyXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncwWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzNdKSkgY29udGludWU7XG5cbiAgICAgICAgY29uc3QgYncxID0gYndzW2JdO1xuICAgICAgICBjb25zdCBza2luMSA9IHNraW5JbmRleFtiXTtcbiAgICAgICAgaWYgKGJ3MVswXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVswXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncxWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzFdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzFbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbMl0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MVszXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVszXSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IGJ3MiA9IGJ3c1tjXTtcbiAgICAgICAgY29uc3Qgc2tpbjIgPSBza2luSW5kZXhbY107XG4gICAgICAgIGlmIChidzJbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbMF0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MlsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMlsxXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncyWzJdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzJdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzJbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbM10pKSBjb250aW51ZTtcblxuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBhO1xuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBiO1xuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBjO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY291bnQ7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVFcmFzZWRNZXNoKHNyYzogVEhSRUUuU2tpbm5lZE1lc2gsIGVyYXNpbmdCb25lc0luZGV4OiBudW1iZXJbXSk6IFRIUkVFLlNraW5uZWRNZXNoIHtcbiAgICBjb25zdCBkc3QgPSBuZXcgVEhSRUUuU2tpbm5lZE1lc2goc3JjLmdlb21ldHJ5LmNsb25lKCksIHNyYy5tYXRlcmlhbCk7XG4gICAgZHN0Lm5hbWUgPSBgJHtzcmMubmFtZX0oZXJhc2UpYDtcbiAgICBkc3QuZnJ1c3R1bUN1bGxlZCA9IHNyYy5mcnVzdHVtQ3VsbGVkO1xuICAgIGRzdC5sYXllcnMuc2V0KHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcblxuICAgIGNvbnN0IGdlb21ldHJ5ID0gZHN0Lmdlb21ldHJ5O1xuXG4gICAgY29uc3Qgc2tpbkluZGV4QXR0ciA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbkluZGV4JykuYXJyYXk7XG4gICAgY29uc3Qgc2tpbkluZGV4ID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBza2luSW5kZXhBdHRyLmxlbmd0aDsgaSArPSA0KSB7XG4gICAgICBza2luSW5kZXgucHVzaChbc2tpbkluZGV4QXR0cltpXSwgc2tpbkluZGV4QXR0cltpICsgMV0sIHNraW5JbmRleEF0dHJbaSArIDJdLCBza2luSW5kZXhBdHRyW2kgKyAzXV0pO1xuICAgIH1cblxuICAgIGNvbnN0IHNraW5XZWlnaHRBdHRyID0gZ2VvbWV0cnkuZ2V0QXR0cmlidXRlKCdza2luV2VpZ2h0JykuYXJyYXk7XG4gICAgY29uc3Qgc2tpbldlaWdodCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2tpbldlaWdodEF0dHIubGVuZ3RoOyBpICs9IDQpIHtcbiAgICAgIHNraW5XZWlnaHQucHVzaChbc2tpbldlaWdodEF0dHJbaV0sIHNraW5XZWlnaHRBdHRyW2kgKyAxXSwgc2tpbldlaWdodEF0dHJbaSArIDJdLCBza2luV2VpZ2h0QXR0cltpICsgM11dKTtcbiAgICB9XG5cbiAgICBjb25zdCBpbmRleCA9IGdlb21ldHJ5LmdldEluZGV4KCk7XG4gICAgaWYgKCFpbmRleCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGdlb21ldHJ5IGRvZXNuJ3QgaGF2ZSBhbiBpbmRleCBidWZmZXJcIik7XG4gICAgfVxuICAgIGNvbnN0IG9sZFRyaWFuZ2xlcyA9IEFycmF5LmZyb20oaW5kZXguYXJyYXkpO1xuXG4gICAgY29uc3QgY291bnQgPSB0aGlzLl9leGNsdWRlVHJpYW5nbGVzKG9sZFRyaWFuZ2xlcywgc2tpbldlaWdodCwgc2tpbkluZGV4LCBlcmFzaW5nQm9uZXNJbmRleCk7XG4gICAgY29uc3QgbmV3VHJpYW5nbGU6IG51bWJlcltdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICBuZXdUcmlhbmdsZVtpXSA9IG9sZFRyaWFuZ2xlc1tpXTtcbiAgICB9XG4gICAgZ2VvbWV0cnkuc2V0SW5kZXgobmV3VHJpYW5nbGUpO1xuXG4gICAgLy8gbXRvb24gbWF0ZXJpYWwgaW5jbHVkZXMgb25CZWZvcmVSZW5kZXIuIHRoaXMgaXMgdW5zdXBwb3J0ZWQgYXQgU2tpbm5lZE1lc2gjY2xvbmVcbiAgICBpZiAoc3JjLm9uQmVmb3JlUmVuZGVyKSB7XG4gICAgICBkc3Qub25CZWZvcmVSZW5kZXIgPSBzcmMub25CZWZvcmVSZW5kZXI7XG4gICAgfVxuICAgIGRzdC5iaW5kKG5ldyBUSFJFRS5Ta2VsZXRvbihzcmMuc2tlbGV0b24uYm9uZXMsIHNyYy5za2VsZXRvbi5ib25lSW52ZXJzZXMpLCBuZXcgVEhSRUUuTWF0cml4NCgpKTtcbiAgICByZXR1cm4gZHN0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlSGVhZGxlc3NNb2RlbEZvclNraW5uZWRNZXNoKHBhcmVudDogVEhSRUUuT2JqZWN0M0QsIG1lc2g6IFRIUkVFLlNraW5uZWRNZXNoKTogdm9pZCB7XG4gICAgY29uc3QgZXJhc2VCb25lSW5kZXhlczogbnVtYmVyW10gPSBbXTtcbiAgICBtZXNoLnNrZWxldG9uLmJvbmVzLmZvckVhY2goKGJvbmUsIGluZGV4KSA9PiB7XG4gICAgICBpZiAodGhpcy5faXNFcmFzZVRhcmdldChib25lKSkgZXJhc2VCb25lSW5kZXhlcy5wdXNoKGluZGV4KTtcbiAgICB9KTtcblxuICAgIC8vIFVubGlrZSBVbmlWUk0gd2UgZG9uJ3QgY29weSBtZXNoIGlmIG5vIGludmlzaWJsZSBib25lIHdhcyBmb3VuZFxuICAgIGlmICghZXJhc2VCb25lSW5kZXhlcy5sZW5ndGgpIHtcbiAgICAgIG1lc2gubGF5ZXJzLmVuYWJsZSh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcik7XG4gICAgICBtZXNoLmxheWVycy5lbmFibGUodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBtZXNoLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xuICAgIGNvbnN0IG5ld01lc2ggPSB0aGlzLl9jcmVhdGVFcmFzZWRNZXNoKG1lc2gsIGVyYXNlQm9uZUluZGV4ZXMpO1xuICAgIHBhcmVudC5hZGQobmV3TWVzaCk7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVIZWFkbGVzc01vZGVsKHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXSk6IHZvaWQge1xuICAgIHByaW1pdGl2ZXMuZm9yRWFjaCgocHJpbWl0aXZlKSA9PiB7XG4gICAgICBpZiAocHJpbWl0aXZlLnR5cGUgPT09ICdTa2lubmVkTWVzaCcpIHtcbiAgICAgICAgY29uc3Qgc2tpbm5lZE1lc2ggPSBwcmltaXRpdmUgYXMgVEhSRUUuU2tpbm5lZE1lc2g7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUhlYWRsZXNzTW9kZWxGb3JTa2lubmVkTWVzaChza2lubmVkTWVzaC5wYXJlbnQhLCBza2lubmVkTWVzaCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5faXNFcmFzZVRhcmdldChwcmltaXRpdmUpKSB7XG4gICAgICAgICAgcHJpbWl0aXZlLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSXQganVzdCBjaGVja3Mgd2hldGhlciB0aGUgbm9kZSBvciBpdHMgcGFyZW50IGlzIHRoZSBmaXJzdCBwZXJzb24gYm9uZSBvciBub3QuXG4gICAqIEBwYXJhbSBib25lIFRoZSB0YXJnZXQgYm9uZVxuICAgKi9cbiAgcHJpdmF0ZSBfaXNFcmFzZVRhcmdldChib25lOiBHTFRGTm9kZSk6IGJvb2xlYW4ge1xuICAgIGlmIChib25lID09PSB0aGlzLl9maXJzdFBlcnNvbkJvbmUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZiAoIWJvbmUucGFyZW50KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9pc0VyYXNlVGFyZ2V0KGJvbmUucGFyZW50KTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi4vaHVtYW5vaWQnO1xuaW1wb3J0IHsgR0xURk5vZGUsIEdMVEZTY2hlbWEsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyB9IGZyb20gJy4uL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uLCBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3MgfSBmcm9tICcuL1ZSTUZpcnN0UGVyc29uJztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUZpcnN0UGVyc29uXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNRmlyc3RQZXJzb25JbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJbXBvcnQgYSBbW1ZSTUZpcnN0UGVyc29uXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIFtbVlJNSHVtYW5vaWRdXSBpbnN0YW5jZSB0aGF0IHJlcHJlc2VudHMgdGhlIFZSTVxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGLCBodW1hbm9pZDogVlJNSHVtYW5vaWQpOiBQcm9taXNlPFZSTUZpcnN0UGVyc29uIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0UGVyc29uQm9uZUluZGV4ID0gc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lO1xuXG4gICAgbGV0IGZpcnN0UGVyc29uQm9uZTogR0xURk5vZGUgfCBudWxsO1xuICAgIGlmIChmaXJzdFBlcnNvbkJvbmVJbmRleCA9PT0gdW5kZWZpbmVkIHx8IGZpcnN0UGVyc29uQm9uZUluZGV4ID09PSAtMSkge1xuICAgICAgZmlyc3RQZXJzb25Cb25lID0gaHVtYW5vaWQuZ2V0Qm9uZU5vZGUoVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUuSGVhZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpcnN0UGVyc29uQm9uZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBmaXJzdFBlcnNvbkJvbmVJbmRleCk7XG4gICAgfVxuXG4gICAgaWYgKCFmaXJzdFBlcnNvbkJvbmUpIHtcbiAgICAgIGNvbnNvbGUud2FybignVlJNRmlyc3RQZXJzb25JbXBvcnRlcjogQ291bGQgbm90IGZpbmQgZmlyc3RQZXJzb25Cb25lIG9mIHRoZSBWUk0nKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0UGVyc29uQm9uZU9mZnNldCA9IHNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZU9mZnNldFxuICAgICAgPyBuZXcgVEhSRUUuVmVjdG9yMyhcbiAgICAgICAgICBzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXQueCxcbiAgICAgICAgICBzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXQueSxcbiAgICAgICAgICAtc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LnohLCAvLyBWUk0gMC4wIHVzZXMgbGVmdC1oYW5kZWQgeS11cFxuICAgICAgICApXG4gICAgICA6IG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wNiwgMC4wKTsgLy8gZmFsbGJhY2ssIHRha2VuIGZyb20gVW5pVlJNIGltcGxlbWVudGF0aW9uXG5cbiAgICBjb25zdCBtZXNoQW5ub3RhdGlvbnM6IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFnc1tdID0gW107XG4gICAgY29uc3Qgbm9kZVByaW1pdGl2ZXNNYXAgPSBhd2FpdCBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMoZ2x0Zik7XG5cbiAgICBBcnJheS5mcm9tKG5vZGVQcmltaXRpdmVzTWFwLmVudHJpZXMoKSkuZm9yRWFjaCgoW25vZGVJbmRleCwgcHJpbWl0aXZlc10pID0+IHtcbiAgICAgIGNvbnN0IHNjaGVtYU5vZGU6IEdMVEZTY2hlbWEuTm9kZSA9IGdsdGYucGFyc2VyLmpzb24ubm9kZXNbbm9kZUluZGV4XTtcblxuICAgICAgY29uc3QgZmxhZyA9IHNjaGVtYUZpcnN0UGVyc29uLm1lc2hBbm5vdGF0aW9uc1xuICAgICAgICA/IHNjaGVtYUZpcnN0UGVyc29uLm1lc2hBbm5vdGF0aW9ucy5maW5kKChhKSA9PiBhLm1lc2ggPT09IHNjaGVtYU5vZGUubWVzaClcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICBtZXNoQW5ub3RhdGlvbnMucHVzaChuZXcgVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzKGZsYWc/LmZpcnN0UGVyc29uRmxhZywgcHJpbWl0aXZlcykpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBWUk1GaXJzdFBlcnNvbihmaXJzdFBlcnNvbkJvbmUsIGZpcnN0UGVyc29uQm9uZU9mZnNldCwgbWVzaEFubm90YXRpb25zKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgR0xURk5vZGUgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1IdW1hbkxpbWl0IH0gZnJvbSAnLi9WUk1IdW1hbkxpbWl0JztcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgYSBzaW5nbGUgYGh1bWFuQm9uZWAgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1IdW1hbkJvbmUge1xuICAvKipcbiAgICogQSBbW0dMVEZOb2RlXV0gKHRoYXQgYWN0dWFsbHkgaXMgYSBgVEhSRUUuT2JqZWN0M0RgKSB0aGF0IHJlcHJlc2VudHMgdGhlIGJvbmUuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbm9kZTogR0xURk5vZGU7XG5cbiAgLyoqXG4gICAqIEEgW1tWUk1IdW1hbkxpbWl0XV0gb2JqZWN0IHRoYXQgcmVwcmVzZW50cyBwcm9wZXJ0aWVzIG9mIHRoZSBib25lLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGh1bWFuTGltaXQ6IFZSTUh1bWFuTGltaXQ7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1IdW1hbkJvbmUuXG4gICAqXG4gICAqIEBwYXJhbSBub2RlIEEgW1tHTFRGTm9kZV1dIHRoYXQgcmVwcmVzZW50cyB0aGUgbmV3IGJvbmVcbiAgICogQHBhcmFtIGh1bWFuTGltaXQgQSBbW1ZSTUh1bWFuTGltaXRdXSBvYmplY3QgdGhhdCByZXByZXNlbnRzIHByb3BlcnRpZXMgb2YgdGhlIG5ldyBib25lXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3Iobm9kZTogR0xURk5vZGUsIGh1bWFuTGltaXQ6IFZSTUh1bWFuTGltaXQpIHtcbiAgICB0aGlzLm5vZGUgPSBub2RlO1xuICAgIHRoaXMuaHVtYW5MaW1pdCA9IGh1bWFuTGltaXQ7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuLyoqXG4gKiBBIGNvbXBhdCBmdW5jdGlvbiBmb3IgYFF1YXRlcm5pb24uaW52ZXJ0KClgIC8gYFF1YXRlcm5pb24uaW52ZXJzZSgpYC5cbiAqIGBRdWF0ZXJuaW9uLmludmVydCgpYCBpcyBpbnRyb2R1Y2VkIGluIHIxMjMgYW5kIGBRdWF0ZXJuaW9uLmludmVyc2UoKWAgZW1pdHMgYSB3YXJuaW5nLlxuICogV2UgYXJlIGdvaW5nIHRvIHVzZSB0aGlzIGNvbXBhdCBmb3IgYSB3aGlsZS5cbiAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgcXVhdGVybmlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVhdEludmVydENvbXBhdDxUIGV4dGVuZHMgVEhSRUUuUXVhdGVybmlvbj4odGFyZ2V0OiBUKTogVCB7XG4gIGlmICgodGFyZ2V0IGFzIGFueSkuaW52ZXJ0KSB7XG4gICAgdGFyZ2V0LmludmVydCgpO1xuICB9IGVsc2Uge1xuICAgICh0YXJnZXQgYXMgYW55KS5pbnZlcnNlKCk7XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0O1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURk5vZGUsIFJhd1ZlY3RvcjMsIFJhd1ZlY3RvcjQsIFZSTVBvc2UsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHF1YXRJbnZlcnRDb21wYXQgfSBmcm9tICcuLi91dGlscy9xdWF0SW52ZXJ0Q29tcGF0JztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lJztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZUFycmF5IH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVBcnJheSc7XG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVzIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVzJztcbmltcG9ydCB7IFZSTUh1bWFuRGVzY3JpcHRpb24gfSBmcm9tICcuL1ZSTUh1bWFuRGVzY3JpcHRpb24nO1xuXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF9xdWF0QSA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRzIGh1bWFub2lkIG9mIGEgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWQge1xuICAvKipcbiAgICogQSBbW1ZSTUh1bWFuQm9uZXNdXSB0aGF0IGNvbnRhaW5zIGFsbCB0aGUgaHVtYW4gYm9uZXMgb2YgdGhlIFZSTS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gZ2V0IHRoZXNlIGJvbmVzIHVzaW5nIFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZV1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGh1bWFuQm9uZXM6IFZSTUh1bWFuQm9uZXM7XG5cbiAgLyoqXG4gICAqIEEgW1tWUk1IdW1hbkRlc2NyaXB0aW9uXV0gdGhhdCByZXByZXNlbnRzIHByb3BlcnRpZXMgb2YgdGhlIGh1bWFub2lkLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGh1bWFuRGVzY3JpcHRpb246IFZSTUh1bWFuRGVzY3JpcHRpb247XG5cbiAgLyoqXG4gICAqIEEgW1tWUk1Qb3NlXV0gdGhhdCBpcyBpdHMgZGVmYXVsdCBzdGF0ZS5cbiAgICogTm90ZSB0aGF0IGl0J3Mgbm90IGNvbXBhdGlibGUgd2l0aCBgc2V0UG9zZWAgYW5kIGBnZXRQb3NlYCwgc2luY2UgaXQgY29udGFpbnMgbm9uLXJlbGF0aXZlIHZhbHVlcyBvZiBlYWNoIGxvY2FsIHRyYW5zZm9ybXMuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcmVzdFBvc2U6IFZSTVBvc2UgPSB7fTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNSHVtYW5vaWRdXS5cbiAgICogQHBhcmFtIGJvbmVBcnJheSBBIFtbVlJNSHVtYW5Cb25lQXJyYXldXSBjb250YWlucyBhbGwgdGhlIGJvbmVzIG9mIHRoZSBuZXcgaHVtYW5vaWRcbiAgICogQHBhcmFtIGh1bWFuRGVzY3JpcHRpb24gQSBbW1ZSTUh1bWFuRGVzY3JpcHRpb25dXSB0aGF0IHJlcHJlc2VudHMgcHJvcGVydGllcyBvZiB0aGUgbmV3IGh1bWFub2lkXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IoYm9uZUFycmF5OiBWUk1IdW1hbkJvbmVBcnJheSwgaHVtYW5EZXNjcmlwdGlvbjogVlJNSHVtYW5EZXNjcmlwdGlvbikge1xuICAgIHRoaXMuaHVtYW5Cb25lcyA9IHRoaXMuX2NyZWF0ZUh1bWFuQm9uZXMoYm9uZUFycmF5KTtcbiAgICB0aGlzLmh1bWFuRGVzY3JpcHRpb24gPSBodW1hbkRlc2NyaXB0aW9uO1xuXG4gICAgdGhpcy5yZXN0UG9zZSA9IHRoaXMuZ2V0UG9zZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgY3VycmVudCBwb3NlIG9mIHRoaXMgaHVtYW5vaWQgYXMgYSBbW1ZSTVBvc2VdXS5cbiAgICpcbiAgICogRWFjaCB0cmFuc2Zvcm0gaXMgYSBsb2NhbCB0cmFuc2Zvcm0gcmVsYXRpdmUgZnJvbSByZXN0IHBvc2UgKFQtcG9zZSkuXG4gICAqL1xuICBwdWJsaWMgZ2V0UG9zZSgpOiBWUk1Qb3NlIHtcbiAgICBjb25zdCBwb3NlOiBWUk1Qb3NlID0ge307XG4gICAgT2JqZWN0LmtleXModGhpcy5odW1hbkJvbmVzKS5mb3JFYWNoKCh2cm1Cb25lTmFtZSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Qm9uZU5vZGUodnJtQm9uZU5hbWUgYXMgVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpITtcblxuICAgICAgLy8gSWdub3JlIHdoZW4gdGhlcmUgYXJlIG5vIGJvbmUgb24gdGhlIFZSTUh1bWFub2lkXG4gICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXaGVuIHRoZXJlIGFyZSB0d28gb3IgbW9yZSBib25lcyBpbiBhIHNhbWUgbmFtZSwgd2UgYXJlIG5vdCBnb2luZyB0byBvdmVyd3JpdGUgZXhpc3Rpbmcgb25lXG4gICAgICBpZiAocG9zZVt2cm1Cb25lTmFtZV0pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBUYWtlIGEgZGlmZiBmcm9tIHJlc3RQb3NlXG4gICAgICAvLyBub3RlIHRoYXQgcmVzdFBvc2UgYWxzbyB3aWxsIHVzZSBnZXRQb3NlIHRvIGluaXRpYWxpemUgaXRzZWxmXG4gICAgICBfdjNBLnNldCgwLCAwLCAwKTtcbiAgICAgIF9xdWF0QS5pZGVudGl0eSgpO1xuXG4gICAgICBjb25zdCByZXN0U3RhdGUgPSB0aGlzLnJlc3RQb3NlW3ZybUJvbmVOYW1lXTtcbiAgICAgIGlmIChyZXN0U3RhdGU/LnBvc2l0aW9uKSB7XG4gICAgICAgIF92M0EuZnJvbUFycmF5KHJlc3RTdGF0ZS5wb3NpdGlvbikubmVnYXRlKCk7XG4gICAgICB9XG4gICAgICBpZiAocmVzdFN0YXRlPy5yb3RhdGlvbikge1xuICAgICAgICBxdWF0SW52ZXJ0Q29tcGF0KF9xdWF0QS5mcm9tQXJyYXkocmVzdFN0YXRlLnJvdGF0aW9uKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEdldCB0aGUgcG9zaXRpb24gLyByb3RhdGlvbiBmcm9tIHRoZSBub2RlXG4gICAgICBfdjNBLmFkZChub2RlLnBvc2l0aW9uKTtcbiAgICAgIF9xdWF0QS5wcmVtdWx0aXBseShub2RlLnF1YXRlcm5pb24pO1xuXG4gICAgICBwb3NlW3ZybUJvbmVOYW1lXSA9IHtcbiAgICAgICAgcG9zaXRpb246IF92M0EudG9BcnJheSgpIGFzIFJhd1ZlY3RvcjMsXG4gICAgICAgIHJvdGF0aW9uOiBfcXVhdEEudG9BcnJheSgpIGFzIFJhd1ZlY3RvcjQsXG4gICAgICB9O1xuICAgIH0sIHt9IGFzIFZSTVBvc2UpO1xuICAgIHJldHVybiBwb3NlO1xuICB9XG5cbiAgLyoqXG4gICAqIExldCB0aGUgaHVtYW5vaWQgZG8gYSBzcGVjaWZpZWQgcG9zZS5cbiAgICpcbiAgICogRWFjaCB0cmFuc2Zvcm0gaGF2ZSB0byBiZSBhIGxvY2FsIHRyYW5zZm9ybSByZWxhdGl2ZSBmcm9tIHJlc3QgcG9zZSAoVC1wb3NlKS5cbiAgICogWW91IGNhbiBwYXNzIHdoYXQgeW91IGdvdCBmcm9tIHtAbGluayBnZXRQb3NlfS5cbiAgICpcbiAgICogQHBhcmFtIHBvc2VPYmplY3QgQSBbW1ZSTVBvc2VdXSB0aGF0IHJlcHJlc2VudHMgYSBzaW5nbGUgcG9zZVxuICAgKi9cbiAgcHVibGljIHNldFBvc2UocG9zZU9iamVjdDogVlJNUG9zZSk6IHZvaWQge1xuICAgIE9iamVjdC5rZXlzKHBvc2VPYmplY3QpLmZvckVhY2goKGJvbmVOYW1lKSA9PiB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHBvc2VPYmplY3RbYm9uZU5hbWVdITtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKGJvbmVOYW1lIGFzIFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTtcblxuICAgICAgLy8gSWdub3JlIHdoZW4gdGhlcmUgYXJlIG5vIGJvbmUgdGhhdCBpcyBkZWZpbmVkIGluIHRoZSBwb3NlIG9uIHRoZSBWUk1IdW1hbm9pZFxuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdFN0YXRlID0gdGhpcy5yZXN0UG9zZVtib25lTmFtZV07XG4gICAgICBpZiAoIXJlc3RTdGF0ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChzdGF0ZS5wb3NpdGlvbikge1xuICAgICAgICBub2RlLnBvc2l0aW9uLmZyb21BcnJheShzdGF0ZS5wb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKHJlc3RTdGF0ZS5wb3NpdGlvbikge1xuICAgICAgICAgIG5vZGUucG9zaXRpb24uYWRkKF92M0EuZnJvbUFycmF5KHJlc3RTdGF0ZS5wb3NpdGlvbikpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzdGF0ZS5yb3RhdGlvbikge1xuICAgICAgICBub2RlLnF1YXRlcm5pb24uZnJvbUFycmF5KHN0YXRlLnJvdGF0aW9uKTtcblxuICAgICAgICBpZiAocmVzdFN0YXRlLnJvdGF0aW9uKSB7XG4gICAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLm11bHRpcGx5KF9xdWF0QS5mcm9tQXJyYXkocmVzdFN0YXRlLnJvdGF0aW9uKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB0aGUgaHVtYW5vaWQgdG8gaXRzIHJlc3QgcG9zZS5cbiAgICovXG4gIHB1YmxpYyByZXNldFBvc2UoKTogdm9pZCB7XG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5yZXN0UG9zZSkuZm9yRWFjaCgoW2JvbmVOYW1lLCByZXN0XSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Qm9uZU5vZGUoYm9uZU5hbWUgYXMgVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpO1xuXG4gICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdD8ucG9zaXRpb24pIHtcbiAgICAgICAgbm9kZS5wb3NpdGlvbi5mcm9tQXJyYXkocmVzdC5wb3NpdGlvbik7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXN0Py5yb3RhdGlvbikge1xuICAgICAgICBub2RlLnF1YXRlcm5pb24uZnJvbUFycmF5KHJlc3Qucm90YXRpb24pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIGJvbmUgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYSBbW1ZSTUh1bWFuQm9uZV1dLlxuICAgKlxuICAgKiBTZWUgYWxzbzogW1tWUk1IdW1hbm9pZC5nZXRCb25lc11dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogVlJNSHVtYW5Cb25lIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdWzBdID8/IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYm9uZXMgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYW4gYXJyYXkgb2YgW1tWUk1IdW1hbkJvbmVdXS5cbiAgICogSWYgdGhlcmUgYXJlIG5vIGJvbmVzIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgSHVtYW5Cb25lLCBpdCB3aWxsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZV1dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lcyhuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IFZSTUh1bWFuQm9uZVtdIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdID8/IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIGJvbmUgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYSBUSFJFRS5PYmplY3QzRC5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZU5vZGVzXV1cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYm9uZSB5b3Ugd2FudFxuICAgKi9cbiAgcHVibGljIGdldEJvbmVOb2RlKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogR0xURk5vZGUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdWzBdPy5ub2RlID8/IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGJvbmVzIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGFuIGFycmF5IG9mIFRIUkVFLk9iamVjdDNELlxuICAgKiBJZiB0aGVyZSBhcmUgbm8gYm9uZXMgYm91bmQgdG8gdGhlIHNwZWNpZmllZCBIdW1hbkJvbmUsIGl0IHdpbGwgcmV0dXJuIGFuIGVtcHR5IGFycmF5LlxuICAgKlxuICAgKiBTZWUgYWxzbzogW1tWUk1IdW1hbm9pZC5nZXRCb25lTm9kZV1dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lTm9kZXMobmFtZTogVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpOiBHTFRGTm9kZVtdIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdPy5tYXAoKGJvbmUpID0+IGJvbmUubm9kZSkgPz8gW107XG4gIH1cblxuICAvKipcbiAgICogUHJlcGFyZSBhIFtbVlJNSHVtYW5Cb25lc11dIGZyb20gYSBbW1ZSTUh1bWFuQm9uZUFycmF5XV0uXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGVIdW1hbkJvbmVzKGJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXkpOiBWUk1IdW1hbkJvbmVzIHtcbiAgICBjb25zdCBib25lczogVlJNSHVtYW5Cb25lcyA9IE9iamVjdC52YWx1ZXMoVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpLnJlZHVjZSgoYWNjdW0sIG5hbWUpID0+IHtcbiAgICAgIGFjY3VtW25hbWVdID0gW107XG4gICAgICByZXR1cm4gYWNjdW07XG4gICAgfSwge30gYXMgUGFydGlhbDxWUk1IdW1hbkJvbmVzPikgYXMgVlJNSHVtYW5Cb25lcztcblxuICAgIGJvbmVBcnJheS5mb3JFYWNoKChib25lKSA9PiB7XG4gICAgICBib25lc1tib25lLm5hbWVdLnB1c2goYm9uZS5ib25lKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBib25lcztcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNSHVtYW5Cb25lIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmUnO1xuaW1wb3J0IHsgVlJNSHVtYW5Cb25lQXJyYXkgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZUFycmF5JztcbmltcG9ydCB7IFZSTUh1bWFuRGVzY3JpcHRpb24gfSBmcm9tICcuL1ZSTUh1bWFuRGVzY3JpcHRpb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuL1ZSTUh1bWFub2lkJztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUh1bWFub2lkXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWRJbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJbXBvcnQgYSBbW1ZSTUh1bWFub2lkXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTUh1bWFub2lkIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFIdW1hbm9pZDogVlJNU2NoZW1hLkh1bWFub2lkIHwgdW5kZWZpbmVkID0gdnJtRXh0Lmh1bWFub2lkO1xuICAgIGlmICghc2NoZW1hSHVtYW5vaWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGh1bWFuQm9uZUFycmF5OiBWUk1IdW1hbkJvbmVBcnJheSA9IFtdO1xuICAgIGlmIChzY2hlbWFIdW1hbm9pZC5odW1hbkJvbmVzKSB7XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgc2NoZW1hSHVtYW5vaWQuaHVtYW5Cb25lcy5tYXAoYXN5bmMgKGJvbmUpID0+IHtcbiAgICAgICAgICBpZiAoIWJvbmUuYm9uZSB8fCBib25lLm5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG5vZGUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgYm9uZS5ub2RlKTtcbiAgICAgICAgICBodW1hbkJvbmVBcnJheS5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IGJvbmUuYm9uZSxcbiAgICAgICAgICAgIGJvbmU6IG5ldyBWUk1IdW1hbkJvbmUobm9kZSwge1xuICAgICAgICAgICAgICBheGlzTGVuZ3RoOiBib25lLmF4aXNMZW5ndGgsXG4gICAgICAgICAgICAgIGNlbnRlcjogYm9uZS5jZW50ZXIgJiYgbmV3IFRIUkVFLlZlY3RvcjMoYm9uZS5jZW50ZXIueCwgYm9uZS5jZW50ZXIueSwgYm9uZS5jZW50ZXIueiksXG4gICAgICAgICAgICAgIG1heDogYm9uZS5tYXggJiYgbmV3IFRIUkVFLlZlY3RvcjMoYm9uZS5tYXgueCwgYm9uZS5tYXgueSwgYm9uZS5tYXgueiksXG4gICAgICAgICAgICAgIG1pbjogYm9uZS5taW4gJiYgbmV3IFRIUkVFLlZlY3RvcjMoYm9uZS5taW4ueCwgYm9uZS5taW4ueSwgYm9uZS5taW4ueiksXG4gICAgICAgICAgICAgIHVzZURlZmF1bHRWYWx1ZXM6IGJvbmUudXNlRGVmYXVsdFZhbHVlcyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgaHVtYW5EZXNjcmlwdGlvbjogVlJNSHVtYW5EZXNjcmlwdGlvbiA9IHtcbiAgICAgIGFybVN0cmV0Y2g6IHNjaGVtYUh1bWFub2lkLmFybVN0cmV0Y2gsXG4gICAgICBsZWdTdHJldGNoOiBzY2hlbWFIdW1hbm9pZC5sZWdTdHJldGNoLFxuICAgICAgdXBwZXJBcm1Ud2lzdDogc2NoZW1hSHVtYW5vaWQudXBwZXJBcm1Ud2lzdCxcbiAgICAgIGxvd2VyQXJtVHdpc3Q6IHNjaGVtYUh1bWFub2lkLmxvd2VyQXJtVHdpc3QsXG4gICAgICB1cHBlckxlZ1R3aXN0OiBzY2hlbWFIdW1hbm9pZC51cHBlckxlZ1R3aXN0LFxuICAgICAgbG93ZXJMZWdUd2lzdDogc2NoZW1hSHVtYW5vaWQubG93ZXJMZWdUd2lzdCxcbiAgICAgIGZlZXRTcGFjaW5nOiBzY2hlbWFIdW1hbm9pZC5mZWV0U3BhY2luZyxcbiAgICAgIGhhc1RyYW5zbGF0aW9uRG9GOiBzY2hlbWFIdW1hbm9pZC5oYXNUcmFuc2xhdGlvbkRvRixcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBWUk1IdW1hbm9pZChodW1hbkJvbmVBcnJheSwgaHVtYW5EZXNjcmlwdGlvbik7XG4gIH1cbn1cbiIsIi8qKlxuICogRXZhbHVhdGUgYSBoZXJtaXRlIHNwbGluZS5cbiAqXG4gKiBAcGFyYW0geTAgeSBvbiBzdGFydFxuICogQHBhcmFtIHkxIHkgb24gZW5kXG4gKiBAcGFyYW0gdDAgZGVsdGEgeSBvbiBzdGFydFxuICogQHBhcmFtIHQxIGRlbHRhIHkgb24gZW5kXG4gKiBAcGFyYW0geCBpbnB1dCB2YWx1ZVxuICovXG5jb25zdCBoZXJtaXRlU3BsaW5lID0gKHkwOiBudW1iZXIsIHkxOiBudW1iZXIsIHQwOiBudW1iZXIsIHQxOiBudW1iZXIsIHg6IG51bWJlcik6IG51bWJlciA9PiB7XG4gIGNvbnN0IHhjID0geCAqIHggKiB4O1xuICBjb25zdCB4cyA9IHggKiB4O1xuICBjb25zdCBkeSA9IHkxIC0geTA7XG4gIGNvbnN0IGgwMSA9IC0yLjAgKiB4YyArIDMuMCAqIHhzO1xuICBjb25zdCBoMTAgPSB4YyAtIDIuMCAqIHhzICsgeDtcbiAgY29uc3QgaDExID0geGMgLSB4cztcbiAgcmV0dXJuIHkwICsgZHkgKiBoMDEgKyB0MCAqIGgxMCArIHQxICogaDExO1xufTtcblxuLyoqXG4gKiBFdmFsdWF0ZSBhbiBBbmltYXRpb25DdXJ2ZSBhcnJheS4gU2VlIEFuaW1hdGlvbkN1cnZlIGNsYXNzIG9mIFVuaXR5IGZvciBpdHMgZGV0YWlscy5cbiAqXG4gKiBTZWU6IGh0dHBzOi8vZG9jcy51bml0eTNkLmNvbS9qYS9jdXJyZW50L1NjcmlwdFJlZmVyZW5jZS9BbmltYXRpb25DdXJ2ZS5odG1sXG4gKlxuICogQHBhcmFtIGFyciBBbiBhcnJheSByZXByZXNlbnRzIGEgY3VydmVcbiAqIEBwYXJhbSB4IEFuIGlucHV0IHZhbHVlXG4gKi9cbmNvbnN0IGV2YWx1YXRlQ3VydmUgPSAoYXJyOiBudW1iZXJbXSwgeDogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgLy8gLS0gc2FuaXR5IGNoZWNrIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGlmIChhcnIubGVuZ3RoIDwgOCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZXZhbHVhdGVDdXJ2ZTogSW52YWxpZCBjdXJ2ZSBkZXRlY3RlZCEgKEFycmF5IGxlbmd0aCBtdXN0IGJlIDggYXQgbGVhc3QpJyk7XG4gIH1cbiAgaWYgKGFyci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdldmFsdWF0ZUN1cnZlOiBJbnZhbGlkIGN1cnZlIGRldGVjdGVkISAoQXJyYXkgbGVuZ3RoIG11c3QgYmUgbXVsdGlwbGVzIG9mIDQnKTtcbiAgfVxuXG4gIC8vIC0tIGNoZWNrIHJhbmdlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBsZXQgb3V0Tm9kZTtcbiAgZm9yIChvdXROb2RlID0gMDsgOyBvdXROb2RlKyspIHtcbiAgICBpZiAoYXJyLmxlbmd0aCA8PSA0ICogb3V0Tm9kZSkge1xuICAgICAgcmV0dXJuIGFycls0ICogb3V0Tm9kZSAtIDNdOyAvLyB0b28gZnVydGhlciEhIGFzc3VtZSBhcyBcIkNsYW1wXCJcbiAgICB9IGVsc2UgaWYgKHggPD0gYXJyWzQgKiBvdXROb2RlXSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaW5Ob2RlID0gb3V0Tm9kZSAtIDE7XG4gIGlmIChpbk5vZGUgPCAwKSB7XG4gICAgcmV0dXJuIGFycls0ICogaW5Ob2RlICsgNV07IC8vIHRvbyBiZWhpbmQhISBhc3N1bWUgYXMgXCJDbGFtcFwiXG4gIH1cblxuICAvLyAtLSBjYWxjdWxhdGUgbG9jYWwgeCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgY29uc3QgeDAgPSBhcnJbNCAqIGluTm9kZV07XG4gIGNvbnN0IHgxID0gYXJyWzQgKiBvdXROb2RlXTtcbiAgY29uc3QgeEhlcm1pdGUgPSAoeCAtIHgwKSAvICh4MSAtIHgwKTtcblxuICAvLyAtLSBmaW5hbGx5IGRvIHRoZSBoZXJtaXRlIHNwbGluZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgY29uc3QgeTAgPSBhcnJbNCAqIGluTm9kZSArIDFdO1xuICBjb25zdCB5MSA9IGFycls0ICogb3V0Tm9kZSArIDFdO1xuICBjb25zdCB0MCA9IGFycls0ICogaW5Ob2RlICsgM107XG4gIGNvbnN0IHQxID0gYXJyWzQgKiBvdXROb2RlICsgMl07XG4gIHJldHVybiBoZXJtaXRlU3BsaW5lKHkwLCB5MSwgdDAsIHQxLCB4SGVybWl0ZSk7XG59O1xuXG4vKipcbiAqIFRoaXMgaXMgYW4gZXF1aXZhbGVudCBvZiBDdXJ2ZU1hcHBlciBjbGFzcyBkZWZpbmVkIGluIFVuaVZSTS5cbiAqIFdpbGwgYmUgdXNlZCBmb3IgW1tWUk1Mb29rQXRBcHBseWVyXV1zLCB0byBkZWZpbmUgYmVoYXZpb3Igb2YgTG9va0F0LlxuICpcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iL21hc3Rlci9Bc3NldHMvVlJNL1VuaVZSTS9TY3JpcHRzL0xvb2tBdC9DdXJ2ZU1hcHBlci5jc1xuICovXG5leHBvcnQgY2xhc3MgVlJNQ3VydmVNYXBwZXIge1xuICAvKipcbiAgICogQW4gYXJyYXkgcmVwcmVzZW50cyB0aGUgY3VydmUuIFNlZSBBbmltYXRpb25DdXJ2ZSBjbGFzcyBvZiBVbml0eSBmb3IgaXRzIGRldGFpbHMuXG4gICAqXG4gICAqIFNlZTogaHR0cHM6Ly9kb2NzLnVuaXR5M2QuY29tL2phL2N1cnJlbnQvU2NyaXB0UmVmZXJlbmNlL0FuaW1hdGlvbkN1cnZlLmh0bWxcbiAgICovXG4gIHB1YmxpYyBjdXJ2ZTogbnVtYmVyW10gPSBbMC4wLCAwLjAsIDAuMCwgMS4wLCAxLjAsIDEuMCwgMS4wLCAwLjBdO1xuXG4gIC8qKlxuICAgKiBUaGUgbWF4aW11bSBpbnB1dCByYW5nZSBvZiB0aGUgW1tWUk1DdXJ2ZU1hcHBlcl1dLlxuICAgKi9cbiAgcHVibGljIGN1cnZlWFJhbmdlRGVncmVlID0gOTAuMDtcblxuICAvKipcbiAgICogVGhlIG1heGltdW0gb3V0cHV0IHZhbHVlIG9mIHRoZSBbW1ZSTUN1cnZlTWFwcGVyXV0uXG4gICAqL1xuICBwdWJsaWMgY3VydmVZUmFuZ2VEZWdyZWUgPSAxMC4wO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgW1tWUk1DdXJ2ZU1hcHBlcl1dLlxuICAgKlxuICAgKiBAcGFyYW0geFJhbmdlIFRoZSBtYXhpbXVtIGlucHV0IHJhbmdlXG4gICAqIEBwYXJhbSB5UmFuZ2UgVGhlIG1heGltdW0gb3V0cHV0IHZhbHVlXG4gICAqIEBwYXJhbSBjdXJ2ZSBBbiBhcnJheSByZXByZXNlbnRzIHRoZSBjdXJ2ZVxuICAgKi9cbiAgY29uc3RydWN0b3IoeFJhbmdlPzogbnVtYmVyLCB5UmFuZ2U/OiBudW1iZXIsIGN1cnZlPzogbnVtYmVyW10pIHtcbiAgICBpZiAoeFJhbmdlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuY3VydmVYUmFuZ2VEZWdyZWUgPSB4UmFuZ2U7XG4gICAgfVxuXG4gICAgaWYgKHlSYW5nZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmN1cnZlWVJhbmdlRGVncmVlID0geVJhbmdlO1xuICAgIH1cblxuICAgIGlmIChjdXJ2ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmN1cnZlID0gY3VydmU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV2YWx1YXRlIGFuIGlucHV0IHZhbHVlIGFuZCBvdXRwdXQgYSBtYXBwZWQgdmFsdWUuXG4gICAqXG4gICAqIEBwYXJhbSBzcmMgVGhlIGlucHV0IHZhbHVlXG4gICAqL1xuICBwdWJsaWMgbWFwKHNyYzogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBjbGFtcGVkU3JjID0gTWF0aC5taW4oTWF0aC5tYXgoc3JjLCAwLjApLCB0aGlzLmN1cnZlWFJhbmdlRGVncmVlKTtcbiAgICBjb25zdCB4ID0gY2xhbXBlZFNyYyAvIHRoaXMuY3VydmVYUmFuZ2VEZWdyZWU7XG4gICAgcmV0dXJuIHRoaXMuY3VydmVZUmFuZ2VEZWdyZWUgKiBldmFsdWF0ZUN1cnZlKHRoaXMuY3VydmUsIHgpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpcyB1c2VkIGJ5IFtbVlJNTG9va0F0SGVhZF1dLCBhcHBsaWVzIGxvb2sgYXQgZGlyZWN0aW9uLlxuICogVGhlcmUgYXJlIGN1cnJlbnRseSB0d28gdmFyaWFudCBvZiBhcHBsaWVyOiBbW1ZSTUxvb2tBdEJvbmVBcHBseWVyXV0gYW5kIFtbVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXJdXS5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFZSTUxvb2tBdEFwcGx5ZXIge1xuICAvKipcbiAgICogSXQgcmVwcmVzZW50cyBpdHMgdHlwZSBvZiBhcHBsaWVyLlxuICAgKi9cbiAgcHVibGljIGFic3RyYWN0IHJlYWRvbmx5IHR5cGU6IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lO1xuXG4gIC8qKlxuICAgKiBBcHBseSBsb29rIGF0IGRpcmVjdGlvbiB0byBpdHMgYXNzb2NpYXRlZCBWUk0gbW9kZWwuXG4gICAqXG4gICAqIEBwYXJhbSBldWxlciBgVEhSRUUuRXVsZXJgIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgdGhlIGxvb2sgYXQgZGlyZWN0aW9uXG4gICAqL1xuICBwdWJsaWMgYWJzdHJhY3QgbG9va0F0KGV1bGVyOiBUSFJFRS5FdWxlcik6IHZvaWQ7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUN1cnZlTWFwcGVyIH0gZnJvbSAnLi9WUk1DdXJ2ZU1hcHBlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcblxuLyoqXG4gKiBUaGlzIGNsYXNzIGlzIHVzZWQgYnkgW1tWUk1Mb29rQXRIZWFkXV0sIGFwcGxpZXMgbG9vayBhdCBkaXJlY3Rpb24gdG8gZXllIGJsZW5kIHNoYXBlcyBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyIGV4dGVuZHMgVlJNTG9va0F0QXBwbHllciB7XG4gIHB1YmxpYyByZWFkb25seSB0eXBlID0gVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQmxlbmRTaGFwZTtcblxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZUhvcml6b250YWw6IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnZlVmVydGljYWxVcDogVlJNQ3VydmVNYXBwZXI7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZVByb3h5OiBWUk1CbGVuZFNoYXBlUHJveHk7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllci5cbiAgICpcbiAgICogQHBhcmFtIGJsZW5kU2hhcGVQcm94eSBBIFtbVlJNQmxlbmRTaGFwZVByb3h5XV0gdXNlZCBieSB0aGlzIGFwcGxpZXJcbiAgICogQHBhcmFtIGN1cnZlSG9yaXpvbnRhbCBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxuICAgKiBAcGFyYW0gY3VydmVWZXJ0aWNhbERvd24gQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgZG93biBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxVcCBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciB1cCBkaXJlY3Rpb25cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGN1cnZlSG9yaXpvbnRhbDogVlJNQ3VydmVNYXBwZXIsXG4gICAgY3VydmVWZXJ0aWNhbERvd246IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlVmVydGljYWxVcDogVlJNQ3VydmVNYXBwZXIsXG4gICkge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLl9jdXJ2ZUhvcml6b250YWwgPSBjdXJ2ZUhvcml6b250YWw7XG4gICAgdGhpcy5fY3VydmVWZXJ0aWNhbERvd24gPSBjdXJ2ZVZlcnRpY2FsRG93bjtcbiAgICB0aGlzLl9jdXJ2ZVZlcnRpY2FsVXAgPSBjdXJ2ZVZlcnRpY2FsVXA7XG5cbiAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkgPSBibGVuZFNoYXBlUHJveHk7XG4gIH1cblxuICBwdWJsaWMgbmFtZSgpOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZSB7XG4gICAgcmV0dXJuIFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJsZW5kU2hhcGU7XG4gIH1cblxuICBwdWJsaWMgbG9va0F0KGV1bGVyOiBUSFJFRS5FdWxlcik6IHZvaWQge1xuICAgIGNvbnN0IHNyY1ggPSBldWxlci54O1xuICAgIGNvbnN0IHNyY1kgPSBldWxlci55O1xuXG4gICAgaWYgKHNyY1ggPCAwLjApIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va3VwLCAwLjApO1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rZG93biwgdGhpcy5fY3VydmVWZXJ0aWNhbERvd24ubWFwKC1zcmNYKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2Rvd24sIDAuMCk7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2t1cCwgdGhpcy5fY3VydmVWZXJ0aWNhbFVwLm1hcChzcmNYKSk7XG4gICAgfVxuXG4gICAgaWYgKHNyY1kgPCAwLjApIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2xlZnQsIDAuMCk7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tyaWdodCwgdGhpcy5fY3VydmVIb3Jpem9udGFsLm1hcCgtc3JjWSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tyaWdodCwgMC4wKTtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2xlZnQsIHRoaXMuX2N1cnZlSG9yaXpvbnRhbC5tYXAoc3JjWSkpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbi9WUk1GaXJzdFBlcnNvbic7XG5pbXBvcnQgeyBnZXRXb3JsZFF1YXRlcm5pb25MaXRlIH0gZnJvbSAnLi4vdXRpbHMvbWF0aCc7XG5pbXBvcnQgeyBxdWF0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvcXVhdEludmVydENvbXBhdCc7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcblxuY29uc3QgVkVDVE9SM19GUk9OVCA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLlZlY3RvcjMoMC4wLCAwLjAsIC0xLjApKTtcblxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF92M0MgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3F1YXQgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50cyBsb29rIGF0IG9mIGEgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SGVhZCB7XG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgRVVMRVJfT1JERVIgPSAnWVhaJzsgLy8geWF3LXBpdGNoLXJvbGxcblxuICAvKipcbiAgICogQXNzb2NpYXRlZCBbW1ZSTUZpcnN0UGVyc29uXV0sIHdpbGwgYmUgdXNlZCBmb3IgZGlyZWN0aW9uIGNhbGN1bGF0aW9uLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbjtcblxuICAvKipcbiAgICogQXNzb2NpYXRlZCBbW1ZSTUxvb2tBdEFwcGx5ZXJdXSwgaXRzIGxvb2sgYXQgZGlyZWN0aW9uIHdpbGwgYmUgYXBwbGllZCB0byB0aGUgbW9kZWwgdXNpbmcgdGhpcyBhcHBsaWVyLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGFwcGx5ZXI/OiBWUk1Mb29rQXRBcHBseWVyO1xuXG4gIC8qKlxuICAgKiBJZiB0aGlzIGlzIHRydWUsIGl0cyBsb29rIGF0IGRpcmVjdGlvbiB3aWxsIGJlIHVwZGF0ZWQgYXV0b21hdGljYWxseSBieSBjYWxsaW5nIFtbVlJNTG9va0F0SGVhZC51cGRhdGVdXSAod2hpY2ggaXMgY2FsbGVkIGZyb20gW1tWUk0udXBkYXRlXV0pLlxuICAgKlxuICAgKiBTZWUgYWxzbzogW1tWUk1Mb29rQXRIZWFkLnRhcmdldF1dXG4gICAqL1xuICBwdWJsaWMgYXV0b1VwZGF0ZSA9IHRydWU7XG5cbiAgLyoqXG4gICAqIFRoZSB0YXJnZXQgb2JqZWN0IG9mIHRoZSBsb29rIGF0LlxuICAgKiBOb3RlIHRoYXQgaXQgZG9lcyBub3QgbWFrZSBhbnkgc2Vuc2UgaWYgW1tWUk1Mb29rQXRIZWFkLmF1dG9VcGRhdGVdXSBpcyBkaXNhYmxlZC5cbiAgICovXG4gIHB1YmxpYyB0YXJnZXQ/OiBUSFJFRS5PYmplY3QzRDtcblxuICBwcm90ZWN0ZWQgX2V1bGVyOiBUSFJFRS5FdWxlciA9IG5ldyBUSFJFRS5FdWxlcigwLjAsIDAuMCwgMC4wLCBWUk1Mb29rQXRIZWFkLkVVTEVSX09SREVSKTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUxvb2tBdEhlYWQuXG4gICAqXG4gICAqIEBwYXJhbSBmaXJzdFBlcnNvbiBBIFtbVlJNRmlyc3RQZXJzb25dXSB0aGF0IHdpbGwgYmUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbmV3IFZSTUxvb2tBdEhlYWRcbiAgICogQHBhcmFtIGFwcGx5ZXIgQSBbW1ZSTUxvb2tBdEFwcGx5ZXJdXSB0aGF0IHdpbGwgYmUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbmV3IFZSTUxvb2tBdEhlYWRcbiAgICovXG4gIGNvbnN0cnVjdG9yKGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbiwgYXBwbHllcj86IFZSTUxvb2tBdEFwcGx5ZXIpIHtcbiAgICB0aGlzLmZpcnN0UGVyc29uID0gZmlyc3RQZXJzb247XG4gICAgdGhpcy5hcHBseWVyID0gYXBwbHllcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgaXRzIGxvb2sgYXQgZGlyZWN0aW9uIGluIHdvcmxkIGNvb3JkaW5hdGUuXG4gICAqXG4gICAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgYFRIUkVFLlZlY3RvcjNgXG4gICAqL1xuICBwdWJsaWMgZ2V0TG9va0F0V29ybGREaXJlY3Rpb24odGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgY29uc3Qgcm90ID0gZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZSwgX3F1YXQpO1xuICAgIHJldHVybiB0YXJnZXQuY29weShWRUNUT1IzX0ZST05UKS5hcHBseUV1bGVyKHRoaXMuX2V1bGVyKS5hcHBseVF1YXRlcm5pb24ocm90KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgaXRzIGxvb2sgYXQgcG9zaXRpb24uXG4gICAqIE5vdGUgdGhhdCBpdHMgcmVzdWx0IHdpbGwgYmUgaW5zdGFudGx5IG92ZXJ3cml0dGVuIGlmIFtbVlJNTG9va0F0SGVhZC5hdXRvVXBkYXRlXV0gaXMgZW5hYmxlZC5cbiAgICpcbiAgICogQHBhcmFtIHBvc2l0aW9uIEEgdGFyZ2V0IHBvc2l0aW9uXG4gICAqL1xuICBwdWJsaWMgbG9va0F0KHBvc2l0aW9uOiBUSFJFRS5WZWN0b3IzKTogdm9pZCB7XG4gICAgdGhpcy5fY2FsY0V1bGVyKHRoaXMuX2V1bGVyLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5hcHBseWVyKSB7XG4gICAgICB0aGlzLmFwcGx5ZXIubG9va0F0KHRoaXMuX2V1bGVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBWUk1Mb29rQXRIZWFkLlxuICAgKiBJZiBbW1ZSTUxvb2tBdEhlYWQuYXV0b1VwZGF0ZV1dIGlzIGRpc2FibGVkLCBpdCB3aWxsIGRvIG5vdGhpbmcuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICh0aGlzLnRhcmdldCAmJiB0aGlzLmF1dG9VcGRhdGUpIHtcbiAgICAgIHRoaXMubG9va0F0KHRoaXMudGFyZ2V0LmdldFdvcmxkUG9zaXRpb24oX3YzQSkpO1xuXG4gICAgICBpZiAodGhpcy5hcHBseWVyKSB7XG4gICAgICAgIHRoaXMuYXBwbHllci5sb29rQXQodGhpcy5fZXVsZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBfY2FsY0V1bGVyKHRhcmdldDogVEhSRUUuRXVsZXIsIHBvc2l0aW9uOiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuRXVsZXIge1xuICAgIGNvbnN0IGhlYWRQb3NpdGlvbiA9IHRoaXMuZmlyc3RQZXJzb24uZ2V0Rmlyc3RQZXJzb25Xb3JsZFBvc2l0aW9uKF92M0IpO1xuXG4gICAgLy8gTG9vayBhdCBkaXJlY3Rpb24gaW4gd29ybGQgY29vcmRpbmF0ZVxuICAgIGNvbnN0IGxvb2tBdERpciA9IF92M0MuY29weShwb3NpdGlvbikuc3ViKGhlYWRQb3NpdGlvbikubm9ybWFsaXplKCk7XG5cbiAgICAvLyBUcmFuc2Zvcm0gdGhlIGRpcmVjdGlvbiBpbnRvIGxvY2FsIGNvb3JkaW5hdGUgZnJvbSB0aGUgZmlyc3QgcGVyc29uIGJvbmVcbiAgICBsb29rQXREaXIuYXBwbHlRdWF0ZXJuaW9uKHF1YXRJbnZlcnRDb21wYXQoZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZSwgX3F1YXQpKSk7XG5cbiAgICAvLyBjb252ZXJ0IHRoZSBkaXJlY3Rpb24gaW50byBldWxlclxuICAgIHRhcmdldC54ID0gTWF0aC5hdGFuMihsb29rQXREaXIueSwgTWF0aC5zcXJ0KGxvb2tBdERpci54ICogbG9va0F0RGlyLnggKyBsb29rQXREaXIueiAqIGxvb2tBdERpci56KSk7XG4gICAgdGFyZ2V0LnkgPSBNYXRoLmF0YW4yKC1sb29rQXREaXIueCwgLWxvb2tBdERpci56KTtcblxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi4vaHVtYW5vaWQnO1xuaW1wb3J0IHsgR0xURk5vZGUsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUN1cnZlTWFwcGVyIH0gZnJvbSAnLi9WUk1DdXJ2ZU1hcHBlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWQnO1xuXG5jb25zdCBfZXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoMC4wLCAwLjAsIDAuMCwgVlJNTG9va0F0SGVhZC5FVUxFUl9PUkRFUik7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpcyB1c2VkIGJ5IFtbVlJNTG9va0F0SGVhZF1dLCBhcHBsaWVzIGxvb2sgYXQgZGlyZWN0aW9uIHRvIGV5ZSBib25lcyBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEJvbmVBcHBseWVyIGV4dGVuZHMgVlJNTG9va0F0QXBwbHllciB7XG4gIHB1YmxpYyByZWFkb25seSB0eXBlID0gVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQm9uZTtcblxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZUhvcml6b250YWxJbm5lcjogVlJNQ3VydmVNYXBwZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnZlSG9yaXpvbnRhbE91dGVyOiBWUk1DdXJ2ZU1hcHBlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbERvd246IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX2xlZnRFeWU6IEdMVEZOb2RlIHwgbnVsbDtcbiAgcHJpdmF0ZSByZWFkb25seSBfcmlnaHRFeWU6IEdMVEZOb2RlIHwgbnVsbDtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUxvb2tBdEJvbmVBcHBseWVyLlxuICAgKlxuICAgKiBAcGFyYW0gaHVtYW5vaWQgQSBbW1ZSTUh1bWFub2lkXV0gdXNlZCBieSB0aGlzIGFwcGxpZXJcbiAgICogQHBhcmFtIGN1cnZlSG9yaXpvbnRhbElubmVyIEEgW1tWUk1DdXJ2ZU1hcHBlcl1dIHVzZWQgZm9yIGlubmVyIHRyYW5zdmVyc2UgZGlyZWN0aW9uXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWxPdXRlciBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBvdXRlciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxuICAgKiBAcGFyYW0gY3VydmVWZXJ0aWNhbERvd24gQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgZG93biBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxVcCBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciB1cCBkaXJlY3Rpb25cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgICBjdXJ2ZUhvcml6b250YWxJbm5lcjogVlJNQ3VydmVNYXBwZXIsXG4gICAgY3VydmVIb3Jpem9udGFsT3V0ZXI6IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlVmVydGljYWxEb3duOiBWUk1DdXJ2ZU1hcHBlcixcbiAgICBjdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyLFxuICApIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5fY3VydmVIb3Jpem9udGFsSW5uZXIgPSBjdXJ2ZUhvcml6b250YWxJbm5lcjtcbiAgICB0aGlzLl9jdXJ2ZUhvcml6b250YWxPdXRlciA9IGN1cnZlSG9yaXpvbnRhbE91dGVyO1xuICAgIHRoaXMuX2N1cnZlVmVydGljYWxEb3duID0gY3VydmVWZXJ0aWNhbERvd247XG4gICAgdGhpcy5fY3VydmVWZXJ0aWNhbFVwID0gY3VydmVWZXJ0aWNhbFVwO1xuXG4gICAgdGhpcy5fbGVmdEV5ZSA9IGh1bWFub2lkLmdldEJvbmVOb2RlKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lLkxlZnRFeWUpO1xuICAgIHRoaXMuX3JpZ2h0RXllID0gaHVtYW5vaWQuZ2V0Qm9uZU5vZGUoVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUuUmlnaHRFeWUpO1xuICB9XG5cbiAgcHVibGljIGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkIHtcbiAgICBjb25zdCBzcmNYID0gZXVsZXIueDtcbiAgICBjb25zdCBzcmNZID0gZXVsZXIueTtcblxuICAgIC8vIGxlZnRcbiAgICBpZiAodGhpcy5fbGVmdEV5ZSkge1xuICAgICAgaWYgKHNyY1ggPCAwLjApIHtcbiAgICAgICAgX2V1bGVyLnggPSAtdGhpcy5fY3VydmVWZXJ0aWNhbERvd24ubWFwKC1zcmNYKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF9ldWxlci54ID0gdGhpcy5fY3VydmVWZXJ0aWNhbFVwLm1hcChzcmNYKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNyY1kgPCAwLjApIHtcbiAgICAgICAgX2V1bGVyLnkgPSAtdGhpcy5fY3VydmVIb3Jpem9udGFsSW5uZXIubWFwKC1zcmNZKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF9ldWxlci55ID0gdGhpcy5fY3VydmVIb3Jpem9udGFsT3V0ZXIubWFwKHNyY1kpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9sZWZ0RXllLnF1YXRlcm5pb24uc2V0RnJvbUV1bGVyKF9ldWxlcik7XG4gICAgfVxuXG4gICAgLy8gcmlnaHRcbiAgICBpZiAodGhpcy5fcmlnaHRFeWUpIHtcbiAgICAgIGlmIChzcmNYIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci54ID0gLXRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueCA9IHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzcmNZIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci55ID0gLXRoaXMuX2N1cnZlSG9yaXpvbnRhbE91dGVyLm1hcCgtc3JjWSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueSA9IHRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyLm1hcChzcmNZKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fcmlnaHRFeWUucXVhdGVybmlvbi5zZXRGcm9tRXVsZXIoX2V1bGVyKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4uL2JsZW5kc2hhcGUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbic7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUN1cnZlTWFwcGVyIH0gZnJvbSAnLi9WUk1DdXJ2ZU1hcHBlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcbmltcG9ydCB7IFZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRCb25lQXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0Qm9uZUFwcGx5ZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZCB9IGZyb20gJy4vVlJNTG9va0F0SGVhZCc7XG5cbi8vIFRIUkVFLk1hdGggaGFzIGJlZW4gcmVuYW1lZCB0byBUSFJFRS5NYXRoVXRpbHMgc2luY2UgcjExMy5cbi8vIFdlIGFyZSBnb2luZyB0byBkZWZpbmUgdGhlIERFRzJSQUQgYnkgb3Vyc2VsdmVzIGZvciBhIHdoaWxlXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMTgyNzBcbmNvbnN0IERFRzJSQUQgPSBNYXRoLlBJIC8gMTgwOyAvLyBUSFJFRS5NYXRoVXRpbHMuREVHMlJBRDtcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUxvb2tBdEhlYWRdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRJbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJbXBvcnQgYSBbW1ZSTUxvb2tBdEhlYWRdXSBmcm9tIGEgVlJNLlxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICogQHBhcmFtIGJsZW5kU2hhcGVQcm94eSBBIFtbVlJNQmxlbmRTaGFwZVByb3h5XV0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cbiAgICogQHBhcmFtIGh1bWFub2lkIEEgW1tWUk1IdW1hbm9pZF1dIGluc3RhbmNlIHRoYXQgcmVwcmVzZW50cyB0aGUgVlJNXG4gICAqL1xuICBwdWJsaWMgaW1wb3J0KFxuICAgIGdsdGY6IEdMVEYsXG4gICAgZmlyc3RQZXJzb246IFZSTUZpcnN0UGVyc29uLFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgKTogVlJNTG9va0F0SGVhZCB8IG51bGwge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGFwcGx5ZXIgPSB0aGlzLl9pbXBvcnRBcHBseWVyKHNjaGVtYUZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKTtcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdEhlYWQoZmlyc3RQZXJzb24sIGFwcGx5ZXIgfHwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfaW1wb3J0QXBwbHllcihcbiAgICBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uLFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgKTogVlJNTG9va0F0QXBwbHllciB8IG51bGwge1xuICAgIGNvbnN0IGxvb2tBdEhvcml6b250YWxJbm5lciA9IHNjaGVtYUZpcnN0UGVyc29uLmxvb2tBdEhvcml6b250YWxJbm5lcjtcbiAgICBjb25zdCBsb29rQXRIb3Jpem9udGFsT3V0ZXIgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRIb3Jpem9udGFsT3V0ZXI7XG4gICAgY29uc3QgbG9va0F0VmVydGljYWxEb3duID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VmVydGljYWxEb3duO1xuICAgIGNvbnN0IGxvb2tBdFZlcnRpY2FsVXAgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRWZXJ0aWNhbFVwO1xuXG4gICAgc3dpdGNoIChzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRUeXBlTmFtZSkge1xuICAgICAgY2FzZSBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZS5Cb25lOiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBsb29rQXRIb3Jpem9udGFsSW5uZXIgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGxvb2tBdEhvcml6b250YWxPdXRlciA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgbG9va0F0VmVydGljYWxEb3duID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBsb29rQXRWZXJ0aWNhbFVwID09PSB1bmRlZmluZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRCb25lQXBwbHllcihcbiAgICAgICAgICAgIGh1bWFub2lkLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCb25lKGxvb2tBdEhvcml6b250YWxJbm5lciksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobG9va0F0SG9yaXpvbnRhbE91dGVyKSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQm9uZShsb29rQXRWZXJ0aWNhbERvd24pLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCb25lKGxvb2tBdFZlcnRpY2FsVXApLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNhc2UgVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQmxlbmRTaGFwZToge1xuICAgICAgICBpZiAobG9va0F0SG9yaXpvbnRhbE91dGVyID09PSB1bmRlZmluZWQgfHwgbG9va0F0VmVydGljYWxEb3duID09PSB1bmRlZmluZWQgfHwgbG9va0F0VmVydGljYWxVcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllcihcbiAgICAgICAgICAgIGJsZW5kU2hhcGVQcm94eSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQmxlbmRTaGFwZShsb29rQXRIb3Jpem9udGFsT3V0ZXIpLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCbGVuZFNoYXBlKGxvb2tBdFZlcnRpY2FsRG93biksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJsZW5kU2hhcGUobG9va0F0VmVydGljYWxVcCksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZGVmYXVsdDoge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobWFwOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25EZWdyZWVNYXApOiBWUk1DdXJ2ZU1hcHBlciB7XG4gICAgcmV0dXJuIG5ldyBWUk1DdXJ2ZU1hcHBlcihcbiAgICAgIHR5cGVvZiBtYXAueFJhbmdlID09PSAnbnVtYmVyJyA/IERFRzJSQUQgKiBtYXAueFJhbmdlIDogdW5kZWZpbmVkLFxuICAgICAgdHlwZW9mIG1hcC55UmFuZ2UgPT09ICdudW1iZXInID8gREVHMlJBRCAqIG1hcC55UmFuZ2UgOiB1bmRlZmluZWQsXG4gICAgICBtYXAuY3VydmUsXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgX2ltcG9ydEN1cnZlTWFwcGVyQmxlbmRTaGFwZShtYXA6IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkRlZ3JlZU1hcCk6IFZSTUN1cnZlTWFwcGVyIHtcbiAgICByZXR1cm4gbmV3IFZSTUN1cnZlTWFwcGVyKHR5cGVvZiBtYXAueFJhbmdlID09PSAnbnVtYmVyJyA/IERFRzJSQUQgKiBtYXAueFJhbmdlIDogdW5kZWZpbmVkLCBtYXAueVJhbmdlLCBtYXAuY3VydmUpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbmV4cG9ydCBjb25zdCBnZXRFbmNvZGluZ0NvbXBvbmVudHMgPSAoZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZyk6IFtzdHJpbmcsIHN0cmluZ10gPT4ge1xuICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgY2FzZSBUSFJFRS5MaW5lYXJFbmNvZGluZzpcbiAgICAgIHJldHVybiBbJ0xpbmVhcicsICcoIHZhbHVlICknXTtcbiAgICBjYXNlIFRIUkVFLnNSR0JFbmNvZGluZzpcbiAgICAgIHJldHVybiBbJ3NSR0InLCAnKCB2YWx1ZSApJ107XG4gICAgY2FzZSBUSFJFRS5SR0JFRW5jb2Rpbmc6XG4gICAgICByZXR1cm4gWydSR0JFJywgJyggdmFsdWUgKSddO1xuICAgIGNhc2UgVEhSRUUuUkdCTTdFbmNvZGluZzpcbiAgICAgIHJldHVybiBbJ1JHQk0nLCAnKCB2YWx1ZSwgNy4wICknXTtcbiAgICBjYXNlIFRIUkVFLlJHQk0xNkVuY29kaW5nOlxuICAgICAgcmV0dXJuIFsnUkdCTScsICcoIHZhbHVlLCAxNi4wICknXTtcbiAgICBjYXNlIFRIUkVFLlJHQkRFbmNvZGluZzpcbiAgICAgIHJldHVybiBbJ1JHQkQnLCAnKCB2YWx1ZSwgMjU2LjAgKSddO1xuICAgIGNhc2UgVEhSRUUuR2FtbWFFbmNvZGluZzpcbiAgICAgIHJldHVybiBbJ0dhbW1hJywgJyggdmFsdWUsIGZsb2F0KCBHQU1NQV9GQUNUT1IgKSApJ107XG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQgZW5jb2Rpbmc6ICcgKyBlbmNvZGluZyk7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24gPSAoZnVuY3Rpb25OYW1lOiBzdHJpbmcsIGVuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2RpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBjb21wb25lbnRzID0gZ2V0RW5jb2RpbmdDb21wb25lbnRzKGVuY29kaW5nKTtcbiAgcmV0dXJuICd2ZWM0ICcgKyBmdW5jdGlvbk5hbWUgKyAnKCB2ZWM0IHZhbHVlICkgeyByZXR1cm4gJyArIGNvbXBvbmVudHNbMF0gKyAnVG9MaW5lYXInICsgY29tcG9uZW50c1sxXSArICc7IH0nO1xufTtcbiIsIi8qIHRzbGludDpkaXNhYmxlOm1lbWJlci1vcmRlcmluZyAqL1xuXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24gfSBmcm9tICcuL2dldFRleGVsRGVjb2RpbmdGdW5jdGlvbic7XG5pbXBvcnQgdmVydGV4U2hhZGVyIGZyb20gJy4vc2hhZGVycy9tdG9vbi52ZXJ0JztcbmltcG9ydCBmcmFnbWVudFNoYWRlciBmcm9tICcuL3NoYWRlcnMvbXRvb24uZnJhZyc7XG5cbmNvbnN0IFRBVSA9IDIuMCAqIE1hdGguUEk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTVRvb25QYXJhbWV0ZXJzIGV4dGVuZHMgVEhSRUUuU2hhZGVyTWF0ZXJpYWxQYXJhbWV0ZXJzIHtcbiAgbVRvb25WZXJzaW9uPzogbnVtYmVyOyAvLyBfTVRvb25WZXJzaW9uXG5cbiAgY3V0b2ZmPzogbnVtYmVyOyAvLyBfQ3V0b2ZmXG4gIGNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gcmdiIG9mIF9Db2xvclxuICBzaGFkZUNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gX1NoYWRlQ29sb3JcbiAgbWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX01haW5UZXhcbiAgbWFpblRleD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4ICh3aWxsIGJlIHJlbmFtZWQgdG8gbWFwKVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gIG1haW5UZXhfU1Q/OiBUSFJFRS5WZWN0b3I0OyAvLyBfTWFpblRleF9TVFxuICBzaGFkZVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU2hhZGVUZXh0dXJlXG4gIGJ1bXBTY2FsZT86IG51bWJlcjsgLy8gX0J1bXBTY2FsZSAod2lsbCBiZSBjb252ZXJ0ZWQgdG8gbm9ybWFsU2NhbGUpXG4gIG5vcm1hbE1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9CdW1wTWFwXG4gIG5vcm1hbE1hcFR5cGU/OiBUSFJFRS5Ob3JtYWxNYXBUeXBlczsgLy8gVGhyZWUuanMgc3BlY2lmaWMgdmFsdWVcbiAgbm9ybWFsU2NhbGU/OiBUSFJFRS5WZWN0b3IyOyAvLyBfQnVtcFNjYWxlIGluIFRocmVlLmpzIGZhc2hpb25cbiAgYnVtcE1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9CdW1wTWFwICh3aWxsIGJlIHJlbmFtZWQgdG8gbm9ybWFsTWFwKVxuICByZWNlaXZlU2hhZG93UmF0ZT86IG51bWJlcjsgLy8gX1JlY2VpdmVTaGFkb3dSYXRlXG4gIHJlY2VpdmVTaGFkb3dUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1JlY2VpdmVTaGFkb3dUZXh0dXJlXG4gIHNoYWRpbmdHcmFkZVJhdGU/OiBudW1iZXI7IC8vIF9TaGFkaW5nR3JhZGVSYXRlXG4gIHNoYWRpbmdHcmFkZVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU2hhZGluZ0dyYWRlVGV4dHVyZVxuICBzaGFkZVNoaWZ0PzogbnVtYmVyOyAvLyBfU2hhZGVTaGlmdFxuICBzaGFkZVRvb255PzogbnVtYmVyOyAvLyBfU2hhZGVUb29ueVxuICBsaWdodENvbG9yQXR0ZW51YXRpb24/OiBudW1iZXI7IC8vIF9MaWdodENvbG9yQXR0ZW51YXRpb25cbiAgaW5kaXJlY3RMaWdodEludGVuc2l0eT86IG51bWJlcjsgLy8gX0luZGlyZWN0TGlnaHRJbnRlbnNpdHlcbiAgcmltVGV4dHVyZT86IFRIUkVFLlRleHR1cmU7IC8vIF9SaW1UZXh0dXJlXG4gIHJpbUNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gX1JpbUNvbG9yXG4gIHJpbUxpZ2h0aW5nTWl4PzogbnVtYmVyOyAvLyBfUmltTGlnaHRpbmdNaXhcbiAgcmltRnJlc25lbFBvd2VyPzogbnVtYmVyOyAvLyBfUmltRnJlc25lbFBvd2VyXG4gIHJpbUxpZnQ/OiBudW1iZXI7IC8vIF9SaW1MaWZ0XG4gIHNwaGVyZUFkZD86IFRIUkVFLlRleHR1cmU7IC8vIF9TcGhlcmVBZGRcbiAgZW1pc3Npb25Db2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9FbWlzc2lvbkNvbG9yXG4gIGVtaXNzaXZlTWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX0VtaXNzaW9uTWFwXG4gIGVtaXNzaW9uTWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX0VtaXNzaW9uTWFwICh3aWxsIGJlIHJlbmFtZWQgdG8gZW1pc3NpdmVNYXApXG4gIG91dGxpbmVXaWR0aFRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfT3V0bGluZVdpZHRoVGV4dHVyZVxuICBvdXRsaW5lV2lkdGg/OiBudW1iZXI7IC8vIF9PdXRsaW5lV2lkdGhcbiAgb3V0bGluZVNjYWxlZE1heERpc3RhbmNlPzogbnVtYmVyOyAvLyBfT3V0bGluZVNjYWxlZE1heERpc3RhbmNlXG4gIG91dGxpbmVDb2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9PdXRsaW5lQ29sb3JcbiAgb3V0bGluZUxpZ2h0aW5nTWl4PzogbnVtYmVyOyAvLyBfT3V0bGluZUxpZ2h0aW5nTWl4XG4gIHV2QW5pbU1hc2tUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1V2QW5pbU1hc2tUZXh0dXJlXG4gIHV2QW5pbVNjcm9sbFg/OiBudW1iZXI7IC8vIF9VdkFuaW1TY3JvbGxYXG4gIHV2QW5pbVNjcm9sbFk/OiBudW1iZXI7IC8vIF9VdkFuaW1TY3JvbGxZXG4gIHV2QW5pbVJvdGF0aW9uPzogbnVtYmVyOyAvLyBfdXZBbmltUm90YXRpb25cblxuICBkZWJ1Z01vZGU/OiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHwgbnVtYmVyOyAvLyBfRGVidWdNb2RlXG4gIGJsZW5kTW9kZT86IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHwgbnVtYmVyOyAvLyBfQmxlbmRNb2RlXG4gIG91dGxpbmVXaWR0aE1vZGU/OiBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSB8IG51bWJlcjsgLy8gT3V0bGluZVdpZHRoTW9kZVxuICBvdXRsaW5lQ29sb3JNb2RlPzogTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUgfCBudW1iZXI7IC8vIE91dGxpbmVDb2xvck1vZGVcbiAgY3VsbE1vZGU/OiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUgfCBudW1iZXI7IC8vIF9DdWxsTW9kZVxuICBvdXRsaW5lQ3VsbE1vZGU/OiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUgfCBudW1iZXI7IC8vIF9PdXRsaW5lQ3VsbE1vZGVcbiAgc3JjQmxlbmQ/OiBudW1iZXI7IC8vIF9TcmNCbGVuZFxuICBkc3RCbGVuZD86IG51bWJlcjsgLy8gX0RzdEJsZW5kXG4gIHpXcml0ZT86IG51bWJlcjsgLy8gX1pXcml0ZSAod2lsbCBiZSByZW5hbWVkIHRvIGRlcHRoV3JpdGUpXG5cbiAgaXNPdXRsaW5lPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogU3BlY2lmeSB0aGUgZW5jb2Rpbmcgb2YgaW5wdXQgdW5pZm9ybSBjb2xvcnMuXG4gICAqXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuc1JHQkVuY29kaW5nYCwgdXNlIGBUSFJFRS5zUkdCRW5jb2RpbmdgLlxuICAgKlxuICAgKiBFbmNvZGluZ3Mgb2YgdGV4dHVyZXMgc2hvdWxkIGJlIHNldCBpbmRlcGVuZGVudGx5IG9uIHRleHR1cmVzLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgdXNlIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AgaWYgdGhpcyBvcHRpb24gaXNuJ3Qgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBTZWUgYWxzbzogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vcmVuZGVyZXJzL1dlYkdMUmVuZGVyZXIub3V0cHV0RW5jb2RpbmdcbiAgICovXG4gIGVuY29kaW5nPzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUge1xuICBPZmYsXG4gIEZyb250LFxuICBCYWNrLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHtcbiAgTm9uZSxcbiAgTm9ybWFsLFxuICBMaXRTaGFkZVJhdGUsXG4gIFVWLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSB7XG4gIEZpeGVkQ29sb3IsXG4gIE1peGVkTGlnaHRpbmcsXG59XG5cbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcbiAgTm9uZSxcbiAgV29ybGRDb29yZGluYXRlcyxcbiAgU2NyZWVuQ29vcmRpbmF0ZXMsXG59XG5cbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHtcbiAgT3BhcXVlLFxuICBDdXRvdXQsXG4gIFRyYW5zcGFyZW50LFxuICBUcmFuc3BhcmVudFdpdGhaV3JpdGUsXG59XG5cbi8qKlxuICogTVRvb24gaXMgYSBtYXRlcmlhbCBzcGVjaWZpY2F0aW9uIHRoYXQgaGFzIHZhcmlvdXMgZmVhdHVyZXMuXG4gKiBUaGUgc3BlYyBhbmQgaW1wbGVtZW50YXRpb24gYXJlIG9yaWdpbmFsbHkgZm91bmRlZCBmb3IgVW5pdHkgZW5naW5lIGFuZCB0aGlzIGlzIGEgcG9ydCBvZiB0aGUgbWF0ZXJpYWwuXG4gKlxuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vU2FudGFyaC9NVG9vblxuICovXG5leHBvcnQgY2xhc3MgTVRvb25NYXRlcmlhbCBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsIHtcbiAgLyoqXG4gICAqIFJlYWRvbmx5IGJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhpcyBpcyBhIFtbTVRvb25NYXRlcmlhbF1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGlzTVRvb25NYXRlcmlhbDogYm9vbGVhbiA9IHRydWU7XG5cbiAgcHVibGljIGN1dG9mZiA9IDAuNTsgLy8gX0N1dG9mZlxuICBwdWJsaWMgY29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgxLjAsIDEuMCwgMS4wLCAxLjApOyAvLyBfQ29sb3JcbiAgcHVibGljIHNoYWRlQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjk3LCAwLjgxLCAwLjg2LCAxLjApOyAvLyBfU2hhZGVDb2xvclxuICBwdWJsaWMgbWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9NYWluVGV4XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgcHVibGljIG1haW5UZXhfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfTWFpblRleF9TVFxuICBwdWJsaWMgc2hhZGVUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9TaGFkZVRleHR1cmVcbiAgLy8gcHVibGljIHNoYWRlVGV4dHVyZV9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9TaGFkZVRleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIG5vcm1hbE1hcDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfQnVtcE1hcC4gYWdhaW4sIFRISVMgSVMgX0J1bXBNYXBcbiAgcHVibGljIG5vcm1hbE1hcFR5cGUgPSBUSFJFRS5UYW5nZW50U3BhY2VOb3JtYWxNYXA7IC8vIFRocmVlLmpzIHJlcXVpcmVzIHRoaXNcbiAgcHVibGljIG5vcm1hbFNjYWxlID0gbmV3IFRIUkVFLlZlY3RvcjIoMS4wLCAxLjApOyAvLyBfQnVtcFNjYWxlLCBpbiBWZWN0b3IyXG4gIC8vIHB1YmxpYyBidW1wTWFwX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX0J1bXBNYXBfU1QgKHVudXNlZClcbiAgcHVibGljIHJlY2VpdmVTaGFkb3dSYXRlID0gMS4wOyAvLyBfUmVjZWl2ZVNoYWRvd1JhdGVcbiAgcHVibGljIHJlY2VpdmVTaGFkb3dUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9SZWNlaXZlU2hhZG93VGV4dHVyZVxuICAvLyBwdWJsaWMgcmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfUmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIHNoYWRpbmdHcmFkZVJhdGUgPSAxLjA7IC8vIF9TaGFkaW5nR3JhZGVSYXRlXG4gIHB1YmxpYyBzaGFkaW5nR3JhZGVUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9TaGFkaW5nR3JhZGVUZXh0dXJlXG4gIC8vIHB1YmxpYyBzaGFkaW5nR3JhZGVUZXh0dXJlX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX1NoYWRpbmdHcmFkZVRleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIHNoYWRlU2hpZnQgPSAwLjA7IC8vIF9TaGFkZVNoaWZ0XG4gIHB1YmxpYyBzaGFkZVRvb255ID0gMC45OyAvLyBfU2hhZGVUb29ueVxuICBwdWJsaWMgbGlnaHRDb2xvckF0dGVudWF0aW9uID0gMC4wOyAvLyBfTGlnaHRDb2xvckF0dGVudWF0aW9uXG4gIHB1YmxpYyBpbmRpcmVjdExpZ2h0SW50ZW5zaXR5ID0gMC4xOyAvLyBfSW5kaXJlY3RMaWdodEludGVuc2l0eVxuICBwdWJsaWMgcmltVGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfUmltVGV4dHVyZVxuICBwdWJsaWMgcmltQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMC4wLCAxLjApOyAvLyBfUmltQ29sb3JcbiAgcHVibGljIHJpbUxpZ2h0aW5nTWl4ID0gMC4wOyAvLyBfUmltTGlnaHRpbmdNaXhcbiAgcHVibGljIHJpbUZyZXNuZWxQb3dlciA9IDEuMDsgLy8gX1JpbUZyZXNuZWxQb3dlclxuICBwdWJsaWMgcmltTGlmdCA9IDAuMDsgLy8gX1JpbUxpZnRcbiAgcHVibGljIHNwaGVyZUFkZDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfU3BoZXJlQWRkXG4gIC8vIHB1YmxpYyBzcGhlcmVBZGRfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfU3BoZXJlQWRkX1NUICh1bnVzZWQpXG4gIHB1YmxpYyBlbWlzc2lvbkNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDAuMCwgMS4wKTsgLy8gX0VtaXNzaW9uQ29sb3JcbiAgcHVibGljIGVtaXNzaXZlTWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9FbWlzc2lvbk1hcFxuICAvLyBwdWJsaWMgZW1pc3Npb25NYXBfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfRW1pc3Npb25NYXBfU1QgKHVudXNlZClcbiAgcHVibGljIG91dGxpbmVXaWR0aFRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVcbiAgLy8gcHVibGljIG91dGxpbmVXaWR0aFRleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfT3V0bGluZVdpZHRoVGV4dHVyZV9TVCAodW51c2VkKVxuICBwdWJsaWMgb3V0bGluZVdpZHRoID0gMC41OyAvLyBfT3V0bGluZVdpZHRoXG4gIHB1YmxpYyBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2UgPSAxLjA7IC8vIF9PdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2VcbiAgcHVibGljIG91dGxpbmVDb2xvciA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAwLjAsIDEuMCk7IC8vIF9PdXRsaW5lQ29sb3JcbiAgcHVibGljIG91dGxpbmVMaWdodGluZ01peCA9IDEuMDsgLy8gX091dGxpbmVMaWdodGluZ01peFxuICBwdWJsaWMgdXZBbmltTWFza1RleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1V2QW5pbU1hc2tUZXh0dXJlXG4gIHB1YmxpYyB1dkFuaW1TY3JvbGxYID0gMC4wOyAvLyBfVXZBbmltU2Nyb2xsWFxuICBwdWJsaWMgdXZBbmltU2Nyb2xsWSA9IDAuMDsgLy8gX1V2QW5pbVNjcm9sbFlcbiAgcHVibGljIHV2QW5pbVJvdGF0aW9uID0gMC4wOyAvLyBfdXZBbmltUm90YXRpb25cblxuICBwdWJsaWMgc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7IC8vIHdoZW4gdGhpcyBpcyB0cnVlLCBhcHBseVVuaWZvcm1zIGVmZmVjdHNcblxuICAvKipcbiAgICogVGhlIGVuY29kaW5nIG9mIGlucHV0IHVuaWZvcm0gY29sb3JzLlxuICAgKlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYC5cbiAgICogV2hlbiB5b3VyIGByZW5kZXJlci5vdXRwdXRFbmNvZGluZ2AgaXMgYFRIUkVFLnNSR0JFbmNvZGluZ2AsIHVzZSBgVEhSRUUuc1JHQkVuY29kaW5nYC5cbiAgICpcbiAgICogRW5jb2RpbmdzIG9mIHRleHR1cmVzIGFyZSBzZXQgaW5kZXBlbmRlbnRseSBvbiB0ZXh0dXJlcy5cbiAgICpcbiAgICogVGhpcyBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgIGJ5IGRlZmF1bHQuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9yZW5kZXJlcnMvV2ViR0xSZW5kZXJlci5vdXRwdXRFbmNvZGluZ1xuICAgKi9cbiAgcHVibGljIGVuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmc7XG5cbiAgcHJpdmF0ZSBfZGVidWdNb2RlID0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5Ob25lOyAvLyBfRGVidWdNb2RlXG4gIHByaXZhdGUgX2JsZW5kTW9kZSA9IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLk9wYXF1ZTsgLy8gX0JsZW5kTW9kZVxuICBwcml2YXRlIF9vdXRsaW5lV2lkdGhNb2RlID0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuTm9uZTsgLy8gX091dGxpbmVXaWR0aE1vZGVcbiAgcHJpdmF0ZSBfb3V0bGluZUNvbG9yTW9kZSA9IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlLkZpeGVkQ29sb3I7IC8vIF9PdXRsaW5lQ29sb3JNb2RlXG4gIHByaXZhdGUgX2N1bGxNb2RlID0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkJhY2s7IC8vIF9DdWxsTW9kZVxuICBwcml2YXRlIF9vdXRsaW5lQ3VsbE1vZGUgPSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQ7IC8vIF9PdXRsaW5lQ3VsbE1vZGVcbiAgLy8gcHVibGljIHNyY0JsZW5kID0gMS4wOyAvLyBfU3JjQmxlbmQgKGlzIG5vdCBzdXBwb3J0ZWQpXG4gIC8vIHB1YmxpYyBkc3RCbGVuZCA9IDAuMDsgLy8gX0RzdEJsZW5kIChpcyBub3Qgc3VwcG9ydGVkKVxuICAvLyBwdWJsaWMgeldyaXRlID0gMS4wOyAvLyBfWldyaXRlICh3aWxsIGJlIGNvbnZlcnRlZCB0byBkZXB0aFdyaXRlKVxuXG4gIHByaXZhdGUgX2lzT3V0bGluZSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgX3V2QW5pbU9mZnNldFggPSAwLjA7XG4gIHByaXZhdGUgX3V2QW5pbU9mZnNldFkgPSAwLjA7XG4gIHByaXZhdGUgX3V2QW5pbVBoYXNlID0gMC4wO1xuXG4gIGNvbnN0cnVjdG9yKHBhcmFtZXRlcnM6IE1Ub29uUGFyYW1ldGVycyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMuZW5jb2RpbmcgPSBwYXJhbWV0ZXJzLmVuY29kaW5nIHx8IFRIUkVFLkxpbmVhckVuY29kaW5nO1xuICAgIGlmICh0aGlzLmVuY29kaW5nICE9PSBUSFJFRS5MaW5lYXJFbmNvZGluZyAmJiB0aGlzLmVuY29kaW5nICE9PSBUSFJFRS5zUkdCRW5jb2RpbmcpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgJ1RoZSBzcGVjaWZpZWQgY29sb3IgZW5jb2RpbmcgZG9lcyBub3Qgd29yayBwcm9wZXJseSB3aXRoIE1Ub29uTWF0ZXJpYWwuIFlvdSBtaWdodCB3YW50IHRvIHVzZSBUSFJFRS5zUkdCRW5jb2RpbmcgaW5zdGVhZC4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA9PSB0aGVzZSBwYXJhbWV0ZXIgaGFzIG5vIGNvbXBhdGliaWxpdHkgd2l0aCB0aGlzIGltcGxlbWVudGF0aW9uID09PT09PT09XG4gICAgW1xuICAgICAgJ21Ub29uVmVyc2lvbicsXG4gICAgICAnc2hhZGVUZXh0dXJlX1NUJyxcbiAgICAgICdidW1wTWFwX1NUJyxcbiAgICAgICdyZWNlaXZlU2hhZG93VGV4dHVyZV9TVCcsXG4gICAgICAnc2hhZGluZ0dyYWRlVGV4dHVyZV9TVCcsXG4gICAgICAncmltVGV4dHVyZV9TVCcsXG4gICAgICAnc3BoZXJlQWRkX1NUJyxcbiAgICAgICdlbWlzc2lvbk1hcF9TVCcsXG4gICAgICAnb3V0bGluZVdpZHRoVGV4dHVyZV9TVCcsXG4gICAgICAndXZBbmltTWFza1RleHR1cmVfU1QnLFxuICAgICAgJ3NyY0JsZW5kJyxcbiAgICAgICdkc3RCbGVuZCcsXG4gICAgXS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmICgocGFyYW1ldGVycyBhcyBhbnkpW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBjb25zb2xlLndhcm4oYFRIUkVFLiR7dGhpcy50eXBlfTogVGhlIHBhcmFtZXRlciBcIiR7a2V5fVwiIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gICAgICAgIGRlbGV0ZSAocGFyYW1ldGVycyBhcyBhbnkpW2tleV07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyA9PSBlbmFibGluZyBidW5jaCBvZiBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgcGFyYW1ldGVycy5mb2cgPSB0cnVlO1xuICAgIHBhcmFtZXRlcnMubGlnaHRzID0gdHJ1ZTtcbiAgICBwYXJhbWV0ZXJzLmNsaXBwaW5nID0gdHJ1ZTtcblxuICAgIHBhcmFtZXRlcnMuc2tpbm5pbmcgPSBwYXJhbWV0ZXJzLnNraW5uaW5nIHx8IGZhbHNlO1xuICAgIHBhcmFtZXRlcnMubW9ycGhUYXJnZXRzID0gcGFyYW1ldGVycy5tb3JwaFRhcmdldHMgfHwgZmFsc2U7XG4gICAgcGFyYW1ldGVycy5tb3JwaE5vcm1hbHMgPSBwYXJhbWV0ZXJzLm1vcnBoTm9ybWFscyB8fCBmYWxzZTtcblxuICAgIC8vID09IHVuaWZvcm1zID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBwYXJhbWV0ZXJzLnVuaWZvcm1zID0gVEhSRUUuVW5pZm9ybXNVdGlscy5tZXJnZShbXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5jb21tb24sIC8vIG1hcFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIubm9ybWFsbWFwLCAvLyBub3JtYWxNYXBcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmVtaXNzaXZlbWFwLCAvLyBlbWlzc2l2ZU1hcFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuZm9nLFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIubGlnaHRzLFxuICAgICAge1xuICAgICAgICBjdXRvZmY6IHsgdmFsdWU6IDAuNSB9LFxuICAgICAgICBjb2xvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDEuMCwgMS4wLCAxLjApIH0sXG4gICAgICAgIGNvbG9yQWxwaGE6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICBzaGFkZUNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC45NywgMC44MSwgMC44NikgfSxcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICAgICAgICBtYWluVGV4X1NUOiB7IHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApIH0sXG4gICAgICAgIHNoYWRlVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICByZWNlaXZlU2hhZG93UmF0ZTogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHJlY2VpdmVTaGFkb3dUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXG4gICAgICAgIHNoYWRpbmdHcmFkZVJhdGU6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICBzaGFkaW5nR3JhZGVUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXG4gICAgICAgIHNoYWRlU2hpZnQ6IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICBzaGFkZVRvb255OiB7IHZhbHVlOiAwLjkgfSxcbiAgICAgICAgbGlnaHRDb2xvckF0dGVudWF0aW9uOiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgICAgaW5kaXJlY3RMaWdodEludGVuc2l0eTogeyB2YWx1ZTogMC4xIH0sXG4gICAgICAgIHJpbVRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgcmltQ29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjAsIDAuMCwgMC4wKSB9LFxuICAgICAgICByaW1MaWdodGluZ01peDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHJpbUZyZXNuZWxQb3dlcjogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHJpbUxpZnQ6IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICBzcGhlcmVBZGQ6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgZW1pc3Npb25Db2xvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuMCwgMC4wLCAwLjApIH0sXG4gICAgICAgIG91dGxpbmVXaWR0aFRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgb3V0bGluZVdpZHRoOiB7IHZhbHVlOiAwLjUgfSxcbiAgICAgICAgb3V0bGluZVNjYWxlZE1heERpc3RhbmNlOiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgb3V0bGluZUNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcbiAgICAgICAgb3V0bGluZUxpZ2h0aW5nTWl4OiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgdXZBbmltTWFza1RleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgdXZBbmltT2Zmc2V0WDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHV2QW5pbU9mZnNldFk6IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICB1dkFuaW1UaGV0YTogeyB2YWx1ZTogMC4wIH0sXG4gICAgICB9LFxuICAgIF0pO1xuXG4gICAgLy8gPT0gZmluYWxseSBjb21waWxlIHRoZSBzaGFkZXIgcHJvZ3JhbSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuc2V0VmFsdWVzKHBhcmFtZXRlcnMpO1xuXG4gICAgLy8gPT0gdXBkYXRlIHNoYWRlciBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XG4gIH1cblxuICBnZXQgbWFpblRleCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubWFwO1xuICB9XG5cbiAgc2V0IG1haW5UZXgodDogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcbiAgICB0aGlzLm1hcCA9IHQ7XG4gIH1cblxuICBnZXQgYnVtcE1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubm9ybWFsTWFwO1xuICB9XG5cbiAgc2V0IGJ1bXBNYXAodDogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcbiAgICB0aGlzLm5vcm1hbE1hcCA9IHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0dGluZyB0aGUgYGJ1bXBTY2FsZWAgcmV1dHJucyBpdHMgeCBjb21wb25lbnQgb2YgYG5vcm1hbFNjYWxlYCAoYXNzdW1pbmcgeCBhbmQgeSBjb21wb25lbnQgb2YgYG5vcm1hbFNjYWxlYCBhcmUgc2FtZSkuXG4gICAqL1xuICBnZXQgYnVtcFNjYWxlKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMubm9ybWFsU2NhbGUueDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXR0aW5nIHRoZSBgYnVtcFNjYWxlYCB3aWxsIGJlIGNvbnZlcnQgdGhlIHZhbHVlIGludG8gVmVjdG9yMiBgbm9ybWFsU2NhbGVgIC5cbiAgICovXG4gIHNldCBidW1wU2NhbGUodDogbnVtYmVyKSB7XG4gICAgdGhpcy5ub3JtYWxTY2FsZS5zZXQodCwgdCk7XG4gIH1cblxuICBnZXQgZW1pc3Npb25NYXAoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmVtaXNzaXZlTWFwO1xuICB9XG5cbiAgc2V0IGVtaXNzaW9uTWFwKHQ6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XG4gICAgdGhpcy5lbWlzc2l2ZU1hcCA9IHQ7XG4gIH1cblxuICBnZXQgYmxlbmRNb2RlKCk6IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fYmxlbmRNb2RlO1xuICB9XG5cbiAgc2V0IGJsZW5kTW9kZShtOiBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZSkge1xuICAgIHRoaXMuX2JsZW5kTW9kZSA9IG07XG5cbiAgICB0aGlzLmRlcHRoV3JpdGUgPSB0aGlzLl9ibGVuZE1vZGUgIT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50O1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPVxuICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudCB8fFxuICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudFdpdGhaV3JpdGU7XG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICB9XG5cbiAgZ2V0IGRlYnVnTW9kZSgpOiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fZGVidWdNb2RlO1xuICB9XG5cbiAgc2V0IGRlYnVnTW9kZShtOiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlKSB7XG4gICAgdGhpcy5fZGVidWdNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgfVxuXG4gIGdldCBvdXRsaW5lV2lkdGhNb2RlKCk6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0bGluZVdpZHRoTW9kZTtcbiAgfVxuXG4gIHNldCBvdXRsaW5lV2lkdGhNb2RlKG06IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlKSB7XG4gICAgdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9IG07XG5cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICBnZXQgb3V0bGluZUNvbG9yTW9kZSgpOiBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX291dGxpbmVDb2xvck1vZGU7XG4gIH1cblxuICBzZXQgb3V0bGluZUNvbG9yTW9kZShtOiBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSkge1xuICAgIHRoaXMuX291dGxpbmVDb2xvck1vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICB9XG5cbiAgZ2V0IGN1bGxNb2RlKCk6IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX2N1bGxNb2RlO1xuICB9XG5cbiAgc2V0IGN1bGxNb2RlKG06IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSkge1xuICAgIHRoaXMuX2N1bGxNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XG4gIH1cblxuICBnZXQgb3V0bGluZUN1bGxNb2RlKCk6IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX291dGxpbmVDdWxsTW9kZTtcbiAgfVxuXG4gIHNldCBvdXRsaW5lQ3VsbE1vZGUobTogTVRvb25NYXRlcmlhbEN1bGxNb2RlKSB7XG4gICAgdGhpcy5fb3V0bGluZUN1bGxNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XG4gIH1cblxuICBnZXQgeldyaXRlKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZGVwdGhXcml0ZSA/IDEgOiAwO1xuICB9XG5cbiAgc2V0IHpXcml0ZShpOiBudW1iZXIpIHtcbiAgICB0aGlzLmRlcHRoV3JpdGUgPSAwLjUgPD0gaTtcbiAgfVxuXG4gIGdldCBpc091dGxpbmUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2lzT3V0bGluZTtcbiAgfVxuXG4gIHNldCBpc091dGxpbmUoYjogYm9vbGVhbikge1xuICAgIHRoaXMuX2lzT3V0bGluZSA9IGI7XG5cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhpcyBtYXRlcmlhbC5cbiAgICogVXN1YWxseSB0aGlzIHdpbGwgYmUgY2FsbGVkIHZpYSBbW1ZSTS51cGRhdGVdXSBzbyB5b3UgZG9uJ3QgaGF2ZSB0byBjYWxsIHRoaXMgbWFudWFsbHkuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWUgc2luY2UgbGFzdCB1cGRhdGVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGVWUk1NYXRlcmlhbHMoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuX3V2QW5pbU9mZnNldFggPSB0aGlzLl91dkFuaW1PZmZzZXRYICsgZGVsdGEgKiB0aGlzLnV2QW5pbVNjcm9sbFg7XG4gICAgdGhpcy5fdXZBbmltT2Zmc2V0WSA9IHRoaXMuX3V2QW5pbU9mZnNldFkgLSBkZWx0YSAqIHRoaXMudXZBbmltU2Nyb2xsWTsgLy8gTmVnYXRpdmUgc2luY2UgdCBheGlzIG9mIHV2cyBhcmUgb3Bwb3NpdGUgZnJvbSBVbml0eSdzIG9uZVxuICAgIHRoaXMuX3V2QW5pbVBoYXNlID0gdGhpcy5fdXZBbmltUGhhc2UgKyBkZWx0YSAqIHRoaXMudXZBbmltUm90YXRpb247XG5cbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XG4gIH1cblxuICBwdWJsaWMgY29weShzb3VyY2U6IHRoaXMpOiB0aGlzIHtcbiAgICBzdXBlci5jb3B5KHNvdXJjZSk7XG5cbiAgICAvLyA9PSBjb3B5IG1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5jdXRvZmYgPSBzb3VyY2UuY3V0b2ZmO1xuICAgIHRoaXMuY29sb3IuY29weShzb3VyY2UuY29sb3IpO1xuICAgIHRoaXMuc2hhZGVDb2xvci5jb3B5KHNvdXJjZS5zaGFkZUNvbG9yKTtcbiAgICB0aGlzLm1hcCA9IHNvdXJjZS5tYXA7XG4gICAgdGhpcy5tYWluVGV4X1NULmNvcHkoc291cmNlLm1haW5UZXhfU1QpO1xuICAgIHRoaXMuc2hhZGVUZXh0dXJlID0gc291cmNlLnNoYWRlVGV4dHVyZTtcbiAgICB0aGlzLm5vcm1hbE1hcCA9IHNvdXJjZS5ub3JtYWxNYXA7XG4gICAgdGhpcy5ub3JtYWxNYXBUeXBlID0gc291cmNlLm5vcm1hbE1hcFR5cGU7XG4gICAgdGhpcy5ub3JtYWxTY2FsZS5jb3B5KHRoaXMubm9ybWFsU2NhbGUpO1xuICAgIHRoaXMucmVjZWl2ZVNoYWRvd1JhdGUgPSBzb3VyY2UucmVjZWl2ZVNoYWRvd1JhdGU7XG4gICAgdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSA9IHNvdXJjZS5yZWNlaXZlU2hhZG93VGV4dHVyZTtcbiAgICB0aGlzLnNoYWRpbmdHcmFkZVJhdGUgPSBzb3VyY2Uuc2hhZGluZ0dyYWRlUmF0ZTtcbiAgICB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgPSBzb3VyY2Uuc2hhZGluZ0dyYWRlVGV4dHVyZTtcbiAgICB0aGlzLnNoYWRlU2hpZnQgPSBzb3VyY2Uuc2hhZGVTaGlmdDtcbiAgICB0aGlzLnNoYWRlVG9vbnkgPSBzb3VyY2Uuc2hhZGVUb29ueTtcbiAgICB0aGlzLmxpZ2h0Q29sb3JBdHRlbnVhdGlvbiA9IHNvdXJjZS5saWdodENvbG9yQXR0ZW51YXRpb247XG4gICAgdGhpcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5ID0gc291cmNlLmluZGlyZWN0TGlnaHRJbnRlbnNpdHk7XG4gICAgdGhpcy5yaW1UZXh0dXJlID0gc291cmNlLnJpbVRleHR1cmU7XG4gICAgdGhpcy5yaW1Db2xvci5jb3B5KHNvdXJjZS5yaW1Db2xvcik7XG4gICAgdGhpcy5yaW1MaWdodGluZ01peCA9IHNvdXJjZS5yaW1MaWdodGluZ01peDtcbiAgICB0aGlzLnJpbUZyZXNuZWxQb3dlciA9IHNvdXJjZS5yaW1GcmVzbmVsUG93ZXI7XG4gICAgdGhpcy5yaW1MaWZ0ID0gc291cmNlLnJpbUxpZnQ7XG4gICAgdGhpcy5zcGhlcmVBZGQgPSBzb3VyY2Uuc3BoZXJlQWRkO1xuICAgIHRoaXMuZW1pc3Npb25Db2xvci5jb3B5KHNvdXJjZS5lbWlzc2lvbkNvbG9yKTtcbiAgICB0aGlzLmVtaXNzaXZlTWFwID0gc291cmNlLmVtaXNzaXZlTWFwO1xuICAgIHRoaXMub3V0bGluZVdpZHRoVGV4dHVyZSA9IHNvdXJjZS5vdXRsaW5lV2lkdGhUZXh0dXJlO1xuICAgIHRoaXMub3V0bGluZVdpZHRoID0gc291cmNlLm91dGxpbmVXaWR0aDtcbiAgICB0aGlzLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZSA9IHNvdXJjZS5vdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2U7XG4gICAgdGhpcy5vdXRsaW5lQ29sb3IuY29weShzb3VyY2Uub3V0bGluZUNvbG9yKTtcbiAgICB0aGlzLm91dGxpbmVMaWdodGluZ01peCA9IHNvdXJjZS5vdXRsaW5lTGlnaHRpbmdNaXg7XG4gICAgdGhpcy51dkFuaW1NYXNrVGV4dHVyZSA9IHNvdXJjZS51dkFuaW1NYXNrVGV4dHVyZTtcbiAgICB0aGlzLnV2QW5pbVNjcm9sbFggPSBzb3VyY2UudXZBbmltU2Nyb2xsWDtcbiAgICB0aGlzLnV2QW5pbVNjcm9sbFkgPSBzb3VyY2UudXZBbmltU2Nyb2xsWTtcbiAgICB0aGlzLnV2QW5pbVJvdGF0aW9uID0gc291cmNlLnV2QW5pbVJvdGF0aW9uO1xuXG4gICAgdGhpcy5kZWJ1Z01vZGUgPSBzb3VyY2UuZGVidWdNb2RlO1xuICAgIHRoaXMuYmxlbmRNb2RlID0gc291cmNlLmJsZW5kTW9kZTtcbiAgICB0aGlzLm91dGxpbmVXaWR0aE1vZGUgPSBzb3VyY2Uub3V0bGluZVdpZHRoTW9kZTtcbiAgICB0aGlzLm91dGxpbmVDb2xvck1vZGUgPSBzb3VyY2Uub3V0bGluZUNvbG9yTW9kZTtcbiAgICB0aGlzLmN1bGxNb2RlID0gc291cmNlLmN1bGxNb2RlO1xuICAgIHRoaXMub3V0bGluZUN1bGxNb2RlID0gc291cmNlLm91dGxpbmVDdWxsTW9kZTtcblxuICAgIHRoaXMuaXNPdXRsaW5lID0gc291cmNlLmlzT3V0bGluZTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGx5IHVwZGF0ZWQgdW5pZm9ybSB2YXJpYWJsZXMuXG4gICAqL1xuICBwcml2YXRlIF9hcHBseVVuaWZvcm1zKCk6IHZvaWQge1xuICAgIHRoaXMudW5pZm9ybXMudXZBbmltT2Zmc2V0WC52YWx1ZSA9IHRoaXMuX3V2QW5pbU9mZnNldFg7XG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1PZmZzZXRZLnZhbHVlID0gdGhpcy5fdXZBbmltT2Zmc2V0WTtcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbVRoZXRhLnZhbHVlID0gVEFVICogdGhpcy5fdXZBbmltUGhhc2U7XG5cbiAgICBpZiAoIXRoaXMuc2hvdWxkQXBwbHlVbmlmb3Jtcykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnNob3VsZEFwcGx5VW5pZm9ybXMgPSBmYWxzZTtcblxuICAgIHRoaXMudW5pZm9ybXMuY3V0b2ZmLnZhbHVlID0gdGhpcy5jdXRvZmY7XG4gICAgdGhpcy51bmlmb3Jtcy5jb2xvci52YWx1ZS5zZXRSR0IodGhpcy5jb2xvci54LCB0aGlzLmNvbG9yLnksIHRoaXMuY29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5jb2xvckFscGhhLnZhbHVlID0gdGhpcy5jb2xvci53O1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVDb2xvci52YWx1ZS5zZXRSR0IodGhpcy5zaGFkZUNvbG9yLngsIHRoaXMuc2hhZGVDb2xvci55LCB0aGlzLnNoYWRlQ29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5tYXAudmFsdWUgPSB0aGlzLm1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm1haW5UZXhfU1QudmFsdWUuY29weSh0aGlzLm1haW5UZXhfU1QpO1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVUZXh0dXJlLnZhbHVlID0gdGhpcy5zaGFkZVRleHR1cmU7XG4gICAgdGhpcy51bmlmb3Jtcy5ub3JtYWxNYXAudmFsdWUgPSB0aGlzLm5vcm1hbE1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm5vcm1hbFNjYWxlLnZhbHVlLmNvcHkodGhpcy5ub3JtYWxTY2FsZSk7XG4gICAgdGhpcy51bmlmb3Jtcy5yZWNlaXZlU2hhZG93UmF0ZS52YWx1ZSA9IHRoaXMucmVjZWl2ZVNoYWRvd1JhdGU7XG4gICAgdGhpcy51bmlmb3Jtcy5yZWNlaXZlU2hhZG93VGV4dHVyZS52YWx1ZSA9IHRoaXMucmVjZWl2ZVNoYWRvd1RleHR1cmU7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkaW5nR3JhZGVSYXRlLnZhbHVlID0gdGhpcy5zaGFkaW5nR3JhZGVSYXRlO1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGluZ0dyYWRlVGV4dHVyZS52YWx1ZSA9IHRoaXMuc2hhZGluZ0dyYWRlVGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlU2hpZnQudmFsdWUgPSB0aGlzLnNoYWRlU2hpZnQ7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkZVRvb255LnZhbHVlID0gdGhpcy5zaGFkZVRvb255O1xuICAgIHRoaXMudW5pZm9ybXMubGlnaHRDb2xvckF0dGVudWF0aW9uLnZhbHVlID0gdGhpcy5saWdodENvbG9yQXR0ZW51YXRpb247XG4gICAgdGhpcy51bmlmb3Jtcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5LnZhbHVlID0gdGhpcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5O1xuICAgIHRoaXMudW5pZm9ybXMucmltVGV4dHVyZS52YWx1ZSA9IHRoaXMucmltVGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUNvbG9yLnZhbHVlLnNldFJHQih0aGlzLnJpbUNvbG9yLngsIHRoaXMucmltQ29sb3IueSwgdGhpcy5yaW1Db2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUxpZ2h0aW5nTWl4LnZhbHVlID0gdGhpcy5yaW1MaWdodGluZ01peDtcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUZyZXNuZWxQb3dlci52YWx1ZSA9IHRoaXMucmltRnJlc25lbFBvd2VyO1xuICAgIHRoaXMudW5pZm9ybXMucmltTGlmdC52YWx1ZSA9IHRoaXMucmltTGlmdDtcbiAgICB0aGlzLnVuaWZvcm1zLnNwaGVyZUFkZC52YWx1ZSA9IHRoaXMuc3BoZXJlQWRkO1xuICAgIHRoaXMudW5pZm9ybXMuZW1pc3Npb25Db2xvci52YWx1ZS5zZXRSR0IodGhpcy5lbWlzc2lvbkNvbG9yLngsIHRoaXMuZW1pc3Npb25Db2xvci55LCB0aGlzLmVtaXNzaW9uQ29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZU1hcC52YWx1ZSA9IHRoaXMuZW1pc3NpdmVNYXA7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGhUZXh0dXJlLnZhbHVlID0gdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlO1xuICAgIHRoaXMudW5pZm9ybXMub3V0bGluZVdpZHRoLnZhbHVlID0gdGhpcy5vdXRsaW5lV2lkdGg7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2UudmFsdWUgPSB0aGlzLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZTtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvci52YWx1ZS5zZXRSR0IodGhpcy5vdXRsaW5lQ29sb3IueCwgdGhpcy5vdXRsaW5lQ29sb3IueSwgdGhpcy5vdXRsaW5lQ29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lTGlnaHRpbmdNaXgudmFsdWUgPSB0aGlzLm91dGxpbmVMaWdodGluZ01peDtcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbU1hc2tUZXh0dXJlLnZhbHVlID0gdGhpcy51dkFuaW1NYXNrVGV4dHVyZTtcblxuICAgIC8vIGFwcGx5IGNvbG9yIHNwYWNlIHRvIHVuaWZvcm0gY29sb3JzXG4gICAgaWYgKHRoaXMuZW5jb2RpbmcgPT09IFRIUkVFLnNSR0JFbmNvZGluZykge1xuICAgICAgdGhpcy51bmlmb3Jtcy5jb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLnNoYWRlQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xuICAgICAgdGhpcy51bmlmb3Jtcy5yaW1Db2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLmVtaXNzaW9uQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xuICAgICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xuICAgIH1cblxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVTaGFkZXJDb2RlKCk6IHZvaWQge1xuICAgIGNvbnN0IHVzZVV2SW5WZXJ0ID0gdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlICE9PSBudWxsO1xuICAgIGNvbnN0IHVzZVV2SW5GcmFnID1cbiAgICAgIHRoaXMubWFwICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbCB8fFxuICAgICAgdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSAhPT0gbnVsbCB8fFxuICAgICAgdGhpcy5zaGFkaW5nR3JhZGVUZXh0dXJlICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnJpbVRleHR1cmUgIT09IG51bGwgfHxcbiAgICAgIHRoaXMudXZBbmltTWFza1RleHR1cmUgIT09IG51bGw7XG5cbiAgICB0aGlzLmRlZmluZXMgPSB7XG4gICAgICAvLyBUZW1wb3JhcnkgY29tcGF0IGFnYWluc3Qgc2hhZGVyIGNoYW5nZSBAIFRocmVlLmpzIHIxMjZcbiAgICAgIC8vIFNlZTogIzIxMjA1LCAjMjEzMDcsICMyMTI5OVxuICAgICAgVEhSRUVfVlJNX1RIUkVFX1JFVklTSU9OXzEyNjogcGFyc2VJbnQoVEhSRUUuUkVWSVNJT04pID49IDEyNixcblxuICAgICAgT1VUTElORTogdGhpcy5faXNPdXRsaW5lLFxuICAgICAgQkxFTkRNT0RFX09QQVFVRTogdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5PcGFxdWUsXG4gICAgICBCTEVORE1PREVfQ1VUT1VUOiB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLkN1dG91dCxcbiAgICAgIEJMRU5ETU9ERV9UUkFOU1BBUkVOVDpcbiAgICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudCB8fFxuICAgICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50V2l0aFpXcml0ZSxcbiAgICAgIE1UT09OX1VTRV9VVjogdXNlVXZJblZlcnQgfHwgdXNlVXZJbkZyYWcsIC8vIHdlIGNhbid0IHVzZSBgVVNFX1VWYCAsIGl0IHdpbGwgYmUgcmVkZWZpbmVkIGluIFdlYkdMUHJvZ3JhbS5qc1xuICAgICAgTVRPT05fVVZTX1ZFUlRFWF9PTkxZOiB1c2VVdkluVmVydCAmJiAhdXNlVXZJbkZyYWcsXG4gICAgICBVU0VfU0hBREVURVhUVVJFOiB0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9SRUNFSVZFU0hBRE9XVEVYVFVSRTogdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9TSEFESU5HR1JBREVURVhUVVJFOiB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgIT09IG51bGwsXG4gICAgICBVU0VfUklNVEVYVFVSRTogdGhpcy5yaW1UZXh0dXJlICE9PSBudWxsLFxuICAgICAgVVNFX1NQSEVSRUFERDogdGhpcy5zcGhlcmVBZGQgIT09IG51bGwsXG4gICAgICBVU0VfT1VUTElORVdJRFRIVEVYVFVSRTogdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlICE9PSBudWxsLFxuICAgICAgVVNFX1VWQU5JTU1BU0tURVhUVVJFOiB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlICE9PSBudWxsLFxuICAgICAgREVCVUdfTk9STUFMOiB0aGlzLl9kZWJ1Z01vZGUgPT09IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTm9ybWFsLFxuICAgICAgREVCVUdfTElUU0hBREVSQVRFOiB0aGlzLl9kZWJ1Z01vZGUgPT09IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTGl0U2hhZGVSYXRlLFxuICAgICAgREVCVUdfVVY6IHRoaXMuX2RlYnVnTW9kZSA9PT0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5VVixcbiAgICAgIE9VVExJTkVfV0lEVEhfV09STEQ6IHRoaXMuX291dGxpbmVXaWR0aE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLldvcmxkQ29vcmRpbmF0ZXMsXG4gICAgICBPVVRMSU5FX1dJRFRIX1NDUkVFTjogdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuU2NyZWVuQ29vcmRpbmF0ZXMsXG4gICAgICBPVVRMSU5FX0NPTE9SX0ZJWEVEOiB0aGlzLl9vdXRsaW5lQ29sb3JNb2RlID09PSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZS5GaXhlZENvbG9yLFxuICAgICAgT1VUTElORV9DT0xPUl9NSVhFRDogdGhpcy5fb3V0bGluZUNvbG9yTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUuTWl4ZWRMaWdodGluZyxcbiAgICB9O1xuXG4gICAgLy8gPT0gdGV4dHVyZSBlbmNvZGluZ3MgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIGNvbnN0IGVuY29kaW5ncyA9XG4gICAgICAodGhpcy5zaGFkZVRleHR1cmUgIT09IG51bGxcbiAgICAgICAgPyBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24oJ3NoYWRlVGV4dHVyZVRleGVsVG9MaW5lYXInLCB0aGlzLnNoYWRlVGV4dHVyZS5lbmNvZGluZykgKyAnXFxuJ1xuICAgICAgICA6ICcnKSArXG4gICAgICAodGhpcy5zcGhlcmVBZGQgIT09IG51bGxcbiAgICAgICAgPyBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24oJ3NwaGVyZUFkZFRleGVsVG9MaW5lYXInLCB0aGlzLnNwaGVyZUFkZC5lbmNvZGluZykgKyAnXFxuJ1xuICAgICAgICA6ICcnKSArXG4gICAgICAodGhpcy5yaW1UZXh0dXJlICE9PSBudWxsXG4gICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKCdyaW1UZXh0dXJlVGV4ZWxUb0xpbmVhcicsIHRoaXMucmltVGV4dHVyZS5lbmNvZGluZykgKyAnXFxuJ1xuICAgICAgICA6ICcnKTtcblxuICAgIC8vID09IGdlbmVyYXRlIHNoYWRlciBjb2RlID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLnZlcnRleFNoYWRlciA9IHZlcnRleFNoYWRlcjtcbiAgICB0aGlzLmZyYWdtZW50U2hhZGVyID0gZW5jb2RpbmdzICsgZnJhZ21lbnRTaGFkZXI7XG5cbiAgICAvLyA9PSBzZXQgbmVlZHNVcGRhdGUgZmxhZyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVDdWxsRmFjZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaXNPdXRsaW5lKSB7XG4gICAgICBpZiAodGhpcy5jdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLk9mZikge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Eb3VibGVTaWRlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQpIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuQmFja1NpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5CYWNrKSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkZyb250U2lkZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuT2ZmKSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkRvdWJsZVNpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQpIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuQmFja1NpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuQmFjaykge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Gcm9udFNpZGU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCIvKiB0c2xpbnQ6ZGlzYWJsZTptZW1iZXItb3JkZXJpbmcgKi9cblxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHZlcnRleFNoYWRlciBmcm9tICcuL3NoYWRlcnMvdW5saXQudmVydCc7XG5pbXBvcnQgZnJhZ21lbnRTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL3VubGl0LmZyYWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZSTVVubGl0TWF0ZXJpYWxQYXJhbWV0ZXJzIGV4dGVuZHMgVEhSRUUuU2hhZGVyTWF0ZXJpYWxQYXJhbWV0ZXJzIHtcbiAgY3V0b2ZmPzogbnVtYmVyOyAvLyBfQ3V0b2ZmXG4gIG1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4XG4gIG1haW5UZXg/OiBUSFJFRS5UZXh0dXJlOyAvLyBfTWFpblRleCAod2lsbCBiZSByZW5hbWVkIHRvIG1hcClcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICBtYWluVGV4X1NUPzogVEhSRUUuVmVjdG9yNDsgLy8gX01haW5UZXhfU1RcblxuICByZW5kZXJUeXBlPzogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUgfCBudW1iZXI7XG59XG5cbmV4cG9ydCBlbnVtIFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlIHtcbiAgT3BhcXVlLFxuICBDdXRvdXQsXG4gIFRyYW5zcGFyZW50LFxuICBUcmFuc3BhcmVudFdpdGhaV3JpdGUsXG59XG5cbi8qKlxuICogVGhpcyBpcyBhIG1hdGVyaWFsIHRoYXQgaXMgYW4gZXF1aXZhbGVudCBvZiBcIlZSTS9VbmxpdCoqKlwiIG9uIFZSTSBzcGVjLCB0aG9zZSBtYXRlcmlhbHMgYXJlIGFscmVhZHkga2luZGEgZGVwcmVjYXRlZCB0aG91Z2guLi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVVubGl0TWF0ZXJpYWwgZXh0ZW5kcyBUSFJFRS5TaGFkZXJNYXRlcmlhbCB7XG4gIC8qKlxuICAgKiBSZWFkb25seSBib29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoaXMgaXMgYSBbW1ZSTVVubGl0TWF0ZXJpYWxdXS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBpc1ZSTVVubGl0TWF0ZXJpYWw6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIHB1YmxpYyBjdXRvZmYgPSAwLjU7XG4gIHB1YmxpYyBtYXA6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX01haW5UZXhcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICBwdWJsaWMgbWFpblRleF9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9NYWluVGV4X1NUXG4gIHByaXZhdGUgX3JlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5PcGFxdWU7XG5cbiAgcHVibGljIHNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlOyAvLyB3aGVuIHRoaXMgaXMgdHJ1ZSwgYXBwbHlVbmlmb3JtcyBlZmZlY3RzXG5cbiAgY29uc3RydWN0b3IocGFyYW1ldGVycz86IFZSTVVubGl0TWF0ZXJpYWxQYXJhbWV0ZXJzKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmIChwYXJhbWV0ZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmFtZXRlcnMgPSB7fTtcbiAgICB9XG5cbiAgICAvLyA9PSBlbmFibGluZyBidW5jaCBvZiBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgcGFyYW1ldGVycy5mb2cgPSB0cnVlO1xuICAgIHBhcmFtZXRlcnMuY2xpcHBpbmcgPSB0cnVlO1xuXG4gICAgcGFyYW1ldGVycy5za2lubmluZyA9IHBhcmFtZXRlcnMuc2tpbm5pbmcgfHwgZmFsc2U7XG4gICAgcGFyYW1ldGVycy5tb3JwaFRhcmdldHMgPSBwYXJhbWV0ZXJzLm1vcnBoVGFyZ2V0cyB8fCBmYWxzZTtcbiAgICBwYXJhbWV0ZXJzLm1vcnBoTm9ybWFscyA9IHBhcmFtZXRlcnMubW9ycGhOb3JtYWxzIHx8IGZhbHNlO1xuXG4gICAgLy8gPT0gdW5pZm9ybXMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHBhcmFtZXRlcnMudW5pZm9ybXMgPSBUSFJFRS5Vbmlmb3Jtc1V0aWxzLm1lcmdlKFtcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmNvbW1vbiwgLy8gbWFwXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5mb2csXG4gICAgICB7XG4gICAgICAgIGN1dG9mZjogeyB2YWx1ZTogMC41IH0sXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgICAgICAgbWFpblRleF9TVDogeyB2YWx1ZTogbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKSB9LFxuICAgICAgfSxcbiAgICBdKTtcblxuICAgIC8vID09IGZpbmFsbHkgY29tcGlsZSB0aGUgc2hhZGVyIHByb2dyYW0gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLnNldFZhbHVlcyhwYXJhbWV0ZXJzKTtcblxuICAgIC8vID09IHVwZGF0ZSBzaGFkZXIgc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gICAgdGhpcy5fYXBwbHlVbmlmb3JtcygpO1xuICB9XG5cbiAgZ2V0IG1haW5UZXgoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLm1hcDtcbiAgfVxuXG4gIHNldCBtYWluVGV4KHQ6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XG4gICAgdGhpcy5tYXAgPSB0O1xuICB9XG5cbiAgZ2V0IHJlbmRlclR5cGUoKTogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUge1xuICAgIHJldHVybiB0aGlzLl9yZW5kZXJUeXBlO1xuICB9XG5cbiAgc2V0IHJlbmRlclR5cGUodDogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUpIHtcbiAgICB0aGlzLl9yZW5kZXJUeXBlID0gdDtcblxuICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRoaXMuX3JlbmRlclR5cGUgIT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50O1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPVxuICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQgfHxcbiAgICAgIHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoaXMgbWF0ZXJpYWwuXG4gICAqIFVzdWFsbHkgdGhpcyB3aWxsIGJlIGNhbGxlZCB2aWEgW1tWUk0udXBkYXRlXV0gc28geW91IGRvbid0IGhhdmUgdG8gY2FsbCB0aGlzIG1hbnVhbGx5LlxuICAgKlxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lIHNpbmNlIGxhc3QgdXBkYXRlXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlVlJNTWF0ZXJpYWxzKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XG4gIH1cblxuICBwdWJsaWMgY29weShzb3VyY2U6IHRoaXMpOiB0aGlzIHtcbiAgICBzdXBlci5jb3B5KHNvdXJjZSk7XG5cbiAgICAvLyA9PSBjb3B5IG1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5jdXRvZmYgPSBzb3VyY2UuY3V0b2ZmO1xuICAgIHRoaXMubWFwID0gc291cmNlLm1hcDtcbiAgICB0aGlzLm1haW5UZXhfU1QuY29weShzb3VyY2UubWFpblRleF9TVCk7XG4gICAgdGhpcy5yZW5kZXJUeXBlID0gc291cmNlLnJlbmRlclR5cGU7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBseSB1cGRhdGVkIHVuaWZvcm0gdmFyaWFibGVzLlxuICAgKi9cbiAgcHJpdmF0ZSBfYXBwbHlVbmlmb3JtcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuc2hvdWxkQXBwbHlVbmlmb3Jtcykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnNob3VsZEFwcGx5VW5pZm9ybXMgPSBmYWxzZTtcblxuICAgIHRoaXMudW5pZm9ybXMuY3V0b2ZmLnZhbHVlID0gdGhpcy5jdXRvZmY7XG4gICAgdGhpcy51bmlmb3Jtcy5tYXAudmFsdWUgPSB0aGlzLm1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm1haW5UZXhfU1QudmFsdWUuY29weSh0aGlzLm1haW5UZXhfU1QpO1xuICB9XG5cbiAgcHJpdmF0ZSBfdXBkYXRlU2hhZGVyQ29kZSgpOiB2b2lkIHtcbiAgICB0aGlzLmRlZmluZXMgPSB7XG4gICAgICBSRU5ERVJUWVBFX09QQVFVRTogdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuT3BhcXVlLFxuICAgICAgUkVOREVSVFlQRV9DVVRPVVQ6IHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLkN1dG91dCxcbiAgICAgIFJFTkRFUlRZUEVfVFJBTlNQQVJFTlQ6XG4gICAgICAgIHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50IHx8XG4gICAgICAgIHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50V2l0aFpXcml0ZSxcbiAgICB9O1xuXG4gICAgdGhpcy52ZXJ0ZXhTaGFkZXIgPSB2ZXJ0ZXhTaGFkZXI7XG4gICAgdGhpcy5mcmFnbWVudFNoYWRlciA9IGZyYWdtZW50U2hhZGVyO1xuXG4gICAgLy8gPT0gc2V0IG5lZWRzVXBkYXRlIGZsYWcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMubmVlZHNVcGRhdGUgPSB0cnVlO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlcic7XG5pbXBvcnQgeyBHTFRGU2NoZW1hLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyBNVG9vbk1hdGVyaWFsLCBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSB9IGZyb20gJy4vTVRvb25NYXRlcmlhbCc7XG5pbXBvcnQgeyBWUk1VbmxpdE1hdGVyaWFsLCBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZSB9IGZyb20gJy4vVlJNVW5saXRNYXRlcmlhbCc7XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgYSBbW1ZSTU1hdGVyaWFsSW1wb3J0ZXJdXSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWUk1NYXRlcmlhbEltcG9ydGVyT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBTcGVjaWZ5IHRoZSBlbmNvZGluZyBvZiBpbnB1dCB1bmlmb3JtIGNvbG9ycyBhbmQgdGV4dHVyZXMuXG4gICAqXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuc1JHQkVuY29kaW5nYCwgdXNlIGBUSFJFRS5zUkdCRW5jb2RpbmdgLlxuICAgKlxuICAgKiBUaGUgaW1wb3J0ZXIgd2lsbCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYCBpZiB0aGlzIG9wdGlvbiBpc24ndCBzcGVjaWZpZWQuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9yZW5kZXJlcnMvV2ViR0xSZW5kZXJlci5vdXRwdXRFbmNvZGluZ1xuICAgKi9cbiAgZW5jb2Rpbmc/OiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmc7XG5cbiAgLyoqXG4gICAqIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgYFByb21pc2VgIG9mIGVudmlyb25tZW50IG1hcCB0ZXh0dXJlLlxuICAgKiBUaGUgaW1wb3J0ZXIgd2lsbCBhdHRlbXB0IHRvIGNhbGwgdGhpcyBmdW5jdGlvbiB3aGVuIGl0IGhhdmUgdG8gdXNlIGFuIGVudm1hcC5cbiAgICovXG4gIHJlcXVlc3RFbnZNYXA/OiAoKSA9PiBQcm9taXNlPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcbn1cblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgVlJNIG1hdGVyaWFscyBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1NYXRlcmlhbEltcG9ydGVyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBfZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZztcbiAgcHJpdmF0ZSByZWFkb25seSBfcmVxdWVzdEVudk1hcD86ICgpID0+IFByb21pc2U8VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNTWF0ZXJpYWxJbXBvcnRlci5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyBvZiB0aGUgVlJNTWF0ZXJpYWxJbXBvcnRlclxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9uczogVlJNTWF0ZXJpYWxJbXBvcnRlck9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMuX2VuY29kaW5nID0gb3B0aW9ucy5lbmNvZGluZyB8fCBUSFJFRS5MaW5lYXJFbmNvZGluZztcbiAgICBpZiAodGhpcy5fZW5jb2RpbmcgIT09IFRIUkVFLkxpbmVhckVuY29kaW5nICYmIHRoaXMuX2VuY29kaW5nICE9PSBUSFJFRS5zUkdCRW5jb2RpbmcpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgJ1RoZSBzcGVjaWZpZWQgY29sb3IgZW5jb2RpbmcgbWlnaHQgbm90IHdvcmsgcHJvcGVybHkgd2l0aCBWUk1NYXRlcmlhbEltcG9ydGVyLiBZb3UgbWlnaHQgd2FudCB0byB1c2UgVEhSRUUuc1JHQkVuY29kaW5nIGluc3RlYWQuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVxdWVzdEVudk1hcCA9IG9wdGlvbnMucmVxdWVzdEVudk1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGFsbCB0aGUgbWF0ZXJpYWxzIG9mIGdpdmVuIEdMVEYgYmFzZWQgb24gVlJNIGV4dGVuc2lvbiBmaWVsZCBgbWF0ZXJpYWxQcm9wZXJ0aWVzYC5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZjogR0xURik6IFByb21pc2U8VEhSRUUuTWF0ZXJpYWxbXSB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgbWF0ZXJpYWxQcm9wZXJ0aWVzOiBWUk1TY2hlbWEuTWF0ZXJpYWxbXSB8IHVuZGVmaW5lZCA9IHZybUV4dC5tYXRlcmlhbFByb3BlcnRpZXM7XG4gICAgaWYgKCFtYXRlcmlhbFByb3BlcnRpZXMpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVQcmltaXRpdmVzTWFwID0gYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGYpO1xuICAgIGNvbnN0IG1hdGVyaWFsTGlzdDogeyBbdnJtTWF0ZXJpYWxJbmRleDogbnVtYmVyXTogeyBzdXJmYWNlOiBUSFJFRS5NYXRlcmlhbDsgb3V0bGluZT86IFRIUkVFLk1hdGVyaWFsIH0gfSA9IHt9O1xuICAgIGNvbnN0IG1hdGVyaWFsczogVEhSRUUuTWF0ZXJpYWxbXSA9IFtdOyAvLyByZXN1bHRcblxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgQXJyYXkuZnJvbShub2RlUHJpbWl0aXZlc01hcC5lbnRyaWVzKCkpLm1hcChhc3luYyAoW25vZGVJbmRleCwgcHJpbWl0aXZlc10pID0+IHtcbiAgICAgICAgY29uc3Qgc2NoZW1hTm9kZTogR0xURlNjaGVtYS5Ob2RlID0gZ2x0Zi5wYXJzZXIuanNvbi5ub2Rlc1tub2RlSW5kZXhdO1xuICAgICAgICBjb25zdCBzY2hlbWFNZXNoOiBHTFRGU2NoZW1hLk1lc2ggPSBnbHRmLnBhcnNlci5qc29uLm1lc2hlc1tzY2hlbWFOb2RlLm1lc2ghXTtcblxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICBwcmltaXRpdmVzLm1hcChhc3luYyAocHJpbWl0aXZlLCBwcmltaXRpdmVJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2NoZW1hUHJpbWl0aXZlID0gc2NoZW1hTWVzaC5wcmltaXRpdmVzW3ByaW1pdGl2ZUluZGV4XTtcblxuICAgICAgICAgICAgLy8gc29tZSBnbFRGIG1pZ2h0IGhhdmUgYm90aCBgbm9kZS5tZXNoYCBhbmQgYG5vZGUuY2hpbGRyZW5gIGF0IG9uY2VcbiAgICAgICAgICAgIC8vIGFuZCBHTFRGTG9hZGVyIGhhbmRsZXMgYm90aCBtZXNoIHByaW1pdGl2ZXMgYW5kIFwiY2hpbGRyZW5cIiBpbiBnbFRGIGFzIFwiY2hpbGRyZW5cIiBpbiBUSFJFRVxuICAgICAgICAgICAgLy8gSXQgc2VlbXMgR0xURkxvYWRlciBoYW5kbGVzIHByaW1pdGl2ZXMgZmlyc3QgdGhlbiBoYW5kbGVzIFwiY2hpbGRyZW5cIiBpbiBnbFRGIChpdCdzIGx1Y2t5ISlcbiAgICAgICAgICAgIC8vIHNvIHdlIHNob3VsZCBpZ25vcmUgKHByaW1pdGl2ZXMubGVuZ3RoKXRoIGFuZCBmb2xsb3dpbmcgY2hpbGRyZW4gb2YgYG1lc2guY2hpbGRyZW5gXG4gICAgICAgICAgICAvLyBUT0RPOiBzYW5pdGl6ZSB0aGlzIGFmdGVyIEdMVEZMb2FkZXIgcGx1Z2luIHN5c3RlbSBnZXRzIGludHJvZHVjZWQgOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMTg0MjFcbiAgICAgICAgICAgIGlmICghc2NoZW1hUHJpbWl0aXZlKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlR2VvbWV0cnkgPSBwcmltaXRpdmUuZ2VvbWV0cnk7XG4gICAgICAgICAgICBjb25zdCBwcmltaXRpdmVWZXJ0aWNlcyA9IHByaW1pdGl2ZUdlb21ldHJ5LmluZGV4XG4gICAgICAgICAgICAgID8gcHJpbWl0aXZlR2VvbWV0cnkuaW5kZXguY291bnRcbiAgICAgICAgICAgICAgOiBwcmltaXRpdmVHZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uLmNvdW50IC8gMztcblxuICAgICAgICAgICAgLy8gaWYgcHJpbWl0aXZlcyBtYXRlcmlhbCBpcyBub3QgYW4gYXJyYXksIG1ha2UgaXQgYW4gYXJyYXlcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcmltaXRpdmUubWF0ZXJpYWwpKSB7XG4gICAgICAgICAgICAgIHByaW1pdGl2ZS5tYXRlcmlhbCA9IFtwcmltaXRpdmUubWF0ZXJpYWxdO1xuICAgICAgICAgICAgICBwcmltaXRpdmVHZW9tZXRyeS5hZGRHcm91cCgwLCBwcmltaXRpdmVWZXJ0aWNlcywgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSAvIHB1c2ggdG8gY2FjaGUgKG9yIHBvcCBmcm9tIGNhY2hlKSB2cm0gbWF0ZXJpYWxzXG4gICAgICAgICAgICBjb25zdCB2cm1NYXRlcmlhbEluZGV4ID0gc2NoZW1hUHJpbWl0aXZlLm1hdGVyaWFsITtcblxuICAgICAgICAgICAgbGV0IHByb3BzID0gbWF0ZXJpYWxQcm9wZXJ0aWVzW3ZybU1hdGVyaWFsSW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFwcm9wcykge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgYFZSTU1hdGVyaWFsSW1wb3J0ZXI6IFRoZXJlIGFyZSBubyBtYXRlcmlhbCBkZWZpbml0aW9uIGZvciBtYXRlcmlhbCAjJHt2cm1NYXRlcmlhbEluZGV4fSBvbiBWUk0gZXh0ZW5zaW9uLmAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIHByb3BzID0geyBzaGFkZXI6ICdWUk1fVVNFX0dMVEZTSEFERVInIH07IC8vIGZhbGxiYWNrXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB2cm1NYXRlcmlhbHM6IHsgc3VyZmFjZTogVEhSRUUuTWF0ZXJpYWw7IG91dGxpbmU/OiBUSFJFRS5NYXRlcmlhbCB9O1xuICAgICAgICAgICAgaWYgKG1hdGVyaWFsTGlzdFt2cm1NYXRlcmlhbEluZGV4XSkge1xuICAgICAgICAgICAgICB2cm1NYXRlcmlhbHMgPSBtYXRlcmlhbExpc3RbdnJtTWF0ZXJpYWxJbmRleF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2cm1NYXRlcmlhbHMgPSBhd2FpdCB0aGlzLmNyZWF0ZVZSTU1hdGVyaWFscyhwcmltaXRpdmUubWF0ZXJpYWxbMF0sIHByb3BzLCBnbHRmKTtcbiAgICAgICAgICAgICAgbWF0ZXJpYWxMaXN0W3ZybU1hdGVyaWFsSW5kZXhdID0gdnJtTWF0ZXJpYWxzO1xuXG4gICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKHZybU1hdGVyaWFscy5zdXJmYWNlKTtcbiAgICAgICAgICAgICAgaWYgKHZybU1hdGVyaWFscy5vdXRsaW5lKSB7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWxzLnB1c2godnJtTWF0ZXJpYWxzLm91dGxpbmUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHN1cmZhY2VcbiAgICAgICAgICAgIHByaW1pdGl2ZS5tYXRlcmlhbFswXSA9IHZybU1hdGVyaWFscy5zdXJmYWNlO1xuXG4gICAgICAgICAgICAvLyBlbnZtYXBcbiAgICAgICAgICAgIGlmICh0aGlzLl9yZXF1ZXN0RW52TWFwICYmICh2cm1NYXRlcmlhbHMuc3VyZmFjZSBhcyBhbnkpLmlzTWVzaFN0YW5kYXJkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgdGhpcy5fcmVxdWVzdEVudk1hcCgpLnRoZW4oKGVudk1hcCkgPT4ge1xuICAgICAgICAgICAgICAgICh2cm1NYXRlcmlhbHMuc3VyZmFjZSBhcyBhbnkpLmVudk1hcCA9IGVudk1hcDtcbiAgICAgICAgICAgICAgICB2cm1NYXRlcmlhbHMuc3VyZmFjZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZW5kZXIgb3JkZXJcbiAgICAgICAgICAgIHByaW1pdGl2ZS5yZW5kZXJPcmRlciA9IHByb3BzLnJlbmRlclF1ZXVlIHx8IDIwMDA7XG5cbiAgICAgICAgICAgIC8vIG91dGxpbmUgKFwiMiBwYXNzIHNoYWRpbmcgdXNpbmcgZ3JvdXBzXCIgdHJpY2sgaGVyZSlcbiAgICAgICAgICAgIGlmICh2cm1NYXRlcmlhbHMub3V0bGluZSkge1xuICAgICAgICAgICAgICBwcmltaXRpdmUubWF0ZXJpYWxbMV0gPSB2cm1NYXRlcmlhbHMub3V0bGluZTtcbiAgICAgICAgICAgICAgcHJpbWl0aXZlR2VvbWV0cnkuYWRkR3JvdXAoMCwgcHJpbWl0aXZlVmVydGljZXMsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHJldHVybiBtYXRlcmlhbHM7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgY3JlYXRlVlJNTWF0ZXJpYWxzKFxuICAgIG9yaWdpbmFsTWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsLFxuICAgIHZybVByb3BzOiBWUk1TY2hlbWEuTWF0ZXJpYWwsXG4gICAgZ2x0ZjogR0xURixcbiAgKTogUHJvbWlzZTx7XG4gICAgc3VyZmFjZTogVEhSRUUuTWF0ZXJpYWw7XG4gICAgb3V0bGluZT86IFRIUkVFLk1hdGVyaWFsO1xuICB9PiB7XG4gICAgbGV0IG5ld1N1cmZhY2U6IFRIUkVFLk1hdGVyaWFsIHwgdW5kZWZpbmVkO1xuICAgIGxldCBuZXdPdXRsaW5lOiBUSFJFRS5NYXRlcmlhbCB8IHVuZGVmaW5lZDtcblxuICAgIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vTVRvb24nKSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcblxuICAgICAgLy8gd2UgbmVlZCB0byBnZXQgcmlkIG9mIHRoZXNlIHByb3BlcnRpZXNcbiAgICAgIFsnc3JjQmxlbmQnLCAnZHN0QmxlbmQnLCAnaXNGaXJzdFNldHVwJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgICBpZiAocGFyYW1zW25hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkZWxldGUgcGFyYW1zW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gdGhlc2UgdGV4dHVyZXMgbXVzdCBiZSBzUkdCIEVuY29kaW5nLCBkZXBlbmRzIG9uIGN1cnJlbnQgY29sb3JzcGFjZVxuICAgICAgWydtYWluVGV4JywgJ3NoYWRlVGV4dHVyZScsICdlbWlzc2lvbk1hcCcsICdzcGhlcmVBZGQnLCAncmltVGV4dHVyZSddLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgaWYgKHBhcmFtc1tuYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcGFyYW1zW25hbWVdLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBzcGVjaWZ5IHVuaWZvcm0gY29sb3IgZW5jb2RpbmdzXG4gICAgICBwYXJhbXMuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcblxuICAgICAgLy8gZG9uZVxuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBNVG9vbk1hdGVyaWFsKHBhcmFtcyk7XG5cbiAgICAgIC8vIG91dGxpbmVcbiAgICAgIGlmIChwYXJhbXMub3V0bGluZVdpZHRoTW9kZSAhPT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuTm9uZSkge1xuICAgICAgICBwYXJhbXMuaXNPdXRsaW5lID0gdHJ1ZTtcbiAgICAgICAgbmV3T3V0bGluZSA9IG5ldyBNVG9vbk1hdGVyaWFsKHBhcmFtcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vVW5saXRUZXh0dXJlJykge1xuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLk9wYXF1ZTtcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL1VubGl0Q3V0b3V0Jykge1xuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLkN1dG91dDtcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL1VubGl0VHJhbnNwYXJlbnQnKSB7XG4gICAgICAvLyB0aGlzIGlzIHZlcnkgbGVnYWN5XG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcbiAgICAgIHBhcmFtcy5yZW5kZXJUeXBlID0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQ7XG4gICAgICBuZXdTdXJmYWNlID0gbmV3IFZSTVVubGl0TWF0ZXJpYWwocGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9VbmxpdFRyYW5zcGFyZW50WldyaXRlJykge1xuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodnJtUHJvcHMuc2hhZGVyICE9PSAnVlJNX1VTRV9HTFRGU0hBREVSJykge1xuICAgICAgICBjb25zb2xlLndhcm4oYFVua25vd24gc2hhZGVyIGRldGVjdGVkOiBcIiR7dnJtUHJvcHMuc2hhZGVyfVwiYCk7XG4gICAgICAgIC8vIHRoZW4gcHJlc3VtZSBhcyBWUk1fVVNFX0dMVEZTSEFERVJcbiAgICAgIH1cblxuICAgICAgbmV3U3VyZmFjZSA9IHRoaXMuX2NvbnZlcnRHTFRGTWF0ZXJpYWwob3JpZ2luYWxNYXRlcmlhbC5jbG9uZSgpKTtcbiAgICB9XG5cbiAgICBuZXdTdXJmYWNlLm5hbWUgPSBvcmlnaW5hbE1hdGVyaWFsLm5hbWU7XG4gICAgbmV3U3VyZmFjZS51c2VyRGF0YSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxNYXRlcmlhbC51c2VyRGF0YSkpO1xuICAgIG5ld1N1cmZhY2UudXNlckRhdGEudnJtTWF0ZXJpYWxQcm9wZXJ0aWVzID0gdnJtUHJvcHM7XG5cbiAgICBpZiAobmV3T3V0bGluZSkge1xuICAgICAgbmV3T3V0bGluZS5uYW1lID0gb3JpZ2luYWxNYXRlcmlhbC5uYW1lICsgJyAoT3V0bGluZSknO1xuICAgICAgbmV3T3V0bGluZS51c2VyRGF0YSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxNYXRlcmlhbC51c2VyRGF0YSkpO1xuICAgICAgbmV3T3V0bGluZS51c2VyRGF0YS52cm1NYXRlcmlhbFByb3BlcnRpZXMgPSB2cm1Qcm9wcztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3VyZmFjZTogbmV3U3VyZmFjZSxcbiAgICAgIG91dGxpbmU6IG5ld091dGxpbmUsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAobmFtZVswXSAhPT0gJ18nKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFZSTU1hdGVyaWFsczogR2l2ZW4gcHJvcGVydHkgbmFtZSBcIiR7bmFtZX1cIiBtaWdodCBiZSBpbnZhbGlkYCk7XG4gICAgICByZXR1cm4gbmFtZTtcbiAgICB9XG4gICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuXG4gICAgaWYgKCEvW0EtWl0vLnRlc3QobmFtZVswXSkpIHtcbiAgICAgIGNvbnNvbGUud2FybihgVlJNTWF0ZXJpYWxzOiBHaXZlbiBwcm9wZXJ0eSBuYW1lIFwiJHtuYW1lfVwiIG1pZ2h0IGJlIGludmFsaWRgKTtcbiAgICAgIHJldHVybiBuYW1lO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZVswXS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zdWJzdHJpbmcoMSk7XG4gIH1cblxuICBwcml2YXRlIF9jb252ZXJ0R0xURk1hdGVyaWFsKG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCk6IFRIUkVFLk1hdGVyaWFsIHtcbiAgICBpZiAoKG1hdGVyaWFsIGFzIGFueSkuaXNNZXNoU3RhbmRhcmRNYXRlcmlhbCkge1xuICAgICAgY29uc3QgbXRsID0gbWF0ZXJpYWwgYXMgVEhSRUUuTWVzaFN0YW5kYXJkTWF0ZXJpYWw7XG5cbiAgICAgIGlmIChtdGwubWFwKSB7XG4gICAgICAgIG10bC5tYXAuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcbiAgICAgIH1cbiAgICAgIGlmIChtdGwuZW1pc3NpdmVNYXApIHtcbiAgICAgICAgbXRsLmVtaXNzaXZlTWFwLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9lbmNvZGluZyA9PT0gVEhSRUUuTGluZWFyRW5jb2RpbmcpIHtcbiAgICAgICAgbXRsLmNvbG9yLmNvbnZlcnRMaW5lYXJUb1NSR0IoKTtcbiAgICAgICAgbXRsLmVtaXNzaXZlLmNvbnZlcnRMaW5lYXJUb1NSR0IoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKG1hdGVyaWFsIGFzIGFueSkuaXNNZXNoQmFzaWNNYXRlcmlhbCkge1xuICAgICAgY29uc3QgbXRsID0gbWF0ZXJpYWwgYXMgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWw7XG5cbiAgICAgIGlmIChtdGwubWFwKSB7XG4gICAgICAgIG10bC5tYXAuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2VuY29kaW5nID09PSBUSFJFRS5MaW5lYXJFbmNvZGluZykge1xuICAgICAgICBtdGwuY29sb3IuY29udmVydExpbmVhclRvU1JHQigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtYXRlcmlhbDtcbiAgfVxuXG4gIHByaXZhdGUgX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMoXG4gICAgb3JpZ2luYWxNYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwsXG4gICAgdnJtUHJvcHM6IFZSTVNjaGVtYS5NYXRlcmlhbCxcbiAgICBnbHRmOiBHTFRGLFxuICApOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHRhc2tMaXN0OiBBcnJheTxQcm9taXNlPGFueT4+ID0gW107XG4gICAgY29uc3QgcGFyYW1zOiBhbnkgPSB7fTtcblxuICAgIC8vIGV4dHJhY3QgdGV4dHVyZSBwcm9wZXJ0aWVzXG4gICAgaWYgKHZybVByb3BzLnRleHR1cmVQcm9wZXJ0aWVzKSB7XG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgT2JqZWN0LmtleXModnJtUHJvcHMudGV4dHVyZVByb3BlcnRpZXMpKSB7XG4gICAgICAgIGNvbnN0IG5ld05hbWUgPSB0aGlzLl9yZW5hbWVNYXRlcmlhbFByb3BlcnR5KG5hbWUpO1xuICAgICAgICBjb25zdCB0ZXh0dXJlSW5kZXggPSB2cm1Qcm9wcy50ZXh0dXJlUHJvcGVydGllc1tuYW1lXTtcblxuICAgICAgICB0YXNrTGlzdC5wdXNoKFxuICAgICAgICAgIGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ3RleHR1cmUnLCB0ZXh0dXJlSW5kZXgpLnRoZW4oKHRleHR1cmU6IFRIUkVFLlRleHR1cmUpID0+IHtcbiAgICAgICAgICAgIHBhcmFtc1tuZXdOYW1lXSA9IHRleHR1cmU7XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXh0cmFjdCBmbG9hdCBwcm9wZXJ0aWVzXG4gICAgaWYgKHZybVByb3BzLmZsb2F0UHJvcGVydGllcykge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKHZybVByb3BzLmZsb2F0UHJvcGVydGllcykpIHtcbiAgICAgICAgY29uc3QgbmV3TmFtZSA9IHRoaXMuX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZSk7XG4gICAgICAgIHBhcmFtc1tuZXdOYW1lXSA9IHZybVByb3BzLmZsb2F0UHJvcGVydGllc1tuYW1lXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleHRyYWN0IHZlY3RvciAoY29sb3IgdGJoKSBwcm9wZXJ0aWVzXG4gICAgaWYgKHZybVByb3BzLnZlY3RvclByb3BlcnRpZXMpIHtcbiAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBPYmplY3Qua2V5cyh2cm1Qcm9wcy52ZWN0b3JQcm9wZXJ0aWVzKSkge1xuICAgICAgICBsZXQgbmV3TmFtZSA9IHRoaXMuX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZSk7XG5cbiAgICAgICAgLy8gaWYgdGhpcyBpcyB0ZXh0dXJlU1QgKHNhbWUgbmFtZSBhcyB0ZXh0dXJlIG5hbWUgaXRzZWxmKSwgYWRkICdfU1QnXG4gICAgICAgIGNvbnN0IGlzVGV4dHVyZVNUID0gW1xuICAgICAgICAgICdfTWFpblRleCcsXG4gICAgICAgICAgJ19TaGFkZVRleHR1cmUnLFxuICAgICAgICAgICdfQnVtcE1hcCcsXG4gICAgICAgICAgJ19SZWNlaXZlU2hhZG93VGV4dHVyZScsXG4gICAgICAgICAgJ19TaGFkaW5nR3JhZGVUZXh0dXJlJyxcbiAgICAgICAgICAnX1JpbVRleHR1cmUnLFxuICAgICAgICAgICdfU3BoZXJlQWRkJyxcbiAgICAgICAgICAnX0VtaXNzaW9uTWFwJyxcbiAgICAgICAgICAnX091dGxpbmVXaWR0aFRleHR1cmUnLFxuICAgICAgICAgICdfVXZBbmltTWFza1RleHR1cmUnLFxuICAgICAgICBdLnNvbWUoKHRleHR1cmVOYW1lKSA9PiBuYW1lID09PSB0ZXh0dXJlTmFtZSk7XG4gICAgICAgIGlmIChpc1RleHR1cmVTVCkge1xuICAgICAgICAgIG5ld05hbWUgKz0gJ19TVCc7XG4gICAgICAgIH1cblxuICAgICAgICBwYXJhbXNbbmV3TmFtZV0gPSBuZXcgVEhSRUUuVmVjdG9yNCguLi52cm1Qcm9wcy52ZWN0b3JQcm9wZXJ0aWVzW25hbWVdKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgd2hldGhlciBpdCBuZWVkcyBza2lubmluZyBhbmQgbW9ycGhpbmcgb3Igbm90XG4gICAgcGFyYW1zLnNraW5uaW5nID0gKG9yaWdpbmFsTWF0ZXJpYWwgYXMgYW55KS5za2lubmluZyB8fCBmYWxzZTtcbiAgICBwYXJhbXMubW9ycGhUYXJnZXRzID0gKG9yaWdpbmFsTWF0ZXJpYWwgYXMgYW55KS5tb3JwaFRhcmdldHMgfHwgZmFsc2U7XG4gICAgcGFyYW1zLm1vcnBoTm9ybWFscyA9IChvcmlnaW5hbE1hdGVyaWFsIGFzIGFueSkubW9ycGhOb3JtYWxzIHx8IGZhbHNlO1xuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHRhc2tMaXN0KS50aGVuKCgpID0+IHBhcmFtcyk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcbmltcG9ydCB7IFZSTU1ldGEgfSBmcm9tICcuL1ZSTU1ldGEnO1xuaW1wb3J0IHsgVlJNTWV0YUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4vVlJNTWV0YUltcG9ydGVyT3B0aW9ucyc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEge0BsaW5rIFZSTU1ldGF9IGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTU1ldGFJbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJZiBgdHJ1ZWAsIGl0IHdvbid0IGxvYWQgaXRzIHRodW1ibmFpbCB0ZXh0dXJlICh7QGxpbmsgVlJNTWV0YS50ZXh0dXJlfSkuIGBmYWxzZWAgYnkgZGVmYXVsdC5cbiAgICovXG4gIHB1YmxpYyBpZ25vcmVUZXh0dXJlOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM/OiBWUk1NZXRhSW1wb3J0ZXJPcHRpb25zKSB7XG4gICAgdGhpcy5pZ25vcmVUZXh0dXJlID0gb3B0aW9ucz8uaWdub3JlVGV4dHVyZSA/PyBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNTWV0YSB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hTWV0YTogVlJNU2NoZW1hLk1ldGEgfCB1bmRlZmluZWQgPSB2cm1FeHQubWV0YTtcbiAgICBpZiAoIXNjaGVtYU1ldGEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCB0ZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIXRoaXMuaWdub3JlVGV4dHVyZSAmJiBzY2hlbWFNZXRhLnRleHR1cmUgIT0gbnVsbCAmJiBzY2hlbWFNZXRhLnRleHR1cmUgIT09IC0xKSB7XG4gICAgICB0ZXh0dXJlID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgndGV4dHVyZScsIHNjaGVtYU1ldGEudGV4dHVyZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFsbG93ZWRVc2VyTmFtZTogc2NoZW1hTWV0YS5hbGxvd2VkVXNlck5hbWUsXG4gICAgICBhdXRob3I6IHNjaGVtYU1ldGEuYXV0aG9yLFxuICAgICAgY29tbWVyY2lhbFVzc2FnZU5hbWU6IHNjaGVtYU1ldGEuY29tbWVyY2lhbFVzc2FnZU5hbWUsXG4gICAgICBjb250YWN0SW5mb3JtYXRpb246IHNjaGVtYU1ldGEuY29udGFjdEluZm9ybWF0aW9uLFxuICAgICAgbGljZW5zZU5hbWU6IHNjaGVtYU1ldGEubGljZW5zZU5hbWUsXG4gICAgICBvdGhlckxpY2Vuc2VVcmw6IHNjaGVtYU1ldGEub3RoZXJMaWNlbnNlVXJsLFxuICAgICAgb3RoZXJQZXJtaXNzaW9uVXJsOiBzY2hlbWFNZXRhLm90aGVyUGVybWlzc2lvblVybCxcbiAgICAgIHJlZmVyZW5jZTogc2NoZW1hTWV0YS5yZWZlcmVuY2UsXG4gICAgICBzZXh1YWxVc3NhZ2VOYW1lOiBzY2hlbWFNZXRhLnNleHVhbFVzc2FnZU5hbWUsXG4gICAgICB0ZXh0dXJlOiB0ZXh0dXJlID8/IHVuZGVmaW5lZCxcbiAgICAgIHRpdGxlOiBzY2hlbWFNZXRhLnRpdGxlLFxuICAgICAgdmVyc2lvbjogc2NoZW1hTWV0YS52ZXJzaW9uLFxuICAgICAgdmlvbGVudFVzc2FnZU5hbWU6IHNjaGVtYU1ldGEudmlvbGVudFVzc2FnZU5hbWUsXG4gICAgfTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG5jb25zdCBfbWF0QSA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XG5cbi8qKlxuICogQSBjb21wYXQgZnVuY3Rpb24gZm9yIGBNYXRyaXg0LmludmVydCgpYCAvIGBNYXRyaXg0LmdldEludmVyc2UoKWAuXG4gKiBgTWF0cml4NC5pbnZlcnQoKWAgaXMgaW50cm9kdWNlZCBpbiByMTIzIGFuZCBgTWF0cml4NC5nZXRJbnZlcnNlKClgIGVtaXRzIGEgd2FybmluZy5cbiAqIFdlIGFyZSBnb2luZyB0byB1c2UgdGhpcyBjb21wYXQgZm9yIGEgd2hpbGUuXG4gKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IG1hdHJpeFxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF0NEludmVydENvbXBhdDxUIGV4dGVuZHMgVEhSRUUuTWF0cml4ND4odGFyZ2V0OiBUKTogVCB7XG4gIGlmICgodGFyZ2V0IGFzIGFueSkuaW52ZXJ0KSB7XG4gICAgdGFyZ2V0LmludmVydCgpO1xuICB9IGVsc2Uge1xuICAgICh0YXJnZXQgYXMgYW55KS5nZXRJbnZlcnNlKF9tYXRBLmNvcHkodGFyZ2V0KSk7XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0O1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgbWF0NEludmVydENvbXBhdCB9IGZyb20gJy4vbWF0NEludmVydENvbXBhdCc7XG5cbmV4cG9ydCBjbGFzcyBNYXRyaXg0SW52ZXJzZUNhY2hlIHtcbiAgLyoqXG4gICAqIFRoZSB0YXJnZXQgbWF0cml4LlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG1hdHJpeDogVEhSRUUuTWF0cml4NDtcblxuICAvKipcbiAgICogQSBjYWNoZSBvZiBpbnZlcnNlIG9mIGN1cnJlbnQgbWF0cml4LlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfaW52ZXJzZUNhY2hlID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcblxuICAvKipcbiAgICogQSBmbGFnIHRoYXQgbWFrZXMgaXQgd2FudCB0byByZWNhbGN1bGF0ZSBpdHMge0BsaW5rIF9pbnZlcnNlQ2FjaGV9LlxuICAgKiBXaWxsIGJlIHNldCBgdHJ1ZWAgd2hlbiBgZWxlbWVudHNgIGFyZSBtdXRhdGVkIGFuZCBiZSB1c2VkIGluIGBnZXRJbnZlcnNlYC5cbiAgICovXG4gIHByaXZhdGUgX3Nob3VsZFVwZGF0ZUludmVyc2UgPSB0cnVlO1xuXG4gIC8qKlxuICAgKiBUaGUgb3JpZ2luYWwgb2YgYG1hdHJpeC5lbGVtZW50c2BcbiAgICovXG4gIHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsRWxlbWVudHM6IG51bWJlcltdO1xuXG4gIC8qKlxuICAgKiBJbnZlcnNlIG9mIGdpdmVuIG1hdHJpeC5cbiAgICogTm90ZSB0aGF0IGl0IHdpbGwgcmV0dXJuIGl0cyBpbnRlcm5hbCBwcml2YXRlIGluc3RhbmNlLlxuICAgKiBNYWtlIHN1cmUgY29weWluZyB0aGlzIGJlZm9yZSBtdXRhdGUgdGhpcy5cbiAgICovXG4gIHB1YmxpYyBnZXQgaW52ZXJzZSgpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICBpZiAodGhpcy5fc2hvdWxkVXBkYXRlSW52ZXJzZSkge1xuICAgICAgbWF0NEludmVydENvbXBhdCh0aGlzLl9pbnZlcnNlQ2FjaGUuY29weSh0aGlzLm1hdHJpeCkpO1xuICAgICAgdGhpcy5fc2hvdWxkVXBkYXRlSW52ZXJzZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pbnZlcnNlQ2FjaGU7XG4gIH1cblxuICBwdWJsaWMgY29uc3RydWN0b3IobWF0cml4OiBUSFJFRS5NYXRyaXg0KSB7XG4gICAgdGhpcy5tYXRyaXggPSBtYXRyaXg7XG5cbiAgICBjb25zdCBoYW5kbGVyOiBQcm94eUhhbmRsZXI8bnVtYmVyW10+ID0ge1xuICAgICAgc2V0OiAob2JqLCBwcm9wOiBudW1iZXIsIG5ld1ZhbCkgPT4ge1xuICAgICAgICB0aGlzLl9zaG91bGRVcGRhdGVJbnZlcnNlID0gdHJ1ZTtcbiAgICAgICAgb2JqW3Byb3BdID0gbmV3VmFsO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9O1xuXG4gICAgdGhpcy5fb3JpZ2luYWxFbGVtZW50cyA9IG1hdHJpeC5lbGVtZW50cztcbiAgICBtYXRyaXguZWxlbWVudHMgPSBuZXcgUHJveHkobWF0cml4LmVsZW1lbnRzLCBoYW5kbGVyKTtcbiAgfVxuXG4gIHB1YmxpYyByZXZlcnQoKTogdm9pZCB7XG4gICAgdGhpcy5tYXRyaXguZWxlbWVudHMgPSB0aGlzLl9vcmlnaW5hbEVsZW1lbnRzO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBtYXQ0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvbWF0NEludmVydENvbXBhdCc7XG5pbXBvcnQgeyBnZXRXb3JsZFF1YXRlcm5pb25MaXRlIH0gZnJvbSAnLi4vdXRpbHMvbWF0aCc7XG5pbXBvcnQgeyBNYXRyaXg0SW52ZXJzZUNhY2hlIH0gZnJvbSAnLi4vdXRpbHMvTWF0cml4NEludmVyc2VDYWNoZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuLy8gYmFzZWQgb25cbi8vIGh0dHA6Ly9yb2NrZXRqdW1wLnNrci5qcC91bml0eTNkLzEwOS9cbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kd2FuZ28vVW5pVlJNL2Jsb2IvbWFzdGVyL1NjcmlwdHMvU3ByaW5nQm9uZS9WUk1TcHJpbmdCb25lLmNzXG5cbmNvbnN0IElERU5USVRZX01BVFJJWDQgPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5NYXRyaXg0KCkpO1xuY29uc3QgSURFTlRJVFlfUVVBVEVSTklPTiA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLlF1YXRlcm5pb24oKSk7XG5cbi8vIOioiOeul+S4reOBruS4gOaZguS/neWtmOeUqOWkieaVsO+8iOS4gOW6puOCpOODs+OCueOCv+ODs+OCueOCkuS9nOOBo+OBn+OCieOBguOBqOOBr+S9v+OBhOWbnuOBme+8iVxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF92M0MgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcbmNvbnN0IF9tYXRBID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcbmNvbnN0IF9tYXRCID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgYSBzaW5nbGUgc3ByaW5nIGJvbmUgb2YgYSBWUk0uXG4gKiBJdCBzaG91bGQgYmUgbWFuYWdlZCBieSBhIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmUge1xuICAvKipcbiAgICogUmFkaXVzIG9mIHRoZSBib25lLCB3aWxsIGJlIHVzZWQgZm9yIGNvbGxpc2lvbi5cbiAgICovXG4gIHB1YmxpYyByYWRpdXM6IG51bWJlcjtcblxuICAvKipcbiAgICogU3RpZmZuZXNzIGZvcmNlIG9mIHRoZSBib25lLiBJbmNyZWFzaW5nIHRoZSB2YWx1ZSA9IGZhc3RlciBjb252ZXJnZW5jZSAoZmVlbHMgXCJoYXJkZXJcIikuXG4gICAqIE9uIFVuaVZSTSwgaXRzIHJhbmdlIG9uIEdVSSBpcyBiZXR3ZWVuIGAwLjBgIGFuZCBgNC4wYCAuXG4gICAqL1xuICBwdWJsaWMgc3RpZmZuZXNzRm9yY2U6IG51bWJlcjtcblxuICAvKipcbiAgICogUG93ZXIgb2YgdGhlIGdyYXZpdHkgYWdhaW5zdCB0aGlzIGJvbmUuXG4gICAqIFRoZSBcInBvd2VyXCIgdXNlZCBpbiBoZXJlIGlzIHZlcnkgZmFyIGZyb20gc2NpZW50aWZpYyBwaHlzaWNzIHRlcm0uLi5cbiAgICovXG4gIHB1YmxpYyBncmF2aXR5UG93ZXI6IG51bWJlcjtcblxuICAvKipcbiAgICogRGlyZWN0aW9uIG9mIHRoZSBncmF2aXR5IGFnYWluc3QgdGhpcyBib25lLlxuICAgKiBVc3VhbGx5IGl0IHNob3VsZCBiZSBub3JtYWxpemVkLlxuICAgKi9cbiAgcHVibGljIGdyYXZpdHlEaXI6IFRIUkVFLlZlY3RvcjM7XG5cbiAgLyoqXG4gICAqIERyYWcgZm9yY2Ugb2YgdGhlIGJvbmUuIEluY3JlYXNpbmcgdGhlIHZhbHVlID0gbGVzcyBvc2NpbGxhdGlvbiAoZmVlbHMgXCJoZWF2aWVyXCIpLlxuICAgKiBPbiBVbmlWUk0sIGl0cyByYW5nZSBvbiBHVUkgaXMgYmV0d2VlbiBgMC4wYCBhbmQgYDEuMGAgLlxuICAgKi9cbiAgcHVibGljIGRyYWdGb3JjZTogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBDb2xsaWRlciBncm91cHMgYXR0YWNoZWQgdG8gdGhpcyBib25lLlxuICAgKi9cbiAgcHVibGljIGNvbGxpZGVyczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaFtdO1xuXG4gIC8qKlxuICAgKiBBbiBPYmplY3QzRCBhdHRhY2hlZCB0byB0aGlzIGJvbmUuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYm9uZTogVEhSRUUuT2JqZWN0M0Q7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgX2N1cnJlbnRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogUHJldmlvdXMgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgX3ByZXZUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogTmV4dCBwb3NpdGlvbiBvZiBjaGlsZCB0YWlsLCBpbiB3b3JsZCB1bml0LiBXaWxsIGJlIHVzZWQgZm9yIHZlcmxldCBpbnRlZ3JhdGlvbi5cbiAgICogQWN0dWFsbHkgdXNlZCBvbmx5IGluIFtbdXBkYXRlXV0gYW5kIGl0J3Mga2luZCBvZiB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBwcm90ZWN0ZWQgX25leHRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBheGlzIG9mIHRoZSBib25lLCBpbiBsb2NhbCB1bml0LlxuICAgKi9cbiAgcHJvdGVjdGVkIF9ib25lQXhpcyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIExlbmd0aCBvZiB0aGUgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSB1bml0LiBXaWxsIGJlIHVzZWQgZm9yIG5vcm1hbGl6YXRpb24gaW4gdXBkYXRlIGxvb3AuXG4gICAqIEl0J3Mgc2FtZSBhcyBsb2NhbCB1bml0IGxlbmd0aCB1bmxlc3MgdGhlcmUgYXJlIHNjYWxlIHRyYW5zZm9ybWF0aW9uIGluIHdvcmxkIG1hdHJpeC5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyU3BhY2VCb25lTGVuZ3RoOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIG9mIHRoaXMgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSwga2luZCBvZiBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyU3BhY2VQb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIFRoaXMgc3ByaW5nYm9uZSB3aWxsIGJlIGNhbGN1bGF0ZWQgYmFzZWQgb24gdGhlIHNwYWNlIHJlbGF0aXZlIGZyb20gdGhpcyBvYmplY3QuXG4gICAqIElmIHRoaXMgaXMgYG51bGxgLCBzcHJpbmdib25lIHdpbGwgYmUgY2FsY3VsYXRlZCBpbiB3b3JsZCBzcGFjZS5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyOiBUSFJFRS5PYmplY3QzRCB8IG51bGwgPSBudWxsO1xuICBwdWJsaWMgZ2V0IGNlbnRlcigpOiBUSFJFRS5PYmplY3QzRCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLl9jZW50ZXI7XG4gIH1cbiAgcHVibGljIHNldCBjZW50ZXIoY2VudGVyOiBUSFJFRS5PYmplY3QzRCB8IG51bGwpIHtcbiAgICAvLyBjb252ZXJ0IHRhaWxzIHRvIHdvcmxkIHNwYWNlXG4gICAgdGhpcy5fZ2V0TWF0cml4Q2VudGVyVG9Xb3JsZChfbWF0QSk7XG5cbiAgICB0aGlzLl9jdXJyZW50VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuICAgIHRoaXMuX3ByZXZUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG4gICAgdGhpcy5fbmV4dFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcblxuICAgIC8vIHVuaW5zdGFsbCBpbnZlcnNlIGNhY2hlXG4gICAgaWYgKHRoaXMuX2NlbnRlcj8udXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkpIHtcbiAgICAgICh0aGlzLl9jZW50ZXIudXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkgYXMgTWF0cml4NEludmVyc2VDYWNoZSkucmV2ZXJ0KCk7XG4gICAgICBkZWxldGUgdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5O1xuICAgIH1cblxuICAgIC8vIGNoYW5nZSB0aGUgY2VudGVyXG4gICAgdGhpcy5fY2VudGVyID0gY2VudGVyO1xuXG4gICAgLy8gaW5zdGFsbCBpbnZlcnNlIGNhY2hlXG4gICAgaWYgKHRoaXMuX2NlbnRlcikge1xuICAgICAgaWYgKCF0aGlzLl9jZW50ZXIudXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkpIHtcbiAgICAgICAgdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5ID0gbmV3IE1hdHJpeDRJbnZlcnNlQ2FjaGUodGhpcy5fY2VudGVyLm1hdHJpeFdvcmxkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb252ZXJ0IHRhaWxzIHRvIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEEpO1xuXG4gICAgdGhpcy5fY3VycmVudFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcbiAgICB0aGlzLl9wcmV2VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuICAgIHRoaXMuX25leHRUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG5cbiAgICAvLyBjb252ZXJ0IGNlbnRlciBzcGFjZSBkZXBlbmRhbnQgc3RhdGVcbiAgICBfbWF0QS5tdWx0aXBseSh0aGlzLmJvbmUubWF0cml4V29ybGQpOyAvLyDwn5SlID8/XG5cbiAgICB0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG5cbiAgICB0aGlzLl9jZW50ZXJTcGFjZUJvbmVMZW5ndGggPSBfdjNBXG4gICAgICAuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKVxuICAgICAgLmFwcGx5TWF0cml4NChfbWF0QSlcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgIC5sZW5ndGgoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSb3RhdGlvbiBvZiBwYXJlbnQgYm9uZSwgaW4gd29ybGQgdW5pdC5cbiAgICogV2Ugc2hvdWxkIHVwZGF0ZSB0aGlzIGNvbnN0YW50bHkgaW4gW1t1cGRhdGVdXS5cbiAgICovXG4gIHByaXZhdGUgX3BhcmVudFdvcmxkUm90YXRpb24gPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsIHN0YXRlIG9mIHRoZSBsb2NhbCBtYXRyaXggb2YgdGhlIGJvbmUuXG4gICAqL1xuICBwcml2YXRlIF9pbml0aWFsTG9jYWxNYXRyaXggPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsIHN0YXRlIG9mIHRoZSByb3RhdGlvbiBvZiB0aGUgYm9uZS5cbiAgICovXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbFJvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgcG9zaXRpb24gb2YgaXRzIGNoaWxkLlxuICAgKi9cbiAgcHJpdmF0ZSBfaW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1TcHJpbmdCb25lLlxuICAgKlxuICAgKiBAcGFyYW0gYm9uZSBBbiBPYmplY3QzRCB0aGF0IHdpbGwgYmUgYXR0YWNoZWQgdG8gdGhpcyBib25lXG4gICAqIEBwYXJhbSBwYXJhbXMgU2V2ZXJhbCBwYXJhbWV0ZXJzIHJlbGF0ZWQgdG8gYmVoYXZpb3Igb2YgdGhlIHNwcmluZyBib25lXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyA9IHt9KSB7XG4gICAgdGhpcy5ib25lID0gYm9uZTsgLy8gdW5pVlJN44Gn44GuIHBhcmVudFxuICAgIHRoaXMuYm9uZS5tYXRyaXhBdXRvVXBkYXRlID0gZmFsc2U7IC8vIHVwZGF0ZeOBq+OCiOOCiuioiOeul+OBleOCjOOCi+OBruOBp3RocmVlLmpz5YaF44Gn44Gu6Ieq5YuV5Yem55CG44Gv5LiN6KaBXG5cbiAgICB0aGlzLnJhZGl1cyA9IHBhcmFtcy5yYWRpdXMgPz8gMC4wMjtcbiAgICB0aGlzLnN0aWZmbmVzc0ZvcmNlID0gcGFyYW1zLnN0aWZmbmVzc0ZvcmNlID8/IDEuMDtcbiAgICB0aGlzLmdyYXZpdHlEaXIgPSBwYXJhbXMuZ3Jhdml0eURpclxuICAgICAgPyBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkocGFyYW1zLmdyYXZpdHlEaXIpXG4gICAgICA6IG5ldyBUSFJFRS5WZWN0b3IzKCkuc2V0KDAuMCwgLTEuMCwgMC4wKTtcbiAgICB0aGlzLmdyYXZpdHlQb3dlciA9IHBhcmFtcy5ncmF2aXR5UG93ZXIgPz8gMC4wO1xuICAgIHRoaXMuZHJhZ0ZvcmNlID0gcGFyYW1zLmRyYWdGb3JjZSA/PyAwLjQ7XG4gICAgdGhpcy5jb2xsaWRlcnMgPSBwYXJhbXMuY29sbGlkZXJzID8/IFtdO1xuXG4gICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbi5zZXRGcm9tTWF0cml4UG9zaXRpb24odGhpcy5ib25lLm1hdHJpeFdvcmxkKTtcblxuICAgIHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeC5jb3B5KHRoaXMuYm9uZS5tYXRyaXgpO1xuICAgIHRoaXMuX2luaXRpYWxMb2NhbFJvdGF0aW9uLmNvcHkodGhpcy5ib25lLnF1YXRlcm5pb24pO1xuXG4gICAgaWYgKHRoaXMuYm9uZS5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIOacq+err+OBruODnOODvOODs+OAguWtkOODnOODvOODs+OBjOOBhOOBquOBhOOBn+OCgeOAjOiHquWIhuOBruWwkeOBl+WFiOOAjeOBjOWtkOODnOODvOODs+OBqOOBhOOBhuOBk+OBqOOBq+OBmeOCi1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2R3YW5nby9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9TcHJpbmdCb25lL1ZSTVNwcmluZ0JvbmUuY3MjTDI0NlxuICAgICAgdGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbi5jb3B5KHRoaXMuYm9uZS5wb3NpdGlvbikubm9ybWFsaXplKCkubXVsdGlwbHlTY2FsYXIoMC4wNyk7IC8vIG1hZ2ljIG51bWJlciEgZGVyaXZlcyBmcm9tIG9yaWdpbmFsIHNvdXJjZVxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmaXJzdENoaWxkID0gdGhpcy5ib25lLmNoaWxkcmVuWzBdO1xuICAgICAgdGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbi5jb3B5KGZpcnN0Q2hpbGQucG9zaXRpb24pO1xuICAgIH1cblxuICAgIHRoaXMuYm9uZS5sb2NhbFRvV29ybGQodGhpcy5fY3VycmVudFRhaWwuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKSk7XG4gICAgdGhpcy5fcHJldlRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XG4gICAgdGhpcy5fbmV4dFRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XG5cbiAgICB0aGlzLl9ib25lQXhpcy5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuICAgIHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aCA9IF92M0FcbiAgICAgIC5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pXG4gICAgICAuYXBwbHlNYXRyaXg0KHRoaXMuYm9uZS5tYXRyaXhXb3JsZClcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgIC5sZW5ndGgoKTtcblxuICAgIHRoaXMuY2VudGVyID0gcGFyYW1zLmNlbnRlciA/PyBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHRoZSBzdGF0ZSBvZiB0aGlzIGJvbmUuXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGNhbGwgW1tWUk1TcHJpbmdCb25lTWFuYWdlci5yZXNldF1dIGluc3RlYWQuXG4gICAqL1xuICBwdWJsaWMgcmVzZXQoKTogdm9pZCB7XG4gICAgdGhpcy5ib25lLnF1YXRlcm5pb24uY29weSh0aGlzLl9pbml0aWFsTG9jYWxSb3RhdGlvbik7XG5cbiAgICAvLyBXZSBuZWVkIHRvIHVwZGF0ZSBpdHMgbWF0cml4V29ybGQgbWFudWFsbHksIHNpbmNlIHdlIHR3ZWFrZWQgdGhlIGJvbmUgYnkgb3VyIGhhbmRcbiAgICB0aGlzLmJvbmUudXBkYXRlTWF0cml4KCk7XG4gICAgdGhpcy5ib25lLm1hdHJpeFdvcmxkLm11bHRpcGx5TWF0cmljZXModGhpcy5fZ2V0UGFyZW50TWF0cml4V29ybGQoKSwgdGhpcy5ib25lLm1hdHJpeCk7XG4gICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbi5zZXRGcm9tTWF0cml4UG9zaXRpb24odGhpcy5ib25lLm1hdHJpeFdvcmxkKTtcblxuICAgIC8vIEFwcGx5IHVwZGF0ZWQgcG9zaXRpb24gdG8gdGFpbCBzdGF0ZXNcbiAgICB0aGlzLmJvbmUubG9jYWxUb1dvcmxkKHRoaXMuX2N1cnJlbnRUYWlsLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbikpO1xuICAgIHRoaXMuX3ByZXZUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xuICAgIHRoaXMuX25leHRUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc3RhdGUgb2YgdGhpcyBib25lLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjYWxsIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXIudXBkYXRlXV0gaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxuICAgKi9cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKGRlbHRhIDw9IDApIHJldHVybjtcblxuICAgIC8vIOimquOCueODl+ODquODs+OCsOODnOODvOODs+OBruWnv+WLouOBr+W4uOOBq+WkieWMluOBl+OBpuOBhOOCi+OAglxuICAgIC8vIOOBneOCjOOBq+WfuuOBpeOBhOOBpuWHpueQhuebtOWJjeOBq+iHquWIhuOBrndvcmxkTWF0cml444KS5pu05paw44GX44Gm44GK44GPXG4gICAgdGhpcy5ib25lLm1hdHJpeFdvcmxkLm11bHRpcGx5TWF0cmljZXModGhpcy5fZ2V0UGFyZW50TWF0cml4V29ybGQoKSwgdGhpcy5ib25lLm1hdHJpeCk7XG5cbiAgICBpZiAodGhpcy5ib25lLnBhcmVudCkge1xuICAgICAgLy8gU3ByaW5nQm9uZeOBr+imquOBi+OCiemghuOBq+WHpueQhuOBleOCjOOBpuOBhOOBj+OBn+OCgeOAgVxuICAgICAgLy8g6Kaq44GubWF0cml4V29ybGTjga/mnIDmlrDnirbmhYvjga7liY3mj5Djgad3b3JsZE1hdHJpeOOBi+OCiXF1YXRlcm5pb27jgpLlj5bjgorlh7rjgZnjgIJcbiAgICAgIC8vIOWItumZkOOBr+OBguOCi+OBkeOCjOOBqeOAgeioiOeul+OBr+WwkeOBquOBhOOBruOBp2dldFdvcmxkUXVhdGVybmlvbuOBp+OBr+OBquOBj+OBk+OBruaWueazleOCkuWPluOCi+OAglxuICAgICAgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmJvbmUucGFyZW50LCB0aGlzLl9wYXJlbnRXb3JsZFJvdGF0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyZW50V29ybGRSb3RhdGlvbi5jb3B5KElERU5USVRZX1FVQVRFUk5JT04pO1xuICAgIH1cblxuICAgIC8vIEdldCBib25lIHBvc2l0aW9uIGluIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEEpO1xuICAgIF9tYXRBLm11bHRpcGx5KHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7IC8vIPCflKUgPz9cbiAgICB0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG5cbiAgICAvLyBHZXQgcGFyZW50IHBvc2l0aW9uIGluIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEIpO1xuICAgIF9tYXRCLm11bHRpcGx5KHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCkpO1xuXG4gICAgLy8gc2V2ZXJhbCBwYXJhbWV0ZXJzXG4gICAgY29uc3Qgc3RpZmZuZXNzID0gdGhpcy5zdGlmZm5lc3NGb3JjZSAqIGRlbHRhO1xuICAgIGNvbnN0IGV4dGVybmFsID0gX3YzQi5jb3B5KHRoaXMuZ3Jhdml0eURpcikubXVsdGlwbHlTY2FsYXIodGhpcy5ncmF2aXR5UG93ZXIgKiBkZWx0YSk7XG5cbiAgICAvLyB2ZXJsZXTnqY3liIbjgafmrKHjga7kvY3nva7jgpLoqIjnrpdcbiAgICB0aGlzLl9uZXh0VGFpbFxuICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXG4gICAgICAuYWRkKFxuICAgICAgICBfdjNBXG4gICAgICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXG4gICAgICAgICAgLnN1Yih0aGlzLl9wcmV2VGFpbClcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoMSAtIHRoaXMuZHJhZ0ZvcmNlKSxcbiAgICAgICkgLy8g5YmN44OV44Os44O844Og44Gu56e75YuV44KS57aZ57aa44GZ44KLKOa4m+ihsOOCguOBguOCi+OCiClcbiAgICAgIC5hZGQoXG4gICAgICAgIF92M0FcbiAgICAgICAgICAuY29weSh0aGlzLl9ib25lQXhpcylcbiAgICAgICAgICAuYXBwbHlNYXRyaXg0KHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeClcbiAgICAgICAgICAuYXBwbHlNYXRyaXg0KF9tYXRCKVxuICAgICAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgICAgICAubm9ybWFsaXplKClcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoc3RpZmZuZXNzKSxcbiAgICAgICkgLy8g6Kaq44Gu5Zue6Lui44Gr44KI44KL5a2Q44Oc44O844Oz44Gu56e75YuV55uu5qiZXG4gICAgICAuYWRkKGV4dGVybmFsKTsgLy8g5aSW5Yqb44Gr44KI44KL56e75YuV6YePXG5cbiAgICAvLyBub3JtYWxpemUgYm9uZSBsZW5ndGhcbiAgICB0aGlzLl9uZXh0VGFpbFxuICAgICAgLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKVxuICAgICAgLm5vcm1hbGl6ZSgpXG4gICAgICAubXVsdGlwbHlTY2FsYXIodGhpcy5fY2VudGVyU3BhY2VCb25lTGVuZ3RoKVxuICAgICAgLmFkZCh0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcblxuICAgIC8vIENvbGxpc2lvbuOBp+enu+WLlVxuICAgIHRoaXMuX2NvbGxpc2lvbih0aGlzLl9uZXh0VGFpbCk7XG5cbiAgICB0aGlzLl9wcmV2VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcbiAgICB0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX25leHRUYWlsKTtcblxuICAgIC8vIEFwcGx5IHJvdGF0aW9uLCBjb252ZXJ0IHZlY3RvcjMgdGhpbmcgaW50byBhY3R1YWwgcXVhdGVybmlvblxuICAgIC8vIE9yaWdpbmFsIFVuaVZSTSBpcyBkb2luZyB3b3JsZCB1bml0IGNhbGN1bHVzIGF0IGhlcmUgYnV0IHdlJ3JlIGdvbm5hIGRvIHRoaXMgb24gbG9jYWwgdW5pdFxuICAgIC8vIHNpbmNlIFRocmVlLmpzIGlzIG5vdCBnb29kIGF0IHdvcmxkIGNvb3JkaW5hdGlvbiBzdHVmZlxuICAgIGNvbnN0IGluaXRpYWxDZW50ZXJTcGFjZU1hdHJpeEludiA9IG1hdDRJbnZlcnRDb21wYXQoX21hdEEuY29weShfbWF0Qi5tdWx0aXBseSh0aGlzLl9pbml0aWFsTG9jYWxNYXRyaXgpKSk7XG4gICAgY29uc3QgYXBwbHlSb3RhdGlvbiA9IF9xdWF0QS5zZXRGcm9tVW5pdFZlY3RvcnMoXG4gICAgICB0aGlzLl9ib25lQXhpcyxcbiAgICAgIF92M0EuY29weSh0aGlzLl9uZXh0VGFpbCkuYXBwbHlNYXRyaXg0KGluaXRpYWxDZW50ZXJTcGFjZU1hdHJpeEludikubm9ybWFsaXplKCksXG4gICAgKTtcblxuICAgIHRoaXMuYm9uZS5xdWF0ZXJuaW9uLmNvcHkodGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24pLm11bHRpcGx5KGFwcGx5Um90YXRpb24pO1xuXG4gICAgLy8gV2UgbmVlZCB0byB1cGRhdGUgaXRzIG1hdHJpeFdvcmxkIG1hbnVhbGx5LCBzaW5jZSB3ZSB0d2Vha2VkIHRoZSBib25lIGJ5IG91ciBoYW5kXG4gICAgdGhpcy5ib25lLnVwZGF0ZU1hdHJpeCgpO1xuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCksIHRoaXMuYm9uZS5tYXRyaXgpO1xuICB9XG5cbiAgLyoqXG4gICAqIERvIGNvbGxpc2lvbiBtYXRoIGFnYWluc3QgZXZlcnkgY29sbGlkZXJzIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cbiAgICpcbiAgICogQHBhcmFtIHRhaWwgVGhlIHRhaWwgeW91IHdhbnQgdG8gcHJvY2Vzc1xuICAgKi9cbiAgcHJpdmF0ZSBfY29sbGlzaW9uKHRhaWw6IFRIUkVFLlZlY3RvcjMpOiB2b2lkIHtcbiAgICB0aGlzLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xuICAgICAgdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0QSk7XG4gICAgICBfbWF0QS5tdWx0aXBseShjb2xsaWRlci5tYXRyaXhXb3JsZCk7XG4gICAgICBjb25zdCBjb2xsaWRlckNlbnRlclNwYWNlUG9zaXRpb24gPSBfdjNBLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG4gICAgICBjb25zdCBjb2xsaWRlclJhZGl1cyA9IGNvbGxpZGVyLmdlb21ldHJ5LmJvdW5kaW5nU3BoZXJlIS5yYWRpdXM7IC8vIHRoZSBib3VuZGluZyBzcGhlcmUgaXMgZ3VhcmFudGVlZCB0byBiZSBleGlzdCBieSBWUk1TcHJpbmdCb25lSW1wb3J0ZXIuX2NyZWF0ZUNvbGxpZGVyTWVzaFxuICAgICAgY29uc3QgciA9IHRoaXMucmFkaXVzICsgY29sbGlkZXJSYWRpdXM7XG5cbiAgICAgIGlmICh0YWlsLmRpc3RhbmNlVG9TcXVhcmVkKGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbikgPD0gciAqIHIpIHtcbiAgICAgICAgLy8g44OS44OD44OI44CCQ29sbGlkZXLjga7ljYrlvoTmlrnlkJHjgavmirzjgZflh7rjgZlcbiAgICAgICAgY29uc3Qgbm9ybWFsID0gX3YzQi5zdWJWZWN0b3JzKHRhaWwsIGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbikubm9ybWFsaXplKCk7XG4gICAgICAgIGNvbnN0IHBvc0Zyb21Db2xsaWRlciA9IF92M0MuYWRkVmVjdG9ycyhjb2xsaWRlckNlbnRlclNwYWNlUG9zaXRpb24sIG5vcm1hbC5tdWx0aXBseVNjYWxhcihyKSk7XG5cbiAgICAgICAgLy8gbm9ybWFsaXplIGJvbmUgbGVuZ3RoXG4gICAgICAgIHRhaWwuY29weShcbiAgICAgICAgICBwb3NGcm9tQ29sbGlkZXJcbiAgICAgICAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgICAgICAgIC5ub3JtYWxpemUoKVxuICAgICAgICAgICAgLm11bHRpcGx5U2NhbGFyKHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aClcbiAgICAgICAgICAgIC5hZGQodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbiksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbWF0cml4IHRoYXQgY29udmVydHMgY2VudGVyIHNwYWNlIGludG8gd29ybGQgc3BhY2UuXG4gICAqIEBwYXJhbSB0YXJnZXQgVGFyZ2V0IG1hdHJpeFxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0TWF0cml4Q2VudGVyVG9Xb3JsZCh0YXJnZXQ6IFRIUkVFLk1hdHJpeDQpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICBpZiAodGhpcy5fY2VudGVyKSB7XG4gICAgICB0YXJnZXQuY29weSh0aGlzLl9jZW50ZXIubWF0cml4V29ybGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXQuaWRlbnRpdHkoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG1hdHJpeCB0aGF0IGNvbnZlcnRzIHdvcmxkIHNwYWNlIGludG8gY2VudGVyIHNwYWNlLlxuICAgKiBAcGFyYW0gdGFyZ2V0IFRhcmdldCBtYXRyaXhcbiAgICovXG4gIHByaXZhdGUgX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIodGFyZ2V0OiBUSFJFRS5NYXRyaXg0KTogVEhSRUUuTWF0cml4NCB7XG4gICAgaWYgKHRoaXMuX2NlbnRlcikge1xuICAgICAgdGFyZ2V0LmNvcHkoKHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSBhcyBNYXRyaXg0SW52ZXJzZUNhY2hlKS5pbnZlcnNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0LmlkZW50aXR5KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB3b3JsZCBtYXRyaXggb2YgaXRzIHBhcmVudCBvYmplY3QuXG4gICAqL1xuICBwcml2YXRlIF9nZXRQYXJlbnRNYXRyaXhXb3JsZCgpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICByZXR1cm4gdGhpcy5ib25lLnBhcmVudCA/IHRoaXMuYm9uZS5wYXJlbnQubWF0cml4V29ybGQgOiBJREVOVElUWV9NQVRSSVg0O1xuICB9XG59XG4iLCJpbXBvcnQgeyBWUk1TcHJpbmdCb25lIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBzcHJpbmcgYm9uZSBncm91cCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IHR5cGUgVlJNU3ByaW5nQm9uZUdyb3VwID0gVlJNU3ByaW5nQm9uZVtdO1xuXG4vKipcbiAqIEEgY2xhc3MgbWFuYWdlcyBldmVyeSBzcHJpbmcgYm9uZXMgb24gYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lTWFuYWdlciB7XG4gIHB1YmxpYyByZWFkb25seSBjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSA9IFtdO1xuICBwdWJsaWMgcmVhZG9ubHkgc3ByaW5nQm9uZUdyb3VwTGlzdDogVlJNU3ByaW5nQm9uZUdyb3VwW10gPSBbXTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXVxuICAgKlxuICAgKiBAcGFyYW0gc3ByaW5nQm9uZUdyb3VwTGlzdCBBbiBhcnJheSBvZiBbW1ZSTVNwcmluZ0JvbmVHcm91cF1dXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IoY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10sIHNwcmluZ0JvbmVHcm91cExpc3Q6IFZSTVNwcmluZ0JvbmVHcm91cFtdKSB7XG4gICAgdGhpcy5jb2xsaWRlckdyb3VwcyA9IGNvbGxpZGVyR3JvdXBzO1xuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdCA9IHNwcmluZ0JvbmVHcm91cExpc3Q7XG4gIH1cblxuICAvKipcbiAgICogU2V0IGFsbCBib25lcyBiZSBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBzcGFjZSByZWxhdGl2ZSBmcm9tIHRoaXMgb2JqZWN0LlxuICAgKiBJZiBgbnVsbGAgaXMgZ2l2ZW4sIHNwcmluZ2JvbmUgd2lsbCBiZSBjYWxjdWxhdGVkIGluIHdvcmxkIHNwYWNlLlxuICAgKiBAcGFyYW0gcm9vdCBSb290IG9iamVjdCwgb3IgYG51bGxgXG4gICAqL1xuICBwdWJsaWMgc2V0Q2VudGVyKHJvb3Q6IFRIUkVFLk9iamVjdDNEIHwgbnVsbCk6IHZvaWQge1xuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcbiAgICAgIHNwcmluZ0JvbmVHcm91cC5mb3JFYWNoKChzcHJpbmdCb25lKSA9PiB7XG4gICAgICAgIHNwcmluZ0JvbmUuY2VudGVyID0gcm9vdDtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBldmVyeSBzcHJpbmcgYm9uZSBhdHRhY2hlZCB0byB0aGlzIG1hbmFnZXIuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcbiAgICovXG4gIHB1YmxpYyBsYXRlVXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QuZm9yRWFjaCgoc3ByaW5nQm9uZUdyb3VwKSA9PiB7XG4gICAgICBzcHJpbmdCb25lR3JvdXAuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xuICAgICAgICBzcHJpbmdCb25lLnVwZGF0ZShkZWx0YSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBldmVyeSBzcHJpbmcgYm9uZSBhdHRhY2hlZCB0byB0aGlzIG1hbmFnZXIuXG4gICAqL1xuICBwdWJsaWMgcmVzZXQoKTogdm9pZCB7XG4gICAgdGhpcy5zcHJpbmdCb25lR3JvdXBMaXN0LmZvckVhY2goKHNwcmluZ0JvbmVHcm91cCkgPT4ge1xuICAgICAgc3ByaW5nQm9uZUdyb3VwLmZvckVhY2goKHNwcmluZ0JvbmUpID0+IHtcbiAgICAgICAgc3ByaW5nQm9uZS5yZXNldCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcbmltcG9ydCB7IEdMVEZOb2RlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwLCBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lR3JvdXAsIFZSTVNwcmluZ0JvbmVNYW5hZ2VyIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lTWFuYWdlcic7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuY29uc3QgX2NvbGxpZGVyTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoeyB2aXNpYmxlOiBmYWxzZSB9KTtcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUltcG9ydGVyIHtcbiAgLyoqXG4gICAqIEltcG9ydCBhIFtbVlJNTG9va0F0SGVhZF1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1TcHJpbmdCb25lTWFuYWdlciB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb246IFZSTVNjaGVtYS5TZWNvbmRhcnlBbmltYXRpb24gfCB1bmRlZmluZWQgPSB2cm1FeHQuc2Vjb25kYXJ5QW5pbWF0aW9uO1xuICAgIGlmICghc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uKSByZXR1cm4gbnVsbDtcblxuICAgIC8vIOihneeqgeWIpOWumueQg+S9k+ODoeODg+OCt+ODpeOAglxuICAgIGNvbnN0IGNvbGxpZGVyR3JvdXBzID0gYXdhaXQgdGhpcy5faW1wb3J0Q29sbGlkZXJNZXNoR3JvdXBzKGdsdGYsIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbik7XG5cbiAgICAvLyDlkIzjgZjlsZ7mgKfvvIhzdGlmZmluZXNz44KEZHJhZ0ZvcmNl44GM5ZCM44GY77yJ44Gu44Oc44O844Oz44GvYm9uZUdyb3Vw44Gr44G+44Go44KB44KJ44KM44Gm44GE44KL44CCXG4gICAgLy8g5LiA5YiX44Gg44GR44Gn44Gv44Gq44GE44GT44Go44Gr5rOo5oSP44CCXG4gICAgY29uc3Qgc3ByaW5nQm9uZUdyb3VwTGlzdCA9IGF3YWl0IHRoaXMuX2ltcG9ydFNwcmluZ0JvbmVHcm91cExpc3QoZ2x0Ziwgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uLCBjb2xsaWRlckdyb3Vwcyk7XG5cbiAgICByZXR1cm4gbmV3IFZSTVNwcmluZ0JvbmVNYW5hZ2VyKGNvbGxpZGVyR3JvdXBzLCBzcHJpbmdCb25lR3JvdXBMaXN0KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfY3JlYXRlU3ByaW5nQm9uZShib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyA9IHt9KTogVlJNU3ByaW5nQm9uZSB7XG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lKGJvbmUsIHBhcmFtcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgYXN5bmMgX2ltcG9ydFNwcmluZ0JvbmVHcm91cExpc3QoXG4gICAgZ2x0ZjogR0xURixcbiAgICBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb246IFZSTVNjaGVtYS5TZWNvbmRhcnlBbmltYXRpb24sXG4gICAgY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10sXG4gICk6IFByb21pc2U8VlJNU3ByaW5nQm9uZUdyb3VwW10+IHtcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBzOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uU3ByaW5nW10gPSBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24uYm9uZUdyb3VwcyB8fCBbXTtcblxuICAgIGNvbnN0IHNwcmluZ0JvbmVHcm91cExpc3Q6IFZSTVNwcmluZ0JvbmVHcm91cFtdID0gW107XG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIHNwcmluZ0JvbmVHcm91cHMubWFwKGFzeW5jICh2cm1Cb25lR3JvdXApID0+IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHZybUJvbmVHcm91cC5zdGlmZmluZXNzID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpciA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueiA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlQb3dlciA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmRyYWdGb3JjZSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmhpdFJhZGl1cyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmNvbGxpZGVyR3JvdXBzID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuYm9uZXMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5jZW50ZXIgPT09IHVuZGVmaW5lZFxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdGlmZm5lc3NGb3JjZSA9IHZybUJvbmVHcm91cC5zdGlmZmluZXNzO1xuICAgICAgICBjb25zdCBncmF2aXR5RGlyID0gbmV3IFRIUkVFLlZlY3RvcjMoXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueCxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpci55LFxuICAgICAgICAgIC12cm1Cb25lR3JvdXAuZ3Jhdml0eURpci56LCAvLyBWUk0gMC4wIHVzZXMgbGVmdC1oYW5kZWQgeS11cFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBncmF2aXR5UG93ZXIgPSB2cm1Cb25lR3JvdXAuZ3Jhdml0eVBvd2VyO1xuICAgICAgICBjb25zdCBkcmFnRm9yY2UgPSB2cm1Cb25lR3JvdXAuZHJhZ0ZvcmNlO1xuICAgICAgICBjb25zdCByYWRpdXMgPSB2cm1Cb25lR3JvdXAuaGl0UmFkaXVzO1xuXG4gICAgICAgIGNvbnN0IGNvbGxpZGVyczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaFtdID0gW107XG4gICAgICAgIHZybUJvbmVHcm91cC5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckluZGV4KSA9PiB7XG4gICAgICAgICAgY29sbGlkZXJzLnB1c2goLi4uY29sbGlkZXJHcm91cHNbY29sbGlkZXJJbmRleF0uY29sbGlkZXJzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc3ByaW5nQm9uZUdyb3VwOiBWUk1TcHJpbmdCb25lR3JvdXAgPSBbXTtcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmJvbmVzLm1hcChhc3luYyAobm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICAvLyBWUk3jga7mg4XloLHjgYvjgonjgIzmj7rjgozjg6Ljg47jgI3jg5zjg7zjg7Pjga7jg6vjg7zjg4jjgYzlj5bjgozjgotcbiAgICAgICAgICAgIGNvbnN0IHNwcmluZ1Jvb3RCb25lOiBHTFRGTm9kZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBub2RlSW5kZXgpO1xuXG4gICAgICAgICAgICBjb25zdCBjZW50ZXI6IEdMVEZOb2RlID1cbiAgICAgICAgICAgICAgdnJtQm9uZUdyb3VwLmNlbnRlciEgIT09IC0xID8gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIHZybUJvbmVHcm91cC5jZW50ZXIhKSA6IG51bGw7XG5cbiAgICAgICAgICAgIC8vIGl0J3Mgd2VpcmQgYnV0IHRoZXJlIG1pZ2h0IGJlIGNhc2VzIHdlIGNhbid0IGZpbmQgdGhlIHJvb3QgYm9uZVxuICAgICAgICAgICAgaWYgKCFzcHJpbmdSb290Qm9uZSkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNwcmluZ1Jvb3RCb25lLnRyYXZlcnNlKChib25lKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHNwcmluZ0JvbmUgPSB0aGlzLl9jcmVhdGVTcHJpbmdCb25lKGJvbmUsIHtcbiAgICAgICAgICAgICAgICByYWRpdXMsXG4gICAgICAgICAgICAgICAgc3RpZmZuZXNzRm9yY2UsXG4gICAgICAgICAgICAgICAgZ3Jhdml0eURpcixcbiAgICAgICAgICAgICAgICBncmF2aXR5UG93ZXIsXG4gICAgICAgICAgICAgICAgZHJhZ0ZvcmNlLFxuICAgICAgICAgICAgICAgIGNvbGxpZGVycyxcbiAgICAgICAgICAgICAgICBjZW50ZXIsXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBzcHJpbmdCb25lR3JvdXAucHVzaChzcHJpbmdCb25lKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuXG4gICAgICAgIHNwcmluZ0JvbmVHcm91cExpc3QucHVzaChzcHJpbmdCb25lR3JvdXApO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHJldHVybiBzcHJpbmdCb25lR3JvdXBMaXN0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbiBhcnJheSBvZiBbW1ZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwXV0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKiBAcGFyYW0gc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uIEEgYHNlY29uZGFyeUFuaW1hdGlvbmAgZmllbGQgb2YgVlJNXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgX2ltcG9ydENvbGxpZGVyTWVzaEdyb3VwcyhcbiAgICBnbHRmOiBHTFRGLFxuICAgIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbixcbiAgKTogUHJvbWlzZTxWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdPiB7XG4gICAgY29uc3QgdnJtQ29sbGlkZXJHcm91cHMgPSBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24uY29sbGlkZXJHcm91cHM7XG4gICAgaWYgKHZybUNvbGxpZGVyR3JvdXBzID09PSB1bmRlZmluZWQpIHJldHVybiBbXTtcblxuICAgIGNvbnN0IGNvbGxpZGVyR3JvdXBzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdID0gW107XG4gICAgdnJtQ29sbGlkZXJHcm91cHMuZm9yRWFjaChhc3luYyAoY29sbGlkZXJHcm91cCkgPT4ge1xuICAgICAgaWYgKGNvbGxpZGVyR3JvdXAubm9kZSA9PT0gdW5kZWZpbmVkIHx8IGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBib25lID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIGNvbGxpZGVyR3JvdXAubm9kZSk7XG4gICAgICBjb25zdCBjb2xsaWRlcnM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2hbXSA9IFtdO1xuICAgICAgY29sbGlkZXJHcm91cC5jb2xsaWRlcnMuZm9yRWFjaCgoY29sbGlkZXIpID0+IHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgY29sbGlkZXIub2Zmc2V0LnggPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldC55ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueiA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgY29sbGlkZXIucmFkaXVzID09PSB1bmRlZmluZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gX3YzQS5zZXQoXG4gICAgICAgICAgY29sbGlkZXIub2Zmc2V0LngsXG4gICAgICAgICAgY29sbGlkZXIub2Zmc2V0LnksXG4gICAgICAgICAgLWNvbGxpZGVyLm9mZnNldC56LCAvLyBWUk0gMC4wIHVzZXMgbGVmdC1oYW5kZWQgeS11cFxuICAgICAgICApO1xuICAgICAgICBjb25zdCBjb2xsaWRlck1lc2ggPSB0aGlzLl9jcmVhdGVDb2xsaWRlck1lc2goY29sbGlkZXIucmFkaXVzLCBvZmZzZXQpO1xuXG4gICAgICAgIGJvbmUuYWRkKGNvbGxpZGVyTWVzaCk7XG4gICAgICAgIGNvbGxpZGVycy5wdXNoKGNvbGxpZGVyTWVzaCk7XG4gICAgICB9KTtcblxuICAgICAgY29uc3QgY29sbGlkZXJNZXNoR3JvdXAgPSB7XG4gICAgICAgIG5vZGU6IGNvbGxpZGVyR3JvdXAubm9kZSxcbiAgICAgICAgY29sbGlkZXJzLFxuICAgICAgfTtcbiAgICAgIGNvbGxpZGVyR3JvdXBzLnB1c2goY29sbGlkZXJNZXNoR3JvdXApO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGNvbGxpZGVyR3JvdXBzO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGNvbGxpZGVyIG1lc2guXG4gICAqXG4gICAqIEBwYXJhbSByYWRpdXMgUmFkaXVzIG9mIHRoZSBuZXcgY29sbGlkZXIgbWVzaFxuICAgKiBAcGFyYW0gb2Zmc2V0IE9mZmVzdCBvZiB0aGUgbmV3IGNvbGxpZGVyIG1lc2hcbiAgICovXG4gIHByb3RlY3RlZCBfY3JlYXRlQ29sbGlkZXJNZXNoKHJhZGl1czogbnVtYmVyLCBvZmZzZXQ6IFRIUkVFLlZlY3RvcjMpOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoIHtcbiAgICBjb25zdCBjb2xsaWRlck1lc2ggPSBuZXcgVEhSRUUuTWVzaChuZXcgVEhSRUUuU3BoZXJlQnVmZmVyR2VvbWV0cnkocmFkaXVzLCA4LCA0KSwgX2NvbGxpZGVyTWF0ZXJpYWwpO1xuXG4gICAgY29sbGlkZXJNZXNoLnBvc2l0aW9uLmNvcHkob2Zmc2V0KTtcblxuICAgIC8vIHRoZSBuYW1lIGhhdmUgdG8gYmUgdGhpcyBpbiBvcmRlciB0byBleGNsdWRlIGNvbGxpZGVycyBmcm9tIGJvdW5kaW5nIGJveFxuICAgIC8vIChTZWUgVmlld2VyLnRzLCBzZWFyY2ggZm9yIGNoaWxkLm5hbWUgPT09ICd2cm1Db2xsaWRlclNwaGVyZScpXG4gICAgY29sbGlkZXJNZXNoLm5hbWUgPSAndnJtQ29sbGlkZXJTcGhlcmUnO1xuXG4gICAgLy8gV2Ugd2lsbCB1c2UgdGhlIHJhZGl1cyBvZiB0aGUgc3BoZXJlIGZvciBjb2xsaXNpb24gdnMgYm9uZXMuXG4gICAgLy8gYGJvdW5kaW5nU3BoZXJlYCBtdXN0IGJlIGNyZWF0ZWQgdG8gY29tcHV0ZSB0aGUgcmFkaXVzLlxuICAgIGNvbGxpZGVyTWVzaC5nZW9tZXRyeS5jb21wdXRlQm91bmRpbmdTcGhlcmUoKTtcblxuICAgIHJldHVybiBjb2xsaWRlck1lc2g7XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVJbXBvcnRlciB9IGZyb20gJy4vYmxlbmRzaGFwZSc7XG5pbXBvcnQgeyBWUk1GaXJzdFBlcnNvbkltcG9ydGVyIH0gZnJvbSAnLi9maXJzdHBlcnNvbic7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZEltcG9ydGVyIH0gZnJvbSAnLi9odW1hbm9pZC9WUk1IdW1hbm9pZEltcG9ydGVyJztcbmltcG9ydCB7IFZSTUxvb2tBdEltcG9ydGVyIH0gZnJvbSAnLi9sb29rYXQvVlJNTG9va0F0SW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNTWF0ZXJpYWxJbXBvcnRlciB9IGZyb20gJy4vbWF0ZXJpYWwnO1xuaW1wb3J0IHsgVlJNTWV0YUltcG9ydGVyIH0gZnJvbSAnLi9tZXRhL1ZSTU1ldGFJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIgfSBmcm9tICcuL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZUltcG9ydGVyJztcbmltcG9ydCB7IFZSTSB9IGZyb20gJy4vVlJNJztcblxuZXhwb3J0IGludGVyZmFjZSBWUk1JbXBvcnRlck9wdGlvbnMge1xuICBtZXRhSW1wb3J0ZXI/OiBWUk1NZXRhSW1wb3J0ZXI7XG4gIGxvb2tBdEltcG9ydGVyPzogVlJNTG9va0F0SW1wb3J0ZXI7XG4gIGh1bWFub2lkSW1wb3J0ZXI/OiBWUk1IdW1hbm9pZEltcG9ydGVyO1xuICBibGVuZFNoYXBlSW1wb3J0ZXI/OiBWUk1CbGVuZFNoYXBlSW1wb3J0ZXI7XG4gIGZpcnN0UGVyc29uSW1wb3J0ZXI/OiBWUk1GaXJzdFBlcnNvbkltcG9ydGVyO1xuICBtYXRlcmlhbEltcG9ydGVyPzogVlJNTWF0ZXJpYWxJbXBvcnRlcjtcbiAgc3ByaW5nQm9uZUltcG9ydGVyPzogVlJNU3ByaW5nQm9uZUltcG9ydGVyO1xufVxuXG4vKipcbiAqIEFuIGltcG9ydGVyIHRoYXQgaW1wb3J0cyBhIFtbVlJNXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSW1wb3J0ZXIge1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX21ldGFJbXBvcnRlcjogVlJNTWV0YUltcG9ydGVyO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX2JsZW5kU2hhcGVJbXBvcnRlcjogVlJNQmxlbmRTaGFwZUltcG9ydGVyO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX2xvb2tBdEltcG9ydGVyOiBWUk1Mb29rQXRJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9odW1hbm9pZEltcG9ydGVyOiBWUk1IdW1hbm9pZEltcG9ydGVyO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX2ZpcnN0UGVyc29uSW1wb3J0ZXI6IFZSTUZpcnN0UGVyc29uSW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfbWF0ZXJpYWxJbXBvcnRlcjogVlJNTWF0ZXJpYWxJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9zcHJpbmdCb25lSW1wb3J0ZXI6IFZSTVNwcmluZ0JvbmVJbXBvcnRlcjtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUltcG9ydGVyLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBbW1ZSTUltcG9ydGVyT3B0aW9uc11dLCBvcHRpb25hbGx5IGNvbnRhaW5zIGltcG9ydGVycyBmb3IgZWFjaCBjb21wb25lbnRcbiAgICovXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMuX21ldGFJbXBvcnRlciA9IG9wdGlvbnMubWV0YUltcG9ydGVyIHx8IG5ldyBWUk1NZXRhSW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9ibGVuZFNoYXBlSW1wb3J0ZXIgPSBvcHRpb25zLmJsZW5kU2hhcGVJbXBvcnRlciB8fCBuZXcgVlJNQmxlbmRTaGFwZUltcG9ydGVyKCk7XG4gICAgdGhpcy5fbG9va0F0SW1wb3J0ZXIgPSBvcHRpb25zLmxvb2tBdEltcG9ydGVyIHx8IG5ldyBWUk1Mb29rQXRJbXBvcnRlcigpO1xuICAgIHRoaXMuX2h1bWFub2lkSW1wb3J0ZXIgPSBvcHRpb25zLmh1bWFub2lkSW1wb3J0ZXIgfHwgbmV3IFZSTUh1bWFub2lkSW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9maXJzdFBlcnNvbkltcG9ydGVyID0gb3B0aW9ucy5maXJzdFBlcnNvbkltcG9ydGVyIHx8IG5ldyBWUk1GaXJzdFBlcnNvbkltcG9ydGVyKCk7XG4gICAgdGhpcy5fbWF0ZXJpYWxJbXBvcnRlciA9IG9wdGlvbnMubWF0ZXJpYWxJbXBvcnRlciB8fCBuZXcgVlJNTWF0ZXJpYWxJbXBvcnRlcigpO1xuICAgIHRoaXMuX3NwcmluZ0JvbmVJbXBvcnRlciA9IG9wdGlvbnMuc3ByaW5nQm9uZUltcG9ydGVyIHx8IG5ldyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNlaXZlIGEgR0xURiBvYmplY3QgcmV0cmlldmVkIGZyb20gYFRIUkVFLkdMVEZMb2FkZXJgIGFuZCBjcmVhdGUgYSBuZXcgW1tWUk1dXSBpbnN0YW5jZS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTT4ge1xuICAgIGlmIChnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMgPT09IHVuZGVmaW5lZCB8fCBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMuVlJNID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgVlJNIGV4dGVuc2lvbiBvbiB0aGUgR0xURicpO1xuICAgIH1cbiAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmU7XG5cbiAgICBzY2VuZS51cGRhdGVNYXRyaXhXb3JsZChmYWxzZSk7XG5cbiAgICAvLyBTa2lubmVkIG9iamVjdCBzaG91bGQgbm90IGJlIGZydXN0dW1DdWxsZWRcbiAgICAvLyBTaW5jZSBwcmUtc2tpbm5lZCBwb3NpdGlvbiBtaWdodCBiZSBvdXRzaWRlIG9mIHZpZXdcbiAgICBzY2VuZS50cmF2ZXJzZSgob2JqZWN0M2QpID0+IHtcbiAgICAgIGlmICgob2JqZWN0M2QgYXMgYW55KS5pc01lc2gpIHtcbiAgICAgICAgb2JqZWN0M2QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgbWV0YSA9IChhd2FpdCB0aGlzLl9tZXRhSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBtYXRlcmlhbHMgPSAoYXdhaXQgdGhpcy5fbWF0ZXJpYWxJbXBvcnRlci5jb252ZXJ0R0xURk1hdGVyaWFscyhnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgaHVtYW5vaWQgPSAoYXdhaXQgdGhpcy5faHVtYW5vaWRJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGZpcnN0UGVyc29uID0gaHVtYW5vaWQgPyAoYXdhaXQgdGhpcy5fZmlyc3RQZXJzb25JbXBvcnRlci5pbXBvcnQoZ2x0ZiwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBibGVuZFNoYXBlUHJveHkgPSAoYXdhaXQgdGhpcy5fYmxlbmRTaGFwZUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgbG9va0F0ID1cbiAgICAgIGZpcnN0UGVyc29uICYmIGJsZW5kU2hhcGVQcm94eSAmJiBodW1hbm9pZFxuICAgICAgICA/IChhd2FpdCB0aGlzLl9sb29rQXRJbXBvcnRlci5pbXBvcnQoZ2x0ZiwgZmlyc3RQZXJzb24sIGJsZW5kU2hhcGVQcm94eSwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWRcbiAgICAgICAgOiB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBzcHJpbmdCb25lTWFuYWdlciA9IChhd2FpdCB0aGlzLl9zcHJpbmdCb25lSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICByZXR1cm4gbmV3IFZSTSh7XG4gICAgICBzY2VuZTogZ2x0Zi5zY2VuZSxcbiAgICAgIG1ldGEsXG4gICAgICBtYXRlcmlhbHMsXG4gICAgICBodW1hbm9pZCxcbiAgICAgIGZpcnN0UGVyc29uLFxuICAgICAgYmxlbmRTaGFwZVByb3h5LFxuICAgICAgbG9va0F0LFxuICAgICAgc3ByaW5nQm9uZU1hbmFnZXIsXG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4vYmxlbmRzaGFwZSc7XG5pbXBvcnQgeyBWUk1GaXJzdFBlcnNvbiB9IGZyb20gJy4vZmlyc3RwZXJzb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuL2h1bWFub2lkJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuL2xvb2thdCc7XG5pbXBvcnQgeyBWUk1NZXRhIH0gZnJvbSAnLi9tZXRhL1ZSTU1ldGEnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXIgfSBmcm9tICcuL3NwcmluZ2JvbmUnO1xuaW1wb3J0IHsgZGVlcERpc3Bvc2UgfSBmcm9tICcuL3V0aWxzL2Rpc3Bvc2VyJztcbmltcG9ydCB7IFZSTUltcG9ydGVyLCBWUk1JbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuL1ZSTUltcG9ydGVyJztcblxuLyoqXG4gKiBQYXJhbWV0ZXJzIGZvciBhIFtbVlJNXV0gY2xhc3MuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVlJNUGFyYW1ldGVycyB7XG4gIHNjZW5lOiBUSFJFRS5TY2VuZSB8IFRIUkVFLkdyb3VwOyAvLyBDT01QQVQ6IGBHTFRGLnNjZW5lYCBpcyBnb2luZyB0byBiZSBgVEhSRUUuR3JvdXBgIGluIHIxMTRcbiAgaHVtYW5vaWQ/OiBWUk1IdW1hbm9pZDtcbiAgYmxlbmRTaGFwZVByb3h5PzogVlJNQmxlbmRTaGFwZVByb3h5O1xuICBmaXJzdFBlcnNvbj86IFZSTUZpcnN0UGVyc29uO1xuICBsb29rQXQ/OiBWUk1Mb29rQXRIZWFkO1xuICBtYXRlcmlhbHM/OiBUSFJFRS5NYXRlcmlhbFtdO1xuICBzcHJpbmdCb25lTWFuYWdlcj86IFZSTVNwcmluZ0JvbmVNYW5hZ2VyO1xuICBtZXRhPzogVlJNTWV0YTtcbn1cblxuLyoqXG4gKiBBIGNsYXNzIHRoYXQgcmVwcmVzZW50cyBhIHNpbmdsZSBWUk0gbW9kZWwuXG4gKiBTZWUgdGhlIGRvY3VtZW50YXRpb24gb2YgW1tWUk0uZnJvbV1dIGZvciB0aGUgbW9zdCBiYXNpYyB1c2Ugb2YgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNIHtcbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk0gZnJvbSBhIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXIuXG4gICAqIEl0J3MgcHJvYmFibHkgYSB0aGluZyB3aGF0IHlvdSB3YW50IHRvIGdldCBzdGFydGVkIHdpdGggVlJNcy5cbiAgICpcbiAgICogQGV4YW1wbGUgTW9zdCBiYXNpYyB1c2Ugb2YgVlJNXG4gICAqIGBgYFxuICAgKiBjb25zdCBzY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuICAgKlxuICAgKiBuZXcgVEhSRUUuR0xURkxvYWRlcigpLmxvYWQoICdtb2RlbHMvdGhyZWUtdnJtLWdpcmwudnJtJywgKCBnbHRmICkgPT4ge1xuICAgKlxuICAgKiAgIFRIUkVFLlZSTS5mcm9tKCBnbHRmICkudGhlbiggKCB2cm0gKSA9PiB7XG4gICAqXG4gICAqICAgICBzY2VuZS5hZGQoIHZybS5zY2VuZSApO1xuICAgKlxuICAgKiAgIH0gKTtcbiAgICpcbiAgICogfSApO1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgR0xURiBvYmplY3QgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbnMgdGhhdCB3aWxsIGJlIHVzZWQgaW4gaW1wb3J0ZXJcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZnJvbShnbHRmOiBHTFRGLCBvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSk6IFByb21pc2U8VlJNPiB7XG4gICAgY29uc3QgaW1wb3J0ZXIgPSBuZXcgVlJNSW1wb3J0ZXIob3B0aW9ucyk7XG4gICAgcmV0dXJuIGF3YWl0IGltcG9ydGVyLmltcG9ydChnbHRmKTtcbiAgfVxuICAvKipcbiAgICogYFRIUkVFLlNjZW5lYCBvciBgVEhSRUUuR3JvdXBgIChkZXBlbmRzIG9uIHlvdXIgdGhyZWUuanMgcmV2aXNpb24pIHRoYXQgY29udGFpbnMgdGhlIGVudGlyZSBWUk0uXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc2NlbmU6IFRIUkVFLlNjZW5lIHwgVEhSRUUuR3JvdXA7IC8vIENPTVBBVDogYEdMVEYuc2NlbmVgIGlzIGdvaW5nIHRvIGJlIGBUSFJFRS5Hcm91cGAgaW4gcjExNFxuXG4gIC8qKlxuICAgKiBDb250YWlucyBbW1ZSTUh1bWFub2lkXV0gb2YgdGhlIFZSTS5cbiAgICogWW91IGNhbiBjb250cm9sIGVhY2ggYm9uZXMgdXNpbmcgW1tWUk1IdW1hbm9pZC5nZXRCb25lTm9kZV1dLlxuICAgKlxuICAgKiBAVE9ETyBBZGQgYSBsaW5rIHRvIFZSTSBzcGVjXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaHVtYW5vaWQ/OiBWUk1IdW1hbm9pZDtcblxuICAvKipcbiAgICogQ29udGFpbnMgW1tWUk1CbGVuZFNoYXBlUHJveHldXSBvZiB0aGUgVlJNLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjb250cm9sIHRoZXNlIGZhY2lhbCBleHByZXNzaW9ucyB2aWEgW1tWUk1CbGVuZFNoYXBlUHJveHkuc2V0VmFsdWVdXS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBibGVuZFNoYXBlUHJveHk/OiBWUk1CbGVuZFNoYXBlUHJveHk7XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIFtbVlJNRmlyc3RQZXJzb25dXSBvZiB0aGUgVlJNLlxuICAgKiBZb3UgY2FuIHVzZSB2YXJpb3VzIGZlYXR1cmUgb2YgdGhlIGZpcnN0UGVyc29uIGZpZWxkLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZpcnN0UGVyc29uPzogVlJNRmlyc3RQZXJzb247XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIFtbVlJNTG9va0F0SGVhZF1dIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIHVzZSBbW1ZSTUxvb2tBdEhlYWQudGFyZ2V0XV0gdG8gY29udHJvbCB0aGUgZXllIGRpcmVjdGlvbiBvZiB5b3VyIFZSTXMuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbG9va0F0PzogVlJNTG9va0F0SGVhZDtcblxuICAvKipcbiAgICogQ29udGFpbnMgbWF0ZXJpYWxzIG9mIHRoZSBWUk0uXG4gICAqIGB1cGRhdGVWUk1NYXRlcmlhbHNgIG1ldGhvZCBvZiB0aGVzZSBtYXRlcmlhbHMgd2lsbCBiZSBjYWxsZWQgdmlhIGl0cyBbW1ZSTS51cGRhdGVdXSBtZXRob2QuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbWF0ZXJpYWxzPzogVEhSRUUuTWF0ZXJpYWxbXTtcblxuICAvKipcbiAgICogQ29udGFpbnMgbWV0YSBmaWVsZHMgb2YgdGhlIFZSTS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gcmVmZXIgdGhlc2UgbGljZW5zZSBmaWVsZHMgYmVmb3JlIHVzZSB5b3VyIFZSTXMuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbWV0YT86IFZSTU1ldGE7XG5cbiAgLyoqXG4gICAqIEEgW1tWUk1TcHJpbmdCb25lTWFuYWdlcl1dIG1hbmlwdWxhdGVzIGFsbCBzcHJpbmcgYm9uZXMgYXR0YWNoZWQgb24gdGhlIFZSTS5cbiAgICogVXN1YWxseSB5b3UgZG9uJ3QgaGF2ZSB0byBjYXJlIGFib3V0IHRoaXMgcHJvcGVydHkuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgc3ByaW5nQm9uZU1hbmFnZXI/OiBWUk1TcHJpbmdCb25lTWFuYWdlcjtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTSBpbnN0YW5jZS5cbiAgICpcbiAgICogQHBhcmFtIHBhcmFtcyBbW1ZSTVBhcmFtZXRlcnNdXSB0aGF0IHJlcHJlc2VudHMgY29tcG9uZW50cyBvZiB0aGUgVlJNXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IocGFyYW1zOiBWUk1QYXJhbWV0ZXJzKSB7XG4gICAgdGhpcy5zY2VuZSA9IHBhcmFtcy5zY2VuZTtcbiAgICB0aGlzLmh1bWFub2lkID0gcGFyYW1zLmh1bWFub2lkO1xuICAgIHRoaXMuYmxlbmRTaGFwZVByb3h5ID0gcGFyYW1zLmJsZW5kU2hhcGVQcm94eTtcbiAgICB0aGlzLmZpcnN0UGVyc29uID0gcGFyYW1zLmZpcnN0UGVyc29uO1xuICAgIHRoaXMubG9va0F0ID0gcGFyYW1zLmxvb2tBdDtcbiAgICB0aGlzLm1hdGVyaWFscyA9IHBhcmFtcy5tYXRlcmlhbHM7XG4gICAgdGhpcy5zcHJpbmdCb25lTWFuYWdlciA9IHBhcmFtcy5zcHJpbmdCb25lTWFuYWdlcjtcbiAgICB0aGlzLm1ldGEgPSBwYXJhbXMubWV0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiAqKllvdSBuZWVkIHRvIGNhbGwgdGhpcyBvbiB5b3VyIHVwZGF0ZSBsb29wLioqXG4gICAqXG4gICAqIFRoaXMgZnVuY3Rpb24gdXBkYXRlcyBldmVyeSBWUk0gY29tcG9uZW50cy5cbiAgICpcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxuICAgKi9cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubG9va0F0KSB7XG4gICAgICB0aGlzLmxvb2tBdC51cGRhdGUoZGVsdGEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLmJsZW5kU2hhcGVQcm94eSkge1xuICAgICAgdGhpcy5ibGVuZFNoYXBlUHJveHkudXBkYXRlKCk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc3ByaW5nQm9uZU1hbmFnZXIpIHtcbiAgICAgIHRoaXMuc3ByaW5nQm9uZU1hbmFnZXIubGF0ZVVwZGF0ZShkZWx0YSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMubWF0ZXJpYWxzKSB7XG4gICAgICB0aGlzLm1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbDogYW55KSA9PiB7XG4gICAgICAgIGlmIChtYXRlcmlhbC51cGRhdGVWUk1NYXRlcmlhbHMpIHtcbiAgICAgICAgICBtYXRlcmlhbC51cGRhdGVWUk1NYXRlcmlhbHMoZGVsdGEpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGlzcG9zZSBldmVyeXRoaW5nIGFib3V0IHRoZSBWUk0gaW5zdGFuY2UuXG4gICAqL1xuICBwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcbiAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG4gICAgaWYgKHNjZW5lKSB7XG4gICAgICBkZWVwRGlzcG9zZShzY2VuZSk7XG4gICAgfVxuXG4gICAgdGhpcy5tZXRhPy50ZXh0dXJlPy5kaXNwb3NlKCk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTSB9IGZyb20gJy4uL1ZSTSc7XG5cbmNvbnN0IF92MkEgPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuXG5jb25zdCBfY2FtZXJhID0gbmV3IFRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSgtMSwgMSwgLTEsIDEsIC0xLCAxKTtcbmNvbnN0IF9tYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7IGNvbG9yOiAweGZmZmZmZiwgc2lkZTogVEhSRUUuRG91YmxlU2lkZSB9KTtcbmNvbnN0IF9wbGFuZSA9IG5ldyBUSFJFRS5NZXNoKG5ldyBUSFJFRS5QbGFuZUJ1ZmZlckdlb21ldHJ5KDIsIDIpLCBfbWF0ZXJpYWwpO1xuY29uc3QgX3NjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5fc2NlbmUuYWRkKF9wbGFuZSk7XG5cbi8qKlxuICogRXh0cmFjdCBhIHRodW1ibmFpbCBpbWFnZSBibG9iIGZyb20gYSB7QGxpbmsgVlJNfS5cbiAqIElmIHRoZSB2cm0gZG9lcyBub3QgaGF2ZSBhIHRodW1ibmFpbCwgaXQgd2lsbCB0aHJvdyBhbiBlcnJvci5cbiAqIEBwYXJhbSByZW5kZXJlciBSZW5kZXJlclxuICogQHBhcmFtIHZybSBWUk0gd2l0aCBhIHRodW1ibmFpbFxuICogQHBhcmFtIHNpemUgd2lkdGggLyBoZWlnaHQgb2YgdGhlIGltYWdlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0VGh1bWJuYWlsQmxvYihyZW5kZXJlcjogVEhSRUUuV2ViR0xSZW5kZXJlciwgdnJtOiBWUk0sIHNpemUgPSA1MTIpOiBQcm9taXNlPEJsb2I+IHtcbiAgLy8gZ2V0IHRoZSB0ZXh0dXJlXG4gIGNvbnN0IHRleHR1cmUgPSB2cm0ubWV0YT8udGV4dHVyZTtcbiAgaWYgKCF0ZXh0dXJlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdleHRyYWN0VGh1bWJuYWlsQmxvYjogVGhpcyBWUk0gZG9lcyBub3QgaGF2ZSBhIHRodW1ibmFpbCcpO1xuICB9XG5cbiAgY29uc3QgY2FudmFzID0gcmVuZGVyZXIuZ2V0Q29udGV4dCgpLmNhbnZhcztcblxuICAvLyBzdG9yZSB0aGUgY3VycmVudCByZXNvbHV0aW9uXG4gIHJlbmRlcmVyLmdldFNpemUoX3YyQSk7XG4gIGNvbnN0IHByZXZXaWR0aCA9IF92MkEueDtcbiAgY29uc3QgcHJldkhlaWdodCA9IF92MkEueTtcblxuICAvLyBvdmVyd3JpdGUgdGhlIHJlc29sdXRpb25cbiAgcmVuZGVyZXIuc2V0U2l6ZShzaXplLCBzaXplLCBmYWxzZSk7XG5cbiAgLy8gYXNzaWduIHRoZSB0ZXh0dXJlIHRvIHBsYW5lXG4gIF9tYXRlcmlhbC5tYXAgPSB0ZXh0dXJlO1xuXG4gIC8vIHJlbmRlclxuICByZW5kZXJlci5yZW5kZXIoX3NjZW5lLCBfY2FtZXJhKTtcblxuICAvLyB1bmFzc2lnbiB0aGUgdGV4dHVyZVxuICBfbWF0ZXJpYWwubWFwID0gbnVsbDtcblxuICAvLyBnZXQgYmxvYlxuICBpZiAoY2FudmFzIGluc3RhbmNlb2YgT2Zmc2NyZWVuQ2FudmFzKSB7XG4gICAgcmV0dXJuIGNhbnZhcy5jb252ZXJ0VG9CbG9iKCkuZmluYWxseSgoKSA9PiB7XG4gICAgICAvLyByZXZlcnQgdG8gcHJldmlvdXMgcmVzb2x1dGlvblxuICAgICAgcmVuZGVyZXIuc2V0U2l6ZShwcmV2V2lkdGgsIHByZXZIZWlnaHQsIGZhbHNlKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY2FudmFzLnRvQmxvYigoYmxvYikgPT4ge1xuICAgICAgLy8gcmV2ZXJ0IHRvIHByZXZpb3VzIHJlc29sdXRpb25cbiAgICAgIHJlbmRlcmVyLnNldFNpemUocHJldldpZHRoLCBwcmV2SGVpZ2h0LCBmYWxzZSk7XG5cbiAgICAgIGlmIChibG9iID09IG51bGwpIHtcbiAgICAgICAgcmVqZWN0KCdleHRyYWN0VGh1bWJuYWlsQmxvYjogRmFpbGVkIHRvIGNyZWF0ZSBhIGJsb2InKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc29sdmUoYmxvYik7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG4vKipcbiAqIFRyYXZlcnNlIGdpdmVuIG9iamVjdCBhbmQgcmVtb3ZlIHVubmVjZXNzYXJpbHkgYm91bmQgam9pbnRzIGZyb20gZXZlcnkgYFRIUkVFLlNraW5uZWRNZXNoYC5cbiAqIFNvbWUgZW52aXJvbm1lbnRzIGxpa2UgbW9iaWxlIGRldmljZXMgaGF2ZSBhIGxvd2VyIGxpbWl0IG9mIGJvbmVzIGFuZCBtaWdodCBiZSB1bmFibGUgdG8gcGVyZm9ybSBtZXNoIHNraW5uaW5nLCB0aGlzIGZ1bmN0aW9uIG1pZ2h0IHJlc29sdmUgc3VjaCBhbiBpc3N1ZS5cbiAqIEFsc28gdGhpcyBmdW5jdGlvbiBtaWdodCBncmVhdGx5IGltcHJvdmUgdGhlIHBlcmZvcm1hbmNlIG9mIG1lc2ggc2tpbm5pbmcuXG4gKlxuICogQHBhcmFtIHJvb3QgUm9vdCBvYmplY3QgdGhhdCB3aWxsIGJlIHRyYXZlcnNlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMocm9vdDogVEhSRUUuT2JqZWN0M0QpOiB2b2lkIHtcbiAgLy8gc29tZSBtZXNoZXMgbWlnaHQgc2hhcmUgYSBzYW1lIHNraW5JbmRleCBhdHRyaWJ1dGUgYW5kIHRoaXMgbWFwIHByZXZlbnRzIHRvIGNvbnZlcnQgdGhlIGF0dHJpYnV0ZSB0d2ljZVxuICBjb25zdCBza2VsZXRvbkxpc3Q6IE1hcDxUSFJFRS5CdWZmZXJBdHRyaWJ1dGUsIFRIUkVFLlNrZWxldG9uPiA9IG5ldyBNYXAoKTtcblxuICAvLyBUcmF2ZXJzZSBhbiBlbnRpcmUgdHJlZVxuICByb290LnRyYXZlcnNlKChvYmopID0+IHtcbiAgICBpZiAob2JqLnR5cGUgIT09ICdTa2lubmVkTWVzaCcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNoID0gb2JqIGFzIFRIUkVFLlNraW5uZWRNZXNoO1xuICAgIGNvbnN0IGdlb21ldHJ5ID0gbWVzaC5nZW9tZXRyeTtcbiAgICBjb25zdCBhdHRyaWJ1dGUgPSBnZW9tZXRyeS5nZXRBdHRyaWJ1dGUoJ3NraW5JbmRleCcpIGFzIFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcblxuICAgIC8vIGxvb2sgZm9yIGV4aXN0aW5nIHNrZWxldG9uXG4gICAgbGV0IHNrZWxldG9uID0gc2tlbGV0b25MaXN0LmdldChhdHRyaWJ1dGUpO1xuXG4gICAgaWYgKCFza2VsZXRvbikge1xuICAgICAgLy8gZ2VuZXJhdGUgcmVkdWNlZCBib25lIGxpc3RcbiAgICAgIGNvbnN0IGJvbmVzOiBUSFJFRS5Cb25lW10gPSBbXTsgLy8gbmV3IGxpc3Qgb2YgYm9uZVxuICAgICAgY29uc3QgYm9uZUludmVyc2VzOiBUSFJFRS5NYXRyaXg0W10gPSBbXTsgLy8gbmV3IGxpc3Qgb2YgYm9uZUludmVyc2VcbiAgICAgIGNvbnN0IGJvbmVJbmRleE1hcDogeyBbaW5kZXg6IG51bWJlcl06IG51bWJlciB9ID0ge307IC8vIG1hcCBvZiBvbGQgYm9uZSBpbmRleCB2cy4gbmV3IGJvbmUgaW5kZXhcblxuICAgICAgLy8gY3JlYXRlIGEgbmV3IGJvbmUgbWFwXG4gICAgICBjb25zdCBhcnJheSA9IGF0dHJpYnV0ZS5hcnJheSBhcyBudW1iZXJbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBhcnJheVtpXTtcblxuICAgICAgICAvLyBuZXcgc2tpbkluZGV4IGJ1ZmZlclxuICAgICAgICBpZiAoYm9uZUluZGV4TWFwW2luZGV4XSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgYm9uZUluZGV4TWFwW2luZGV4XSA9IGJvbmVzLmxlbmd0aDtcbiAgICAgICAgICBib25lcy5wdXNoKG1lc2guc2tlbGV0b24uYm9uZXNbaW5kZXhdKTtcbiAgICAgICAgICBib25lSW52ZXJzZXMucHVzaChtZXNoLnNrZWxldG9uLmJvbmVJbnZlcnNlc1tpbmRleF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgYXJyYXlbaV0gPSBib25lSW5kZXhNYXBbaW5kZXhdO1xuICAgICAgfVxuXG4gICAgICAvLyByZXBsYWNlIHdpdGggbmV3IGluZGljZXNcbiAgICAgIGF0dHJpYnV0ZS5jb3B5QXJyYXkoYXJyYXkpO1xuICAgICAgYXR0cmlidXRlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcblxuICAgICAgLy8gcmVwbGFjZSB3aXRoIG5ldyBpbmRpY2VzXG4gICAgICBza2VsZXRvbiA9IG5ldyBUSFJFRS5Ta2VsZXRvbihib25lcywgYm9uZUludmVyc2VzKTtcbiAgICAgIHNrZWxldG9uTGlzdC5zZXQoYXR0cmlidXRlLCBza2VsZXRvbik7XG4gICAgfVxuXG4gICAgbWVzaC5iaW5kKHNrZWxldG9uLCBuZXcgVEhSRUUuTWF0cml4NCgpKTtcbiAgICAvLyAgICAgICAgICAgICAgICAgIF5eXl5eXl5eXl5eXl5eXl5eXl4gdHJhbnNmb3JtIG9mIG1lc2hlcyBzaG91bGQgYmUgaWdub3JlZFxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL0tocm9ub3NHcm91cC9nbFRGL3RyZWUvbWFzdGVyL3NwZWNpZmljYXRpb24vMi4wI3NraW5zXG4gIH0pO1xufVxuIiwiaW1wb3J0IHsgZXh0cmFjdFRodW1ibmFpbEJsb2IgfSBmcm9tICcuL2V4dHJhY3RUaHVtYm5haWxCbG9iJztcbmltcG9ydCB7IHJlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzIH0gZnJvbSAnLi9yZW1vdmVVbm5lY2Vzc2FyeUpvaW50cyc7XG5cbmV4cG9ydCBjbGFzcyBWUk1VdGlscyB7XG4gIHByaXZhdGUgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gdGhpcyBjbGFzcyBpcyBub3QgbWVhbnQgdG8gYmUgaW5zdGFudGlhdGVkXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGV4dHJhY3RUaHVtYm5haWxCbG9iID0gZXh0cmFjdFRodW1ibmFpbEJsb2I7XG4gIHB1YmxpYyBzdGF0aWMgcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMgPSByZW1vdmVVbm5lY2Vzc2FyeUpvaW50cztcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuLi9sb29rYXQvVlJNTG9va0F0SGVhZCc7XG5pbXBvcnQgeyBWUk1EZWJ1Z09wdGlvbnMgfSBmcm9tICcuL1ZSTURlYnVnT3B0aW9ucyc7XG5cbmNvbnN0IF92MyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRIZWFkRGVidWcgZXh0ZW5kcyBWUk1Mb29rQXRIZWFkIHtcbiAgcHJpdmF0ZSBfZmFjZURpcmVjdGlvbkhlbHBlcj86IFRIUkVFLkFycm93SGVscGVyO1xuXG4gIHB1YmxpYyBzZXR1cEhlbHBlcihzY2VuZTogVEhSRUUuT2JqZWN0M0QsIGRlYnVnT3B0aW9uOiBWUk1EZWJ1Z09wdGlvbnMpOiB2b2lkIHtcbiAgICBpZiAoIWRlYnVnT3B0aW9uLmRpc2FibGVGYWNlRGlyZWN0aW9uSGVscGVyKSB7XG4gICAgICB0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyID0gbmV3IFRIUkVFLkFycm93SGVscGVyKFxuICAgICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAtMSksXG4gICAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDApLFxuICAgICAgICAwLjUsXG4gICAgICAgIDB4ZmYwMGZmLFxuICAgICAgKTtcbiAgICAgIHNjZW5lLmFkZCh0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBzdXBlci51cGRhdGUoZGVsdGEpO1xuXG4gICAgaWYgKHRoaXMuX2ZhY2VEaXJlY3Rpb25IZWxwZXIpIHtcbiAgICAgIHRoaXMuZmlyc3RQZXJzb24uZ2V0Rmlyc3RQZXJzb25Xb3JsZFBvc2l0aW9uKHRoaXMuX2ZhY2VEaXJlY3Rpb25IZWxwZXIucG9zaXRpb24pO1xuICAgICAgdGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlci5zZXREaXJlY3Rpb24odGhpcy5nZXRMb29rQXRXb3JsZERpcmVjdGlvbihfdjMpKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4uL2JsZW5kc2hhcGUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbic7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuLi9sb29rYXQvVlJNTG9va0F0SGVhZCc7XG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlciB9IGZyb20gJy4uL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkRGVidWcgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWREZWJ1Zyc7XG5cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRJbXBvcnRlckRlYnVnIGV4dGVuZHMgVlJNTG9va0F0SW1wb3J0ZXIge1xuICBwdWJsaWMgaW1wb3J0KFxuICAgIGdsdGY6IEdMVEYsXG4gICAgZmlyc3RQZXJzb246IFZSTUZpcnN0UGVyc29uLFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgKTogVlJNTG9va0F0SGVhZCB8IG51bGwge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGFwcGx5ZXIgPSB0aGlzLl9pbXBvcnRBcHBseWVyKHNjaGVtYUZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKTtcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdEhlYWREZWJ1ZyhmaXJzdFBlcnNvbiwgYXBwbHllciB8fCB1bmRlZmluZWQpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lTWFuYWdlciB9IGZyb20gJy4uL3NwcmluZ2JvbmUnO1xuaW1wb3J0IHsgVlJNRGVidWdPcHRpb25zIH0gZnJvbSAnLi9WUk1EZWJ1Z09wdGlvbnMnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZURlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lRGVidWcnO1xuaW1wb3J0IHsgVlJNX0dJWk1PX1JFTkRFUl9PUkRFUiB9IGZyb20gJy4vVlJNRGVidWcnO1xuXG5jb25zdCBfY29sbGlkZXJHaXptb01hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcbiAgY29sb3I6IDB4ZmYwMGZmLFxuICB3aXJlZnJhbWU6IHRydWUsXG4gIHRyYW5zcGFyZW50OiB0cnVlLFxuICBkZXB0aFRlc3Q6IGZhbHNlLFxufSk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBzcHJpbmcgYm9uZSBncm91cCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IHR5cGUgVlJNU3ByaW5nQm9uZUdyb3VwRGVidWcgPSBWUk1TcHJpbmdCb25lRGVidWdbXTtcblxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcgZXh0ZW5kcyBWUk1TcHJpbmdCb25lTWFuYWdlciB7XG4gIHB1YmxpYyBzZXR1cEhlbHBlcihzY2VuZTogVEhSRUUuT2JqZWN0M0QsIGRlYnVnT3B0aW9uOiBWUk1EZWJ1Z09wdGlvbnMpOiB2b2lkIHtcbiAgICBpZiAoZGVidWdPcHRpb24uZGlzYWJsZVNwcmluZ0JvbmVIZWxwZXIpIHJldHVybjtcblxuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcbiAgICAgIHNwcmluZ0JvbmVHcm91cC5mb3JFYWNoKChzcHJpbmdCb25lKSA9PiB7XG4gICAgICAgIGlmICgoc3ByaW5nQm9uZSBhcyBhbnkpLmdldEdpem1vKSB7XG4gICAgICAgICAgY29uc3QgZ2l6bW8gPSAoc3ByaW5nQm9uZSBhcyBWUk1TcHJpbmdCb25lRGVidWcpLmdldEdpem1vKCk7XG4gICAgICAgICAgc2NlbmUuYWRkKGdpem1vKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbGxpZGVyR3JvdXBzLmZvckVhY2goKGNvbGxpZGVyR3JvdXApID0+IHtcbiAgICAgIGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XG4gICAgICAgIGNvbGxpZGVyLm1hdGVyaWFsID0gX2NvbGxpZGVyR2l6bW9NYXRlcmlhbDtcbiAgICAgICAgY29sbGlkZXIucmVuZGVyT3JkZXIgPSBWUk1fR0laTU9fUkVOREVSX09SREVSO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmUgfSBmcm9tICcuLi9zcHJpbmdib25lJztcbmltcG9ydCB7IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgfSBmcm9tICcuL1ZSTURlYnVnJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lUGFyYW1ldGVycyc7XG5cbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZURlYnVnIGV4dGVuZHMgVlJNU3ByaW5nQm9uZSB7XG4gIHByaXZhdGUgX2dpem1vPzogVEhSRUUuQXJyb3dIZWxwZXI7XG5cbiAgY29uc3RydWN0b3IoYm9uZTogVEhSRUUuT2JqZWN0M0QsIHBhcmFtczogVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMpIHtcbiAgICBzdXBlcihib25lLCBwYXJhbXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzcHJpbmcgYm9uZSBnaXptbywgYXMgYFRIUkVFLkFycm93SGVscGVyYC5cbiAgICogVXNlZnVsIGZvciBkZWJ1Z2dpbmcgc3ByaW5nIGJvbmVzLlxuICAgKi9cbiAgcHVibGljIGdldEdpem1vKCk6IFRIUkVFLkFycm93SGVscGVyIHtcbiAgICAvLyByZXR1cm4gaWYgZ2l6bW8gaXMgYWxyZWFkeSBleGlzdGVkXG4gICAgaWYgKHRoaXMuX2dpem1vKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2l6bW87XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZSA9IF92M0EuY29weSh0aGlzLl9uZXh0VGFpbCkuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pO1xuICAgIGNvbnN0IG5leHRUYWlsUmVsYXRpdmVMZW5ndGggPSBuZXh0VGFpbFJlbGF0aXZlLmxlbmd0aCgpO1xuXG4gICAgdGhpcy5fZ2l6bW8gPSBuZXcgVEhSRUUuQXJyb3dIZWxwZXIoXG4gICAgICBuZXh0VGFpbFJlbGF0aXZlLm5vcm1hbGl6ZSgpLFxuICAgICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbixcbiAgICAgIG5leHRUYWlsUmVsYXRpdmVMZW5ndGgsXG4gICAgICAweGZmZmYwMCxcbiAgICAgIHRoaXMucmFkaXVzLFxuICAgICAgdGhpcy5yYWRpdXMsXG4gICAgKTtcblxuICAgIC8vIGl0IHNob3VsZCBiZSBhbHdheXMgdmlzaWJsZVxuICAgIHRoaXMuX2dpem1vLmxpbmUucmVuZGVyT3JkZXIgPSBWUk1fR0laTU9fUkVOREVSX09SREVSO1xuICAgIHRoaXMuX2dpem1vLmNvbmUucmVuZGVyT3JkZXIgPSBWUk1fR0laTU9fUkVOREVSX09SREVSO1xuICAgICh0aGlzLl9naXptby5saW5lLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAodGhpcy5fZ2l6bW8ubGluZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkudHJhbnNwYXJlbnQgPSB0cnVlO1xuICAgICh0aGlzLl9naXptby5jb25lLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAodGhpcy5fZ2l6bW8uY29uZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkudHJhbnNwYXJlbnQgPSB0cnVlO1xuXG4gICAgcmV0dXJuIHRoaXMuX2dpem1vO1xuICB9XG5cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcbiAgICAvLyBsYXN0bHkgd2UncmUgZ29ubmEgdXBkYXRlIGdpem1vXG4gICAgdGhpcy5fdXBkYXRlR2l6bW8oKTtcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZUdpem1vKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5fZ2l6bW8pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBuZXh0VGFpbFJlbGF0aXZlID0gX3YzQS5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKS5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbik7XG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZUxlbmd0aCA9IG5leHRUYWlsUmVsYXRpdmUubGVuZ3RoKCk7XG5cbiAgICB0aGlzLl9naXptby5zZXREaXJlY3Rpb24obmV4dFRhaWxSZWxhdGl2ZS5ub3JtYWxpemUoKSk7XG4gICAgdGhpcy5fZ2l6bW8uc2V0TGVuZ3RoKG5leHRUYWlsUmVsYXRpdmVMZW5ndGgsIHRoaXMucmFkaXVzLCB0aGlzLnJhZGl1cyk7XG4gICAgdGhpcy5fZ2l6bW8ucG9zaXRpb24uY29weSh0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUltcG9ydGVyIH0gZnJvbSAnLi4vc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lSW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lRGVidWcgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4uL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcgZXh0ZW5kcyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIge1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcgfCBudWxsPiB7XG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XG4gICAgaWYgKCF2cm1FeHQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uIHwgdW5kZWZpbmVkID0gdnJtRXh0LnNlY29uZGFyeUFuaW1hdGlvbjtcbiAgICBpZiAoIXNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbikgcmV0dXJuIG51bGw7XG5cbiAgICAvLyDooZ3nqoHliKTlrprnkIPkvZPjg6Hjg4Pjgrfjg6XjgIJcbiAgICBjb25zdCBjb2xsaWRlckdyb3VwcyA9IGF3YWl0IHRoaXMuX2ltcG9ydENvbGxpZGVyTWVzaEdyb3VwcyhnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24pO1xuXG4gICAgLy8g5ZCM44GY5bGe5oCn77yIc3RpZmZpbmVzc+OChGRyYWdGb3JjZeOBjOWQjOOBmO+8ieOBruODnOODvOODs+OBr2JvbmVHcm91cOOBq+OBvuOBqOOCgeOCieOCjOOBpuOBhOOCi+OAglxuICAgIC8vIOS4gOWIl+OBoOOBkeOBp+OBr+OBquOBhOOBk+OBqOOBq+azqOaEj+OAglxuICAgIGNvbnN0IHNwcmluZ0JvbmVHcm91cExpc3QgPSBhd2FpdCB0aGlzLl9pbXBvcnRTcHJpbmdCb25lR3JvdXBMaXN0KGdsdGYsIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbiwgY29sbGlkZXJHcm91cHMpO1xuXG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnKGNvbGxpZGVyR3JvdXBzLCBzcHJpbmdCb25lR3JvdXBMaXN0KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfY3JlYXRlU3ByaW5nQm9uZShib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyk6IFZSTVNwcmluZ0JvbmVEZWJ1ZyB7XG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lRGVidWcoYm9uZSwgcGFyYW1zKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xuaW1wb3J0IHsgVlJNSW1wb3J0ZXIsIFZSTUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4uL1ZSTUltcG9ydGVyJztcbmltcG9ydCB7IFZSTURlYnVnIH0gZnJvbSAnLi9WUk1EZWJ1Zyc7XG5pbXBvcnQgeyBWUk1EZWJ1Z09wdGlvbnMgfSBmcm9tICcuL1ZSTURlYnVnT3B0aW9ucyc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkRGVidWcgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWREZWJ1Zyc7XG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlckRlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRJbXBvcnRlckRlYnVnJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVJbXBvcnRlckRlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnJztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTURlYnVnXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSW1wb3J0ZXJEZWJ1ZyBleHRlbmRzIFZSTUltcG9ydGVyIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFZSTUltcG9ydGVyT3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5sb29rQXRJbXBvcnRlciA9IG9wdGlvbnMubG9va0F0SW1wb3J0ZXIgfHwgbmV3IFZSTUxvb2tBdEltcG9ydGVyRGVidWcoKTtcbiAgICBvcHRpb25zLnNwcmluZ0JvbmVJbXBvcnRlciA9IG9wdGlvbnMuc3ByaW5nQm9uZUltcG9ydGVyIHx8IG5ldyBWUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1ZygpO1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGLCBkZWJ1Z09wdGlvbnM6IFZSTURlYnVnT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxWUk1EZWJ1Zz4ge1xuICAgIGlmIChnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMgPT09IHVuZGVmaW5lZCB8fCBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMuVlJNID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgVlJNIGV4dGVuc2lvbiBvbiB0aGUgR0xURicpO1xuICAgIH1cbiAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmU7XG5cbiAgICBzY2VuZS51cGRhdGVNYXRyaXhXb3JsZChmYWxzZSk7XG5cbiAgICAvLyBTa2lubmVkIG9iamVjdCBzaG91bGQgbm90IGJlIGZydXN0dW1DdWxsZWRcbiAgICAvLyBTaW5jZSBwcmUtc2tpbm5lZCBwb3NpdGlvbiBtaWdodCBiZSBvdXRzaWRlIG9mIHZpZXdcbiAgICBzY2VuZS50cmF2ZXJzZSgob2JqZWN0M2QpID0+IHtcbiAgICAgIGlmICgob2JqZWN0M2QgYXMgYW55KS5pc01lc2gpIHtcbiAgICAgICAgb2JqZWN0M2QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgbWV0YSA9IChhd2FpdCB0aGlzLl9tZXRhSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBtYXRlcmlhbHMgPSAoYXdhaXQgdGhpcy5fbWF0ZXJpYWxJbXBvcnRlci5jb252ZXJ0R0xURk1hdGVyaWFscyhnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgaHVtYW5vaWQgPSAoYXdhaXQgdGhpcy5faHVtYW5vaWRJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGZpcnN0UGVyc29uID0gaHVtYW5vaWQgPyAoYXdhaXQgdGhpcy5fZmlyc3RQZXJzb25JbXBvcnRlci5pbXBvcnQoZ2x0ZiwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBibGVuZFNoYXBlUHJveHkgPSAoYXdhaXQgdGhpcy5fYmxlbmRTaGFwZUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgbG9va0F0ID1cbiAgICAgIGZpcnN0UGVyc29uICYmIGJsZW5kU2hhcGVQcm94eSAmJiBodW1hbm9pZFxuICAgICAgICA/IChhd2FpdCB0aGlzLl9sb29rQXRJbXBvcnRlci5pbXBvcnQoZ2x0ZiwgZmlyc3RQZXJzb24sIGJsZW5kU2hhcGVQcm94eSwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWRcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgaWYgKChsb29rQXQgYXMgYW55KS5zZXR1cEhlbHBlcikge1xuICAgICAgKGxvb2tBdCBhcyBWUk1Mb29rQXRIZWFkRGVidWcpLnNldHVwSGVscGVyKHNjZW5lLCBkZWJ1Z09wdGlvbnMpO1xuICAgIH1cblxuICAgIGNvbnN0IHNwcmluZ0JvbmVNYW5hZ2VyID0gKGF3YWl0IHRoaXMuX3NwcmluZ0JvbmVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcbiAgICBpZiAoKHNwcmluZ0JvbmVNYW5hZ2VyIGFzIGFueSkuc2V0dXBIZWxwZXIpIHtcbiAgICAgIChzcHJpbmdCb25lTWFuYWdlciBhcyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnKS5zZXR1cEhlbHBlcihzY2VuZSwgZGVidWdPcHRpb25zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFZSTURlYnVnKFxuICAgICAge1xuICAgICAgICBzY2VuZTogZ2x0Zi5zY2VuZSxcbiAgICAgICAgbWV0YSxcbiAgICAgICAgbWF0ZXJpYWxzLFxuICAgICAgICBodW1hbm9pZCxcbiAgICAgICAgZmlyc3RQZXJzb24sXG4gICAgICAgIGJsZW5kU2hhcGVQcm94eSxcbiAgICAgICAgbG9va0F0LFxuICAgICAgICBzcHJpbmdCb25lTWFuYWdlcixcbiAgICAgIH0sXG4gICAgICBkZWJ1Z09wdGlvbnMsXG4gICAgKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXInO1xuaW1wb3J0IHsgVlJNLCBWUk1QYXJhbWV0ZXJzIH0gZnJvbSAnLi4vVlJNJztcbmltcG9ydCB7IFZSTUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4uL1ZSTUltcG9ydGVyJztcbmltcG9ydCB7IFZSTURlYnVnT3B0aW9ucyB9IGZyb20gJy4vVlJNRGVidWdPcHRpb25zJztcbmltcG9ydCB7IFZSTUltcG9ydGVyRGVidWcgfSBmcm9tICcuL1ZSTUltcG9ydGVyRGVidWcnO1xuXG5leHBvcnQgY29uc3QgVlJNX0dJWk1PX1JFTkRFUl9PUkRFUiA9IDEwMDAwO1xuXG4vKipcbiAqIFtbVlJNXV0gYnV0IGl0IGhhcyBzb21lIHVzZWZ1bCBnaXptb3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1EZWJ1ZyBleHRlbmRzIFZSTSB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNRGVidWcgZnJvbSBhIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXIuXG4gICAqXG4gICAqIFNlZSBbW1ZSTS5mcm9tXV0gZm9yIGEgZGV0YWlsZWQgZXhhbXBsZS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgR0xURiBvYmplY3QgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbnMgdGhhdCB3aWxsIGJlIHVzZWQgaW4gaW1wb3J0ZXJcbiAgICogQHBhcmFtIGRlYnVnT3B0aW9uIE9wdGlvbnMgZm9yIFZSTURlYnVnIGZlYXR1cmVzXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGZyb20oXG4gICAgZ2x0ZjogR0xURixcbiAgICBvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSxcbiAgICBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8VlJNPiB7XG4gICAgY29uc3QgaW1wb3J0ZXIgPSBuZXcgVlJNSW1wb3J0ZXJEZWJ1ZyhvcHRpb25zKTtcbiAgICByZXR1cm4gYXdhaXQgaW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGRlYnVnT3B0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNRGVidWcgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSBwYXJhbXMgW1tWUk1QYXJhbWV0ZXJzXV0gdGhhdCByZXByZXNlbnRzIGNvbXBvbmVudHMgb2YgdGhlIFZSTVxuICAgKiBAcGFyYW0gZGVidWdPcHRpb24gT3B0aW9ucyBmb3IgVlJNRGVidWcgZmVhdHVyZXNcbiAgICovXG4gIGNvbnN0cnVjdG9yKHBhcmFtczogVlJNUGFyYW1ldGVycywgZGVidWdPcHRpb246IFZSTURlYnVnT3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIocGFyYW1zKTtcblxuICAgIC8vIEdpem1v44KS5bGV6ZaLXG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlQm94SGVscGVyKSB7XG4gICAgICB0aGlzLnNjZW5lLmFkZChuZXcgVEhSRUUuQm94SGVscGVyKHRoaXMuc2NlbmUpKTtcbiAgICB9XG5cbiAgICBpZiAoIWRlYnVnT3B0aW9uLmRpc2FibGVTa2VsZXRvbkhlbHBlcikge1xuICAgICAgdGhpcy5zY2VuZS5hZGQobmV3IFRIUkVFLlNrZWxldG9uSGVscGVyKHRoaXMuc2NlbmUpKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBzdXBlci51cGRhdGUoZGVsdGEpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiVEhSRUUuVmVjdG9yMiIsIlRIUkVFLlZlY3RvcjMiLCJUSFJFRS5WZWN0b3I0IiwiVEhSRUUuQ29sb3IiLCJUSFJFRS5PYmplY3QzRCIsIlZSTVNjaGVtYSIsIlRIUkVFLlF1YXRlcm5pb24iLCJUSFJFRS5Ta2lubmVkTWVzaCIsIlRIUkVFLlNrZWxldG9uIiwiVEhSRUUuTWF0cml4NCIsIlZFQ1RPUjNfRlJPTlQiLCJfdjNBIiwiX3F1YXQiLCJUSFJFRS5FdWxlciIsIlRIUkVFLkxpbmVhckVuY29kaW5nIiwiVEhSRUUuc1JHQkVuY29kaW5nIiwiVEhSRUUuUkdCRUVuY29kaW5nIiwiVEhSRUUuUkdCTTdFbmNvZGluZyIsIlRIUkVFLlJHQk0xNkVuY29kaW5nIiwiVEhSRUUuUkdCREVuY29kaW5nIiwiVEhSRUUuR2FtbWFFbmNvZGluZyIsIk1Ub29uTWF0ZXJpYWxDdWxsTW9kZSIsIk1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUiLCJNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSIsIk1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIiwiTVRvb25NYXRlcmlhbFJlbmRlck1vZGUiLCJUSFJFRS5TaGFkZXJNYXRlcmlhbCIsIlRIUkVFLlRhbmdlbnRTcGFjZU5vcm1hbE1hcCIsIlRIUkVFLlVuaWZvcm1zVXRpbHMiLCJUSFJFRS5Vbmlmb3Jtc0xpYiIsIlRIUkVFLlJFVklTSU9OIiwiVEhSRUUuRG91YmxlU2lkZSIsIlRIUkVFLkJhY2tTaWRlIiwiVEhSRUUuRnJvbnRTaWRlIiwiVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUiLCJ2ZXJ0ZXhTaGFkZXIiLCJmcmFnbWVudFNoYWRlciIsIl92M0IiLCJfdjNDIiwiX3F1YXRBIiwiX21hdEEiLCJUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCIsIlRIUkVFLk1lc2giLCJUSFJFRS5TcGhlcmVCdWZmZXJHZW9tZXRyeSIsIlRIUkVFLk9ydGhvZ3JhcGhpY0NhbWVyYSIsIlRIUkVFLlBsYW5lQnVmZmVyR2VvbWV0cnkiLCJUSFJFRS5TY2VuZSIsIl92MyIsIlRIUkVFLkFycm93SGVscGVyIiwiVEhSRUUuQm94SGVs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Q0FBQztvQkFDbkIsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUUzQixJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQUUsU0FBUztvQkFDdkQsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUFFLFNBQVM7b0JBQ3ZELElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxTQUFTO29CQUN2RCxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQUUsU0FBUztvQkFFdkQsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNuQixNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNCLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxTQUFTO29CQUN2RCxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQUUsU0FBUztvQkFDdkQsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUFFLFNBQVM7b0JBQ3ZELElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxH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
