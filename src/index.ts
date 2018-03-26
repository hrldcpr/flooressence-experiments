import * as THREE from 'three';

import GPUComputationRenderer from './GPUComputationRenderer';
import heightmapFragmentShader from './heightmap_fragment_shader';
import waterVertexShader from './water_vertex_shader';

// Texture width for simulation
const WIDTH = 128;

// Water size in system units
const BOUNDS = 512;

let container;
let camera, scene, renderer;
let mouseMoved = false;
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let waterMesh;
let meshRay;
let gpuCompute;
let waterUniforms;

init();
animate();

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  camera = new THREE.OrthographicCamera(
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

  scene = new THREE.Scene();

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(300, 400, 175);
  scene.add(sun);

  const sun2 = new THREE.DirectionalLight(0x40a040, 0.6);
  sun2.position.set(-100, 350, -200);
  scene.add(sun2);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  document.addEventListener('mousemove', onDocumentMouseMove, false);
  document.addEventListener('touchstart', onDocumentTouchStart, false);
  document.addEventListener('touchmove', onDocumentTouchMove, false);

  document.addEventListener(
    'keydown',
    function(event) {
      // W Pressed: Toggle wireframe
      if (event.keyCode === 87) {
        waterMesh.material.wireframe = !waterMesh.material.wireframe;
        waterMesh.material.needsUpdate = true;
      }
    },
    false
  );

  window.addEventListener('resize', onWindowResize, false);

  initWater();

  gpuCompute.material.uniforms.mouseSize.value = 20.0;
  gpuCompute.material.uniforms.viscosityConstant.value = 0.03;
}

function initWater() {
  const materialColor = 0x0040c0;

  const geometry = new THREE.PlaneBufferGeometry(
    BOUNDS,
    BOUNDS,
    WIDTH - 1,
    WIDTH - 1
  );

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

  // Sets the uniforms with the material values
  material.uniforms.diffuse.value = new THREE.Color(materialColor);
  material.uniforms.specular.value = new THREE.Color(0x111111);
  material.uniforms.shininess.value = Math.max(50, 1e-4);
  material.uniforms.opacity.value = material.opacity;

  // Defines
  material.defines.WIDTH = WIDTH.toFixed(1);
  material.defines.BOUNDS = BOUNDS.toFixed(1);

  waterUniforms = material.uniforms;

  waterMesh = new THREE.Mesh(geometry, material);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.matrixAutoUpdate = false;
  waterMesh.updateMatrix();

  scene.add(waterMesh);

  // Mesh just for mouse raycasting
  const geometryRay = new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, 1, 1);
  meshRay = new THREE.Mesh(
    geometryRay,
    new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false })
  );
  meshRay.rotation.x = -Math.PI / 2;
  meshRay.matrixAutoUpdate = false;
  meshRay.updateMatrix();
  scene.add(meshRay);

  // Creates the gpu computation class and sets it up

  const heightmap0 = new THREE.DataTexture(
    new Float32Array(WIDTH * WIDTH * 4),
    WIDTH,
    WIDTH,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  heightmap0.needsUpdate = true;
  fillTexture(heightmap0);

  gpuCompute = new GPUComputationRenderer({
    sizeX: WIDTH,
    sizeY: WIDTH,
    renderer,
    computeFragmentShader: heightmapFragmentShader,
    initialValueTexture: heightmap0,
  });

  gpuCompute.material.uniforms.mousePos = {
    value: new THREE.Vector2(10000, 10000),
  };
  gpuCompute.material.uniforms.mouseSize = { value: 20.0 };
  gpuCompute.material.uniforms.viscosityConstant = { value: 0.03 };
  gpuCompute.material.defines.BOUNDS = BOUNDS.toFixed(1);
}

function fillTexture(texture) {
  const waterMaxHeight = 10;

  function noise(x, y, z) {
    let multR = waterMaxHeight;
    let mult = 0.025;
    let r = 0;
    for (let i = 0; i < 15; i++) {
      r += multR * Math.random();
      multR *= 0.53 + 0.025 * i;
      mult *= 1.25;
    }
    return r;
  }

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
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setMouseCoords(x, y) {
  mouseCoords.set(
    x / renderer.domElement.clientWidth * 2 - 1,
    -(y / renderer.domElement.clientHeight) * 2 + 1
  );
  mouseMoved = true;
}

function onDocumentMouseMove(event) {
  setMouseCoords(event.clientX, event.clientY);
}

function onDocumentTouchStart(event) {
  if (event.touches.length === 1) {
    event.preventDefault();

    setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
  }
}

function onDocumentTouchMove(event) {
  if (event.touches.length === 1) {
    event.preventDefault();

    setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
  }
}

function animate() {
  requestAnimationFrame(animate);

  render();
}

function render() {
  // Set uniforms: mouse interaction
  const uniforms = gpuCompute.material.uniforms;
  if (mouseMoved) {
    raycaster.setFromCamera(mouseCoords, camera);

    const intersects = raycaster.intersectObject(meshRay);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      uniforms.mousePos.value.set(point.x, point.z);
    } else {
      uniforms.mousePos.value.set(10000, 10000);
    }

    mouseMoved = false;
  } else {
    uniforms.mousePos.value.set(10000, 10000);
  }

  // Do the gpu computation
  // Get compute output in custom uniform
  waterUniforms.heightmap.value = gpuCompute.compute();

  // Render
  renderer.render(scene, camera);
}
