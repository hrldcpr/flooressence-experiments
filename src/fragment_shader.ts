export default `

uniform sampler2D heightmap;
varying vec2 location;

void main() {
  float height = texture2D(heightmap, (location + 1.0) * 0.5).x;
  float gray = pow((height + 5.0) / 10.0, 5.0);
  gl_FragColor = vec4(gray, gray, gray, 1.0);
}

`;
