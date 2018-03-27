import * as THREE from 'three';

import GPUComputationRenderer from './GPUComputationRenderer';
import heightmapFragmentShader from './heightmap_fragment_shader';
import waterVertexShader from './water_vertex_shader';

// Texture width for simulation
const WIDTH = 128;

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
    new Float32Array(WIDTH * WIDTH * 4),
    WIDTH,
    WIDTH,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  texture.needsUpdate = true;
  const pixels = texture.image.data;

  let p = 0;
  for (let j = 0; j < WIDTH; j++) {
    for (let i = 0; i < WIDTH; i++) {
      const x = i * 128 / WIDTH;
      const y = j * 128 / WIDTH;

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
      gpuCompute.material.uniforms.mousePos.value.set(point.x, point.z);
    } else {
      gpuCompute.material.uniforms.mousePos.value.set(10000, 10000);
    }
    mouseMoved = false;
  } else {
    gpuCompute.material.uniforms.mousePos.value.set(10000, 10000);
  }

  material.uniforms.heightmap.value = gpuCompute.compute();
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
const material = new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.merge([
    THREE.ShaderLib['phong'].uniforms,
    {
      heightmap: { value: null },
    },
  ]),
  vertexShader: waterVertexShader,
  fragmentShader: THREE.ShaderChunk['meshphong_frag'],
});
material.lights = true;
material.uniforms.diffuse.value = new THREE.Color(0x0040c0);
material.uniforms.specular.value = new THREE.Color(0x111111);
material.uniforms.shininess.value = Math.max(50, 1e-4);
material.uniforms.opacity.value = material.opacity;
material.defines.WIDTH = WIDTH.toFixed(1);
material.defines.BOUNDS = BOUNDS.toFixed(1);

const waterMesh = new THREE.Mesh(
  new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1),
  material
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

const gpuCompute = new GPUComputationRenderer({
  sizeX: WIDTH,
  sizeY: WIDTH,
  renderer,
  computeFragmentShader: heightmapFragmentShader,
  initialValueTexture: fillTexture(),
});
gpuCompute.material.uniforms.mousePos = {
  value: new THREE.Vector2(10000, 10000),
};
gpuCompute.material.uniforms.mouseSize = { value: 20.0 };
gpuCompute.material.uniforms.viscosityConstant = { value: 0.03 };
gpuCompute.material.defines.BOUNDS = BOUNDS.toFixed(1);

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
