import * as THREE from 'three';

import passThroughVertexShader from './pass_through_vertex_shader';
import passThroughFragmentShader from './pass_through_fragment_shader';

export default function GPUComputationRenderer({
  sizeX,
  sizeY,
  renderer,
  computeFragmentShader,
}) {
  this.init = function() {
    if (!renderer.extensions.get('OES_texture_float')) {
      return 'No OES_texture_float support for float textures.';
    }

    if (renderer.capabilities.maxVertexTextures === 0) {
      return 'No support for vertex shader textures.';
    }

    // Creates rendertargets and initialize them with input texture
    // need two targets because you can't both read and write the same texture
    // see https://www.khronos.org/opengl/wiki/GLSL_:_common_mistakes#Sampling_and_Rendering_to_the_Same_Texture
    this.renderTargets[0] = this.createRenderTarget();
    this.renderTargets[1] = this.createRenderTarget();
    this.renderTexture(this.initialValueTexture, this.renderTargets[0]);
    this.renderTexture(this.initialValueTexture, this.renderTargets[1]);

    // Adds dependencies uniforms to the ShaderMaterial
    this.material.uniforms.heightmap = { value: null };

    this.currentTextureIndex = 0;
  };

  this.compute = function() {
    const currentTextureIndex = this.currentTextureIndex;
    const nextTextureIndex = this.currentTextureIndex === 0 ? 1 : 0;

    this.material.uniforms.heightmap.value = this.renderTargets[
      currentTextureIndex
    ].texture;

    this.doRenderTarget(this.material, this.renderTargets[nextTextureIndex]);

    this.currentTextureIndex = nextTextureIndex;
  };

  this.getCurrentRenderTarget = function() {
    return this.renderTargets[this.currentTextureIndex];
  };

  this.addResolutionDefine = function(materialShader) {
    materialShader.defines.resolution = `vec2(${sizeX.toFixed(
      1
    )}, ${sizeY.toFixed(1)})`;
  };

  // The following functions can be used to compute things manually

  this.createShaderMaterial = function(computeFragmentShader, uniforms) {
    uniforms = uniforms || {};

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: passThroughVertexShader,
      fragmentShader: computeFragmentShader,
    });

    this.addResolutionDefine(material);

    return material;
  };

  this.createRenderTarget = function() {
    return new THREE.WebGLRenderTarget(sizeX, sizeY, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
    });
  };

  this.createInitialValueTexture = function() {
    this.initialValueTexture = new THREE.DataTexture(
      new Float32Array(sizeX * sizeY * 4),
      sizeX,
      sizeY,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.initialValueTexture.needsUpdate = true;

    return this.initialValueTexture;
  };

  this.renderTexture = function(input, output) {
    // Takes a texture, and render out in rendertarget
    // input = Texture
    // output = RenderTarget

    passThruUniforms.texture.value = input;

    this.doRenderTarget(passThruShader, output);
  };

  this.doRenderTarget = function(material, output) {
    mesh.material = material;
    renderer.render(scene, camera, output);
  };

  this.renderTargets = [];

  this.currentTextureIndex = 0;

  this.material = this.createShaderMaterial(computeFragmentShader);

  const scene = new THREE.Scene();
  const camera = new THREE.Camera();

  const passThruUniforms = {
    texture: { value: null },
  };

  const passThruShader = this.createShaderMaterial(
    passThroughFragmentShader,
    passThruUniforms
  );

  const mesh = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(2, 2),
    passThruShader
  );
  scene.add(mesh);
}
