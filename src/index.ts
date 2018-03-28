import * as THREE from 'three';

import passThroughVertexShader from './pass_through_vertex_shader';
import heightmapFragmentShader from './heightmap_fragment_shader';
import waterVertexShader from './water_vertex_shader';

// Texture size for simulation
const WIDTH = 128;
const HEIGHT = 128;

// Water size in system units
const BOUNDS = 512;

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

if (!renderer.extensions.get('OES_texture_float')) {
  console.log('No OES_texture_float support for float textures.');
}

if (renderer.capabilities.maxVertexTextures === 0) {
  console.log('No support for vertex shader textures.');
}

const computeCamera = new THREE.Camera();
const computeScene = new THREE.Scene();
const computeMaterial = new THREE.ShaderMaterial({
  defines: {
    BOUNDS: BOUNDS.toFixed(1),
    resolution: `vec2(${WIDTH.toFixed(1)}, ${HEIGHT.toFixed(1)})`,
  },
  uniforms: {
    heightmap: { value: null },
    mousePos: { value: new THREE.Vector2(10000, 10000) },
    mouseSize: { value: 20.0 },
    viscosityConstant: { value: 0.03 },
  },
  vertexShader: passThroughVertexShader,
  fragmentShader: heightmapFragmentShader,
});
computeScene.add(
  new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), computeMaterial)
);

const camera = new THREE.OrthographicCamera(
  -BOUNDS / 2,
  BOUNDS / 2,
  BOUNDS / 2,
  -BOUNDS / 2,
  1,
  1000
);
camera.position.set(0, 100, 0);
camera.up.set(0, 0, 1);
camera.lookAt(0, 0, 0);

const scene = new THREE.Scene();

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(300, 400, 175);
scene.add(sun);

const sun2 = new THREE.DirectionalLight(0x40a040, 0.6);
sun2.position.set(-100, 350, -200);
scene.add(sun2);

// make a ShaderMaterial clone of MeshPhongMaterial, with customized vertex shader
const material = new THREE.ShaderMaterial({
  lights: true,
  defines: {
    WIDTH: WIDTH.toFixed(1),
    HEIGHT: HEIGHT.toFixed(1),
    BOUNDS: BOUNDS.toFixed(1),
  },
  uniforms: THREE.UniformsUtils.merge([
    THREE.ShaderLib['phong'].uniforms,
    {
      heightmap: { value: null },
      diffuse: { value: new THREE.Color(0x0040c0) },
      specular: { value: new THREE.Color(0x111111) },
      shininess: { value: Math.max(50, 1e-4) },
    },
  ]),
  vertexShader: waterVertexShader,
  fragmentShader: THREE.ShaderChunk['meshphong_frag'],
});

const mesh = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, WIDTH - 1, HEIGHT - 1),
  material
);
mesh.rotation.x = -Math.PI / 2;
scene.add(mesh);

function setMouseCoords(x, y) {
  computeMaterial.uniforms.mousePos.value.set(
    (0.5 - x / renderer.domElement.clientWidth) * BOUNDS,
    (0.5 - y / renderer.domElement.clientHeight) * BOUNDS
  );
}

document.addEventListener('mousemove', event =>
  setMouseCoords(event.clientX, event.clientY)
);
document.addEventListener('touchstart', event => {
  if (event.touches.length === 1) {
    event.preventDefault();
    setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
  }
});
document.addEventListener('touchmove', event => {
  if (event.touches.length === 1) {
    event.preventDefault();
    setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
  }
});

window.addEventListener('resize', () =>
  renderer.setSize(window.innerWidth, window.innerHeight)
);

// need two targets because you can't both read and write the same texture
// see https://www.khronos.org/opengl/wiki/GLSL_:_common_mistakes#Sampling_and_Rendering_to_the_Same_Texture
let ping = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
  type: THREE.FloatType,
  stencilBuffer: false,
});
let pong = ping.clone();

function animate() {
  computeMaterial.uniforms.heightmap.value = ping.texture;
  renderer.render(computeScene, computeCamera, pong);
  [ping, pong] = [pong, ping];

  material.uniforms.heightmap.value = ping.texture;
  renderer.render(scene, camera);

  computeMaterial.uniforms.mousePos.value.set(10000, 10000);

  requestAnimationFrame(animate);
}

animate();
