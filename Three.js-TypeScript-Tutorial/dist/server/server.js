"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const port = 3000;
class App {
    constructor(port) {
        this.port = port;
        const app = express_1.default();
        // we define static path and module used as middleware
        app.use(express_1.default.static(path_1.default.join(__dirname, "../client")));
        app.use("/build/three.module.js", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/build/three.module.js")));
        app.use("/jsm/libs/dat.gui.module", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/libs/dat.gui.module.js")));
        app.use("/jsm/controls/TransformControls", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/controls/TransformControls.js")));
        app.use("/jsm/controls/OrbitControls", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/controls/OrbitControls.js")));
        app.use("/jsm/controls/TrackballControls", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/controls/TrackballControls.js")));
        app.use("/jsm/controls/PointerLockControls", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/controls/PointerLockControls.js")));
        app.use("/jsm/controls/DragControls", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/controls/DragControls.js")));
        app.use("/js/libs/draco/", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/js/libs/draco")));
        app.use("/jsm/loaders/DRACOLoader", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/loaders/DRACOLoader.js")));
        app.use("/jsm/loaders/GLTFLoader", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/loaders/GLTFLoader.js")));
        app.use("/jsm/loaders/FBXLoader", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/loaders/FBXLoader.js")));
        app.use("/jsm/loaders/MTLLoader", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/loaders/MTLLoader.js")));
        app.use("/jsm/loaders/OBJLoader", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/loaders/OBJLoader.js")));
        app.use("/jsm/renderers/CSS2DRenderer", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/renderers/CSS2DRenderer.js")));
        app.use("/jsm/libs/tween.module.min", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/libs/tween.module.min.js")));
        app.use("/jsm/libs/stats.module", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/libs/stats.module.js")));
        app.use("/jsm/csm/CSM", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/csm/CSM.js")));
        app.use("/jsm/csm/CSMHelper", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/csm/CSMHelper.js")));
        app.use("/jsm/", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/three/examples/jsm/")));
        this.server = new http_1.default.Server(app);
    }
    Start() {
        this.server.listen(this.port, () => {
            console.log(`Server listening on port ${this.port}.`);
        });
    }
}
new App(port).Start();
//# sourceMappingURL=server.js.map