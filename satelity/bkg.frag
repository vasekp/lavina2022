#version 300 es

precision highp float;
uniform samplerCube cubemap;
in vec3 direction;
out vec4 color;

void main() {
  color = pow(texture(cubemap, direction), vec4(0.65));
}
