#version 300 es
precision highp float;

in vec2 fragCoord;
out vec4 color;

// Uniforms
uniform float time;
uniform vec2 resolution;
uniform vec3 cameraPosition;
uniform vec3 cameraTarget;
uniform int shapeCount;
uniform int shapeTypes[64];
uniform vec3 shapePositions[64];
uniform bool enableClouds;

// Ray marching constants
const int MAX_MARCHING_STEPS = 255;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float EPSILON = 0.0001;

// Cloud constants
const int CLOUD_SAMPLE_STEPS = 16;
const int LIGHT_SAMPLE_STEPS = 4;
const float CLOUD_HEIGHT_MIN = 1.5;
const float CLOUD_HEIGHT_MAX = 5.0;
const float SIGMA_A = 1.0;
const float SIGMA_S = 8.0;
const float CLOUD_BRIGHT = 1.5;
const float LIGHT_INTENSITY = 2.0;

// Light position
const vec3 LIGHT_POS = vec3(10.0, 8.0, 5.0);
const vec3 LIGHT_COLOR = vec3(1.0, 0.95, 0.8);

float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n000 = hash(i + vec3(0, 0, 0));
    float n100 = hash(i + vec3(1, 0, 0));
    float n010 = hash(i + vec3(0, 1, 0));
    float n110 = hash(i + vec3(1, 1, 0));
    float n001 = hash(i + vec3(0, 0, 1));
    float n101 = hash(i + vec3(1, 0, 1));
    float n011 = hash(i + vec3(0, 1, 1));
    float n111 = hash(i + vec3(1, 1, 1));
    
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx0z = mix(nx00, nx10, f.y);
    
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nx1z = mix(nx01, nx11, f.y);
    
    return mix(nx0z, nx1z, f.z);
}

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 3; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value;
}

float getCloudDensity(vec3 p) {
    if (p.y < CLOUD_HEIGHT_MIN || p.y > CLOUD_HEIGHT_MAX) {
        return 0.0;
    }
    
    float cloudNoise = fbm(p * 0.8);
    float density = max(0.0, cloudNoise - 0.3);
    
    float heightFalloff = (CLOUD_HEIGHT_MAX - p.y) / (CLOUD_HEIGHT_MAX - CLOUD_HEIGHT_MIN);
    density *= smoothstep(0.0, 0.3, heightFalloff);
    
    return density * SIGMA_S;
}

float getLightAttenuation(vec3 p, vec3 lightDir, float maxDist) {
    float transmittance = 1.0;
    float stepSize = maxDist / float(LIGHT_SAMPLE_STEPS);
    
    for (int i = 0; i < LIGHT_SAMPLE_STEPS; i++) {
        vec3 samplePos = p + lightDir * stepSize * float(i);
        float density = getCloudDensity(samplePos);
        transmittance *= exp(-density * stepSize);
    }
    
    return transmittance;
}

float sdSphere(vec3 p, float radius) {
    return length(p) - radius;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

float sdPlane(vec3 p, vec3 n, float h) {
    return dot(p, n) + h;
}

float shapeSDF(vec3 localP, int type) {
    if (type == 0) {
        return sdSphere(localP, 1.0);
    } else {
        vec3 rotatedP = rotateY(0.785398) * rotateX(0.523599) * localP;
        return sdBox(rotatedP, vec3(0.7, 0.7, 0.7));
    }
}

float sceneSDF(vec3 p) {
    float shape = MAX_DIST;
    
    for (int i = 0; i < shapeCount; i++) {
        shape = min(shape, shapeSDF(p - shapePositions[i], shapeTypes[i]));
    }
    
    float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 1.0);
    return min(shape, ground);
}

int getHitObject(vec3 p) {
    float shape = MAX_DIST;

    for (int i = 0; i < shapeCount; i++) {
        shape = min(shape, shapeSDF(p - shapePositions[i], shapeTypes[i]));
    }
    
    float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 1.0);
    
    if (shape < ground) {
        return 1;
    } else {
        return 2;
    }
}

// Returns index of closest shape at p, or -1 if ground is closer
int getHitShapeIndex(vec3 p) {
    float best = MAX_DIST;
    int idx = -1;

    for (int i = 0; i < shapeCount; i++) {
        float d = shapeSDF(p - shapePositions[i], shapeTypes[i]);
        if (d < best) {
            best = d;
            idx = i;
        }
    }

    float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 1.0);
    if (ground < best) return -1;
    return idx;
}

