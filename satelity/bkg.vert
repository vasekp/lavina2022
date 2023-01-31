#version 300 es

uniform mat4 mProj;
uniform mat3 mErtObs;
uniform mat3 mSunErt;
uniform mat3 mTexSun;
out vec3 direction;

const vec2 corners[] = vec2[](
  vec2(1, 1),
  vec2(1, -1),
  vec2(-1, 1),
  vec2(-1, -1)
);

void main() {
  gl_Position = vec4(corners[gl_VertexID], 1, 1);
  direction = mTexSun * mSunErt * mErtObs * inverse(mat3(mProj)) * gl_Position.xyz;
}
