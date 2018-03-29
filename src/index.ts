import * as THREE from 'three';

import passThroughVertexShader from './pass_through_vertex_shader';
import heightmapFragmentShader from './heightmap_fragment_shader';
import vertexShader from './vertex_shader';
import fragmentShader from './fragment_shader';

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

const computeScene = new THREE.Scene();
const computeCamera = new THREE.Camera();

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

const scene = new THREE.Scene();
const camera = new THREE.Camera();

const material = new THREE.ShaderMaterial({
  defines: { WIDTH: WIDTH.toFixed(1), HEIGHT: HEIGHT.toFixed(1) },
  uniforms: { heightmap: { value: null } },
  vertexShader,
  fragmentShader,
});
scene.add(
  new THREE.Mesh(new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS), material)
);

function setMouseCoords(x, y) {
  computeMaterial.uniforms.mousePos.value.set(
    (x / renderer.domElement.clientWidth - 0.5) * BOUNDS,
    (-y / renderer.domElement.clientHeight + 0.5) * BOUNDS
  );
}

alert('v3');

document.addEventListener('mousemove', event =>
  setMouseCoords(event.clientX, event.clientY)
);
document.addEventListener('touchstart', event => {
  if (event.touches.length === 1) {
    setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
  }
});
document.addEventListener('touchmove', event => {
  if (event.touches.length === 1) {
    setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
  }
});

window.addEventListener('resize', () =>
  renderer.setSize(window.innerWidth, window.innerHeight)
);

// need two targets because you can't both read and write the same texture
// see https://www.khronos.org/opengl/wiki/GLSL_:_common_mistakes#Sampling_and_Rendering_to_the_Same_Texture
let ping = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
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
