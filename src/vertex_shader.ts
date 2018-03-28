export default `

varying vec2 location;

void main() {
  gl_Position = vec4(position, 1.0);
  location = gl_Position.xy;
}

`;
