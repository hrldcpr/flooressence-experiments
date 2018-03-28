import * as THREE from 'three';

const vertexShader = `
  varying vec2 location;

  void main() {
	  gl_Position = vec4(position, 1.0);
    location = gl_Position.xy;
  }
`;

const fragmentShader = `
  varying vec2 location;

  void main() {
  	gl_FragColor = vec4((location.xy + 1.0) * 0.5, 0.0, 1.0);
  }
`;

const scene = new THREE.Scene();
const camera = new THREE.Camera();

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneBufferGeometry(2, 2);
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader });
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

const animate = function() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
};

animate();
