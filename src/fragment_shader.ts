export default `

uniform sampler2D heightmap;
varying vec2 location;

void main() {
  float height = texture2D(heightmap, (location + 1.0) * 0.5).x;
  float gray = 0.00001 / (height * height);
  gl_FragColor = vec4(gray, gray, gray, 1.0);
}

`;
