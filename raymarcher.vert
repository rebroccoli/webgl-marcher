#version 300 es

in vec3 vertexPosition;
out vec2 fragCoord;

void main() {
    gl_Position = vec4(vertexPosition, 1.0);
    fragCoord = vertexPosition.xy;
}
