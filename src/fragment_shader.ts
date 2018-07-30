export default `

uniform sampler2D heightmap;
varying vec2 location;

void main() {
  float height = texture2D(heightmap, location).x;
  float gray = pow((height + 5.0) / 10.0, 5.0);
  // pre-multiplied alpha:
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * gray;
}

`;
