export default `

#include <common>

uniform vec2 mouse1;
uniform vec2 mouse2;
uniform float mouseSize;
uniform float viscosityConstant;
uniform sampler2D heightmap;

#define deltaTime ( 1.0 / 60.0 )
#define GRAVITY_CONSTANT ( resolution.x * deltaTime * 3.0 )

void main() {

  vec2 cellSize = 1.0 / resolution.xy;

  vec2 uv = gl_FragCoord.xy * cellSize;

  // heightmapValue.x == height
  // heightmapValue.y == velocity
  // heightmapValue.z, heightmapValue.w not used
  vec4 heightmapValue = texture2D( heightmap, uv );

  // Get neighbours
  // vec4 north = texture2D( heightmap, uv + vec2( 0.0, cellSize.y ) );
  // vec4 south = texture2D( heightmap, uv + vec2( 0.0, - cellSize.y ) );
  // vec4 east = texture2D( heightmap, uv + vec2( cellSize.x, 0.0 ) );
  // vec4 west = texture2D( heightmap, uv + vec2( - cellSize.x, 0.0 ) );

  // float sump = north.x + south.x + east.x + west.x - 4.0 * heightmapValue.x;

  // float accel = sump * GRAVITY_CONSTANT;

  // Dynamics
  // heightmapValue.y += accel;
  // heightmapValue.x += heightmapValue.y * deltaTime;

  // Viscosity
  // heightmapValue.x += sump * viscosityConstant;

  // Mouse influence
  // float mouse1Phase = clamp(length(uv - mouse1) * PI / mouseSize, 0.0, PI);
  // float mouse2Phase = clamp(length(uv - mouse2) * PI / mouseSize, 0.0, PI);
  // heightmapValue.x = min(heightmapValue.x + cos(mouse1Phase) + cos( mouse2Phase ) + 2.0, 4.0);
  vec2 mouse12 = mouse2 - mouse1;
  float dist = (mouse12.y * uv.x - mouse12.x * uv.y + mouse2.x * mouse1.y - mouse2.y * mouse1.x) / length(mouse12);
  // float lineHeight = 0.5 * (cos(clamp(dist * 100.0, -PI, PI)) + 1.0);
  heightmapValue.x = dist;

  gl_FragColor = heightmapValue;

}

`;
