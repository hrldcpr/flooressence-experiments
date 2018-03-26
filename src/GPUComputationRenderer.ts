import * as THREE from 'three';

import passThroughVertexShader from './pass_through_vertex_shader';
import passThroughFragmentShader from './pass_through_fragment_shader';

export default function GPUComputationRenderer({
  sizeX,
  sizeY,
  renderer,
  computeFragmentShader,
  initialValueTexture,
}) {
  if (!renderer.extensions.get('OES_texture_float')) {
    console.log('No OES_texture_float support for float textures.');
  }

  if (renderer.capabilities.maxVertexTextures === 0) {
    console.log('No support for vertex shader textures.');
  }

  this.compute = function() {
    const nextTextureIndex = currentTextureIndex === 0 ? 1 : 0;

    this.material.uniforms.heightmap.value =
      renderTargets[currentTextureIndex].texture;
    mesh.material = this.material;
    renderer.render(scene, camera, renderTargets[nextTextureIndex]);

    currentTextureIndex = nextTextureIndex;
  };

  this.getCurrentRenderTarget = function() {
    return renderTargets[currentTextureIndex];
  };

  const addResolutionDefine = function(materialShader) {
    materialShader.defines.resolution = `vec2(${sizeX.toFixed(
      1
    )}, ${sizeY.toFixed(1)})`;
  };

  // The following functions can be used to compute things manually

  const createShaderMaterial = function(computeFragmentShader, uniforms?) {
    uniforms = uniforms || {};

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: passThroughVertexShader,
      fragmentShader: computeFragmentShader,
    });

    addResolutionDefine(material);

    return material;
  };

  const createRenderTarget = function() {
    return new THREE.WebGLRenderTarget(sizeX, sizeY, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
    });
  };

  const renderTargets = [];
  let currentTextureIndex = 0;
  this.material = createShaderMaterial(computeFragmentShader);
  this.material.uniforms.heightmap = { value: null };

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();

  const mesh = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(2, 2),
    createShaderMaterial(passThroughFragmentShader, {
      texture: { value: initialValueTexture },
    })
  );
  scene.add(mesh);

  // need two targets because you can't both read and write the same texture
  // see https://www.khronos.org/opengl/wiki/GLSL_:_common_mistakes#Sampling_and_Rendering_to_the_Same_Texture
  renderTargets[0] = createRenderTarget();
  renderTargets[1] = createRenderTarget();

  // render initial values into textures, using pass-through shader
  renderer.render(scene, camera, renderTargets[0]);
  renderer.render(scene, camera, renderTargets[1]);

  mesh.material = this.material;
}
