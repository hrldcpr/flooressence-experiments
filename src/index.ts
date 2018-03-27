import * as THREE from 'three';

import passThroughVertexShader from './pass_through_vertex_shader';
import passThroughFragmentShader from './pass_through_fragment_shader';
import heightmapFragmentShader from './heightmap_fragment_shader';
import waterVertexShader from './water_vertex_shader';

// Texture width for simulation
const WIDTH = 128;
const HEIGHT = 128;

// Water size in system units
const BOUNDS = 512;

let mouseMoved = false;
const mouseCoords = new THREE.Vector2();

const WATER_MAX_HEIGHT = 10;

function noise(x, y, z) {
  let multR = WATER_MAX_HEIGHT;
  let mult = 0.025;
  let r = 0;
  for (let i = 0; i < 15; i++) {
    r += multR * Math.random();
    multR *= 0.53 + 0.025 * i;
    mult *= 1.25;
  }
  return r;
}

function fillTexture() {
  const texture = new THREE.DataTexture(
    new Float32Array(WIDTH * HEIGHT * 4),
    WIDTH,
    HEIGHT,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  texture.needsUpdate = true;
  const pixels = texture.image.data;

  let p = 0;
  for (let j = 0; j < HEIGHT; j++) {
    for (let i = 0; i < WIDTH; i++) {
      const x = i * 128 / WIDTH;
      const y = j * 128 / HEIGHT;

      pixels[p + 0] = noise(x, y, 123.4);
      pixels[p + 1] = 0;
      pixels[p + 2] = 0;
      pixels[p + 3] = 1;

      p += 4;
    }
  }

  return texture;
}

function setMouseCoords(x, y) {
  mouseCoords.set(
    x / renderer.domElement.clientWidth * 2 - 1,
    -(y / renderer.domElement.clientHeight) * 2 + 1
  );
  mouseMoved = true;
}

function animate() {
  requestAnimationFrame(animate);

  if (mouseMoved) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseCoords, camera);
    const intersects = raycaster.intersectObject(meshRay);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      computeMaterial.uniforms.mousePos.value.set(point.x, point.z);
    } else {
      computeMaterial.uniforms.mousePos.value.set(10000, 10000);
    }
    mouseMoved = false;
  } else {
    computeMaterial.uniforms.mousePos.value.set(10000, 10000);
  }

  waterMaterial.uniforms.heightmap.value = compute();
  renderer.render(scene, camera);
}

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

// material: make a ShaderMaterial clone of MeshPhongMaterial, with customized vertex shader
const waterMaterial = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([
    THREE.ShaderLib['phong'].uniforms,
    {
      heightmap: { value: null },
    },
  ]),
  vertexShader: waterVertexShader,
  fragmentShader: THREE.ShaderChunk['meshphong_frag'],
});
waterMaterial.lights = true;
waterMaterial.uniforms.diffuse.value = new THREE.Color(0x0040c0);
waterMaterial.uniforms.specular.value = new THREE.Color(0x111111);
waterMaterial.uniforms.shininess.value = Math.max(50, 1e-4);
waterMaterial.uniforms.opacity.value = waterMaterial.opacity;
waterMaterial.defines.WIDTH = WIDTH.toFixed(1);
waterMaterial.defines.BOUNDS = BOUNDS.toFixed(1);

const waterMesh = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, WIDTH - 1, HEIGHT - 1),
  waterMaterial
);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.matrixAutoUpdate = false;
waterMesh.updateMatrix();
scene.add(waterMesh);

// Mesh just for mouse raycasting
const meshRay = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, 1, 1),
  new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false })
);
meshRay.rotation.x = -Math.PI / 2;
meshRay.matrixAutoUpdate = false;
meshRay.updateMatrix();
scene.add(meshRay);

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

const compute = function() {
  computeMaterial.uniforms.heightmap.value = ping.texture;
  mesh.material = computeMaterial;
  renderer.render(computeScene, computeCamera, pong);

  [ping, pong] = [pong, ping];

  return ping.texture;
};

const createShaderMaterial = function(computeFragmentShader, uniforms?) {
  uniforms = uniforms || {};

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: passThroughVertexShader,
    fragmentShader: computeFragmentShader,
  });

  material.defines.resolution = `vec2(${WIDTH.toFixed(1)}, ${HEIGHT.toFixed(
    1
  )})`;

  return material;
};

const createRenderTarget = function() {
  return new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    stencilBuffer: false,
  });
};

const computeMaterial = createShaderMaterial(heightmapFragmentShader);
computeMaterial.uniforms.heightmap = { value: null };

const computeScene = new THREE.Scene();
const computeCamera = new THREE.Camera();

const mesh = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(2, 2),
  createShaderMaterial(passThroughFragmentShader, {
    texture: { value: fillTexture() },
  })
);
computeScene.add(mesh);

// need two targets because you can't both read and write the same texture
// see https://www.khronos.org/opengl/wiki/GLSL_:_common_mistakes#Sampling_and_Rendering_to_the_Same_Texture
let ping = createRenderTarget();
let pong = createRenderTarget();

// render initial values into textures, using pass-through shader
renderer.render(computeScene, computeCamera, ping);

mesh.material = computeMaterial;

computeMaterial.uniforms.mousePos = {
  value: new THREE.Vector2(10000, 10000),
};
computeMaterial.uniforms.mouseSize = { value: 20.0 };
computeMaterial.uniforms.viscosityConstant = { value: 0.03 };
computeMaterial.defines.BOUNDS = BOUNDS.toFixed(1);

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

animate();
