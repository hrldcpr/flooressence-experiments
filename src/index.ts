import * as THREE from 'three';

import GPUComputationRenderer from './GPUComputationRenderer';
import heightmapFragmentShader from './heightmap_fragment_shader';
import waterVertexShader from './water_vertex_shader';

// Texture width for simulation
var WIDTH = 128;
var NUM_TEXELS = WIDTH * WIDTH;

// Water size in system units
var BOUNDS = 512;
var BOUNDS_HALF = BOUNDS * 0.5;

var container;
var camera, scene, renderer;
var mouseMoved = false;
var mouseCoords = new THREE.Vector2();
var raycaster = new THREE.Raycaster();

var waterMesh;
var meshRay;
var gpuCompute;
var heightmapVariable;
var waterUniforms;

var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

init();
animate();

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    3000
  );
  camera.position.set(0, 200, 350);

  scene = new THREE.Scene();

  var sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(300, 400, 175);
  scene.add(sun);

  var sun2 = new THREE.DirectionalLight(0x40a040, 0.6);
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

  var effectController = {
    mouseSize: 20.0,
    viscosity: 0.03,
  };

  var valuesChanger = function() {
    heightmapVariable.material.uniforms.mouseSize.value =
      effectController.mouseSize;
    heightmapVariable.material.uniforms.viscosityConstant.value =
      effectController.viscosity;
  };

  initWater();

  valuesChanger();
}

function initWater() {
  var materialColor = 0x0040c0;

  var geometry = new THREE.PlaneBufferGeometry(
    BOUNDS,
    BOUNDS,
    WIDTH - 1,
    WIDTH - 1
  );

  // material: make a ShaderMaterial clone of MeshPhongMaterial, with customized vertex shader
  var material = new THREE.ShaderMaterial({
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
  var geometryRay = new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, 1, 1);
  meshRay = new THREE.Mesh(
    geometryRay,
    new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false })
  );
  meshRay.rotation.x = -Math.PI / 2;
  meshRay.matrixAutoUpdate = false;
  meshRay.updateMatrix();
  scene.add(meshRay);

  // Creates the gpu computation class and sets it up

  gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

  var heightmap0 = gpuCompute.createTexture();

  fillTexture(heightmap0);

  heightmapVariable = gpuCompute.addVariable(
    'heightmap',
    heightmapFragmentShader,
    heightmap0
  );

  gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);

  heightmapVariable.material.uniforms.mousePos = {
    value: new THREE.Vector2(10000, 10000),
  };
  heightmapVariable.material.uniforms.mouseSize = { value: 20.0 };
  heightmapVariable.material.uniforms.viscosityConstant = { value: 0.03 };
  heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1);

  var error = gpuCompute.init();
  if (error !== null) {
    console.error(error);
  }
}

function fillTexture(texture) {
  var waterMaxHeight = 10;

  function noise(x, y, z) {
    var multR = waterMaxHeight;
    var mult = 0.025;
    var r = 0;
    for (var i = 0; i < 15; i++) {
      r += multR * Math.random();
      multR *= 0.53 + 0.025 * i;
      mult *= 1.25;
    }
    return r;
  }

  var pixels = texture.image.data;

  var p = 0;
  for (var j = 0; j < WIDTH; j++) {
    for (var i = 0; i < WIDTH; i++) {
      var x = i * 128 / WIDTH;
      var y = j * 128 / WIDTH;

      pixels[p + 0] = noise(x, y, 123.4);
      pixels[p + 1] = 0;
      pixels[p + 2] = 0;
      pixels[p + 3] = 1;

      p += 4;
    }
  }
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

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
  var uniforms = heightmapVariable.material.uniforms;
  if (mouseMoved) {
    raycaster.setFromCamera(mouseCoords, camera);

    var intersects = raycaster.intersectObject(meshRay);

    if (intersects.length > 0) {
      var point = intersects[0].point;
      uniforms.mousePos.value.set(point.x, point.z);
    } else {
      uniforms.mousePos.value.set(10000, 10000);
    }

    mouseMoved = false;
  } else {
    uniforms.mousePos.value.set(10000, 10000);
  }

  // Do the gpu computation
  gpuCompute.compute();

  // Get compute output in custom uniform
  waterUniforms.heightmap.value = gpuCompute.getCurrentRenderTarget(
    heightmapVariable
  ).texture;

  // Render
  renderer.render(scene, camera);
}
