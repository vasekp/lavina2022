#version 300 es

precision highp float;
in vec2 squareCoords;
in vec4 baseColor;
out vec4 color;

void main() {
  float r2 = dot(squareCoords, squareCoords);
  float t = max(1.0 - r2, 0.0);
  color = baseColor * t * t * vec4(1, 1, 1, 1);
}
