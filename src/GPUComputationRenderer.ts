import * as THREE from 'three';

import passThroughVertexShader from './pass_through_vertex_shader';
import passThroughFragmentShader from './pass_through_fragment_shader';

export default function GPUComputationRenderer(sizeX, sizeY, renderer) {
  this.variables = [];

  this.currentTextureIndex = 0;

  const scene = new THREE.Scene();

  const camera = new THREE.Camera();

  const passThruUniforms = {
    texture: { value: null },
  };

  const passThruShader = createShaderMaterial(
    passThroughFragmentShader,
    passThruUniforms
  );

  const mesh = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(2, 2),
    passThruShader
  );
  scene.add(mesh);

  this.addVariable = function(
    variableName,
    computeFragmentShader,
    initialValueTexture
  ) {
    const material = this.createShaderMaterial(computeFragmentShader);

    const variable = {
      name: variableName,
      initialValueTexture: initialValueTexture,
      material: material,
      dependencies: null,
      renderTargets: [],
    };

    this.variables.push(variable);

    return variable;
  };

  this.setVariableDependencies = function(variable, dependencies) {
    variable.dependencies = dependencies;
  };

  this.init = function() {
    if (!renderer.extensions.get('OES_texture_float')) {
      return 'No OES_texture_float support for float textures.';
    }

    if (renderer.capabilities.maxVertexTextures === 0) {
      return 'No support for vertex shader textures.';
    }

    for (const variable of this.variables) {
      // Creates rendertargets and initialize them with input texture
      variable.renderTargets[0] = this.createRenderTarget();
      variable.renderTargets[1] = this.createRenderTarget();
      this.renderTexture(
        variable.initialValueTexture,
        variable.renderTargets[0]
      );
      this.renderTexture(
        variable.initialValueTexture,
        variable.renderTargets[1]
      );

      // Adds dependencies uniforms to the ShaderMaterial
      const material = variable.material;
      for (const depVar of variable.dependencies || []) {
        material.uniforms[depVar.name] = { value: null };
        material.fragmentShader =
          `uniform sampler2D ${depVar.name};\n` + material.fragmentShader;
      }
    }

    this.currentTextureIndex = 0;

    return null;
  };

  this.compute = function() {
    const currentTextureIndex = this.currentTextureIndex;
    const nextTextureIndex = this.currentTextureIndex === 0 ? 1 : 0;

    for (const variable of this.variables) {
      // Sets texture dependencies uniforms
      for (const depVar of variable.dependencies || []) {
        variable.material.uniforms[depVar.name].value =
          depVar.renderTargets[currentTextureIndex].texture;
      }

      // Performs the computation for this variable
      this.doRenderTarget(
        variable.material,
        variable.renderTargets[nextTextureIndex]
      );
    }

    this.currentTextureIndex = nextTextureIndex;
  };

  this.getCurrentRenderTarget = function(variable) {
    return variable.renderTargets[this.currentTextureIndex];
  };

  this.getAlternateRenderTarget = function(variable) {
    return variable.renderTargets[this.currentTextureIndex === 0 ? 1 : 0];
  };

  function addResolutionDefine(materialShader) {
    materialShader.defines.resolution = `vec2(${sizeX.toFixed(
      1
    )}, ${sizeY.toFixed(1)})`;
  }
  this.addResolutionDefine = addResolutionDefine;

  // The following functions can be used to compute things manually

  function createShaderMaterial(computeFragmentShader, uniforms) {
    uniforms = uniforms || {};

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: passThroughVertexShader,
      fragmentShader: computeFragmentShader,
    });

    addResolutionDefine(material);

    return material;
  }
  this.createShaderMaterial = createShaderMaterial;

  this.createRenderTarget = function() {
    return new THREE.WebGLRenderTarget(sizeX, sizeY, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
    });
  };

  this.createTexture = function() {
    const texture = new THREE.DataTexture(
      new Float32Array(sizeX * sizeY * 4),
      sizeX,
      sizeY,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;

    return texture;
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
}
