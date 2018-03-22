import * as THREE from 'three';

const vertexShader = `
  varying vec2 location;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // (note that for our 2d projection, projectionMatrix * modelViewMatrix is just the identity)
    location = gl_Position.xy;
  }
`;

const fragmentShader = `
  uniform float time;
  varying vec2 location;

  void main() {
    float t = (cos(time * 0.001) + 1.0) * 0.5;
    gl_FragColor.gbr = vec3((location.xy + 1.0) * 0.5, t);
  }
`;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneBufferGeometry(2, 2);
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader });
material.uniforms.time = { value: 0 };
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

camera.position.z = 1;

const animate = function(time) {
  requestAnimationFrame(animate);

  material.uniforms.time.value = time;

  renderer.render(scene, camera);
};

animate(performance.now());
