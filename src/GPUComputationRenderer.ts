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
    this.material.uniforms.heightmap.value = ping.texture;
    mesh.material = this.material;
    renderer.render(scene, camera, pong);

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

    material.defines.resolution = `vec2(${sizeX.toFixed(1)}, ${sizeY.toFixed(
      1
    )})`;

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
  let ping = createRenderTarget();
  let pong = createRenderTarget();

  // render initial values into textures, using pass-through shader
  renderer.render(scene, camera, ping);

  mesh.material = this.material;
}