float rayMarch(vec3 ro, vec3 rd) {
    float depth = MIN_DIST;
    
    for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        vec3 p = ro + depth * rd;
        float dist = sceneSDF(p);
        
        if (dist < EPSILON) {
            return depth;
        }
        
        depth += dist;
        
        if (depth >= MAX_DIST) {
            return MAX_DIST;
        }
    }
    
    return MAX_DIST;
}

vec3 getNormal(vec3 p) {
    return normalize(vec3(
        sceneSDF(vec3(p.x + EPSILON, p.y, p.z)) - sceneSDF(vec3(p.x - EPSILON, p.y, p.z)),
        sceneSDF(vec3(p.x, p.y + EPSILON, p.z)) - sceneSDF(vec3(p.x, p.y - EPSILON, p.z)),
        sceneSDF(vec3(p.x, p.y, p.z + EPSILON)) - sceneSDF(vec3(p.x, p.y, p.z - EPSILON))
    ));
}

vec3 calculateLighting(vec3 p, vec3 normal, vec3 viewDir, int hitObject, int shapeIdx) {
    vec3 lightPos = vec3(5.0, 5.0, 5.0);
    vec3 lightDir = normalize(lightPos - p);
    
    vec3 baseColor;
    if (hitObject == 1) {
        if (shapeIdx >= 0 && shapeTypes[shapeIdx] == 0) {
            baseColor = vec3(0.8, 0.8, 0.9);
        } else {
            baseColor = vec3(1.0, 0.4, 0.7);
        }
    } else {
        vec2 checker = floor(p.xz);
        float pattern = mod(checker.x + checker.y, 2.0);
        baseColor = mix(vec3(0.3, 0.5, 0.3), vec3(0.5, 0.7, 0.5), pattern);
    }
    
    vec3 ambient = baseColor * 0.2;
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * baseColor;
    
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    vec3 specular = spec * vec3(1.0, 1.0, 1.0) * 0.5;
    
    return ambient + diffuse + specular;
}

mat3 setCamera(vec3 ro, vec3 ta, float cr) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(cr), cos(cr), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = cross(cu, cw);
    return mat3(cu, cv, cw);
}

vec3 marchClouds(vec3 ro, vec3 rd, float maxDistToObject) {
    vec3 cloudColor = vec3(0.0);
    float transmittance = 1.0;
    float stepSize = maxDistToObject / float(CLOUD_SAMPLE_STEPS);
    
    for (int i = 0; i < CLOUD_SAMPLE_STEPS; i++) {
        float t = float(i) * stepSize;
        vec3 samplePos = ro + rd * t;
        float density = getCloudDensity(samplePos);
        
        if (density > 0.001) {
            vec3 lightDir = normalize(LIGHT_POS - samplePos);
            float distToLight = length(LIGHT_POS - samplePos);
            float lightTransmittance = getLightAttenuation(samplePos, lightDir, distToLight);
            float inScattering = density * lightTransmittance * LIGHT_INTENSITY;
            
            cloudColor += transmittance * inScattering * stepSize * LIGHT_COLOR;
            transmittance *= exp(-density * stepSize);
            
            if (transmittance < 0.01) break;
        }
    }
    
    return cloudColor;
}

void main() {
    // Normalize fragment coordinates to NDC space and correct for aspect ratio
    vec2 uv = fragCoord;
    uv.x *= (resolution.x / resolution.y);
    
    // Set up camera
    mat3 ca = setCamera(cameraPosition, cameraTarget, 0.0);
    
    // Create ray direction
    vec3 rayDir = normalize(ca * vec3(uv.x, uv.y, 2.0));
    
    // Ray march
    float dist = rayMarch(cameraPosition, rayDir);
    vec3 finalColor;
    
    if (dist < MAX_DIST) {
        vec3 hitPoint = cameraPosition + rayDir * dist;
        vec3 normal = getNormal(hitPoint);
        int hitObject = getHitObject(hitPoint);
        int shapeIdx = getHitShapeIndex(hitPoint);
        
        finalColor = calculateLighting(hitPoint, normal, -rayDir, hitObject, shapeIdx);
        
        // Add cloud color if enabled
        if (enableClouds) {
            vec3 cloudColor = marchClouds(cameraPosition, rayDir, dist);
            finalColor = mix(finalColor, finalColor + cloudColor, 0.6);
        }
    } else {
        // Sky color - light blue base
        finalColor = vec3(0.5, 0.7, 0.9);
        
        // Render clouds on top if enabled
        if (enableClouds) {
            vec3 cloudColor = marchClouds(cameraPosition, rayDir, MAX_DIST);
            finalColor += cloudColor;
        }
    }
    
    color = vec4(finalColor, 1.0);
}
