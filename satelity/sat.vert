#version 300 es

uniform mat4 mProj;
uniform mat3 mErtObs;
uniform mat3 mSunErt;
uniform mat3 mTexSun;

layout(location = 0) in vec4 coords;
layout(location = 1) in vec4 color;

out vec2 squareCoords;
out vec4 baseColor;

const float baseSize = 0.05;

const vec2 corners[] = vec2[](
  vec2(1, 1),
  vec2(1, -1),
  vec2(-1, 1),
  vec2(-1, -1)
);

void main() {
  vec3 position =
    mat3(cos(coords.x), sin(coords.x), 0, -sin(coords.x), cos(coords.x), 0, 0, 0, 1)
    * mat3(1, 0, 0, 0, cos(coords.y), sin(coords.y), 0, -sin(coords.y), cos(coords.y))
    * vec3(cos(coords.z), sin(coords.z), 0) * coords.w;
  vec3 center = inverse(mSunErt * mErtObs) * position;
  squareCoords = corners[gl_VertexID];
  baseColor = color;
  gl_Position = mProj * vec4(center + baseSize * vec3(squareCoords, 0), 1);
}
