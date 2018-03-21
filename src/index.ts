import * as THREE from 'three';

const vertexShader = `
  varying vec2 location;

  void main() {
	  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader });
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

camera.position.z = 1;

const animate = function() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);
};

animate();
