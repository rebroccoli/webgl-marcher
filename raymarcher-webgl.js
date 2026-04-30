// Ray Marcher WebGL Implementation

const MAX_SHAPES = 64;

class RayMarcherWebGL {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.gl = this.canvas.getContext("webgl2");

    if (!this.gl) {
      alert("WebGL2 not supported on this browser");
      return;
    }

    this.setupCanvas();
    this.initAsync();
  }

  async initAsync() {
    this.updateStatus("Loading shaders...");
    try {
      await this.setupProgram();
      this.updateStatus("Setting up geometry...");
      this.setupGeometry();
      this.updateStatus("Setting up controls...");
      this.setupControls();
      this.setupInput();

      // Camera state
      this.cameraPosition = [0.0, 1.7, 3.0];
      this.cameraTarget = [0.0, 0.0, 0.0];
      this.cameraDirection = [0.0, 0.0, -1.0];
      this.cameraYaw = 0.0;
      this.cameraPitch = 0.0;
      this.moveSpeed = 3.0;
      this.rotateSpeed = 1.5;
      this.currentTime = 0.0;

      // Scene state
      // this.hasShape = false;
      this.shapeType = 0;
      // this.shapePosition = [0.0, 0.0, 0.0];
      this.shapes = [];
      this.enableClouds = false;

      // Input state
      this.keys = {};
      this.lastFrameTime = Date.now();

      console.log("Initialization complete, starting render loop");
      this.updateStatus("Ready!");
      // Start render loop
      this.render();
    } catch (error) {
      console.error("Initialization failed:", error);
      this.updateStatus("Error: " + error.message);
    }
  }

  updateStatus(message) {
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent = message;
    }
    console.log("Status:", message);
  }

  setupCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(0.0, 0.0, 0.4, 0.0);

    window.addEventListener("resize", () => this.onWindowResize());
  }

  onWindowResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  async setupProgram() {
    // Load shaders
    try {
      const vertexShader = await this.loadShader("raymarcher.vert");
      const fragmentShader = await this.loadShader("raymarcher.frag");

      console.log("Vertex shader loaded, length:", vertexShader.length);
      console.log("Fragment shader loaded, length:", fragmentShader.length);

      this.program = this.createProgram(vertexShader, fragmentShader);
      this.gl.useProgram(this.program);
      console.log("Program created successfully");
    } catch (error) {
      console.error("Error loading shaders:", error);
      alert("Error loading shaders: " + error.message);
      return;
    }

    // Get uniform locations
    this.uniforms = {
      time: this.gl.getUniformLocation(this.program, "time"),
      resolution: this.gl.getUniformLocation(this.program, "resolution"),
      cameraPosition: this.gl.getUniformLocation(
        this.program,
        "cameraPosition",
      ),
      cameraTarget: this.gl.getUniformLocation(this.program, "cameraTarget"),
      shapeCount: this.gl.getUniformLocation(this.program, "shapeCount"),
      shapeTypes: this.gl.getUniformLocation(this.program, "shapeTypes"),
      shapePositions: this.gl.getUniformLocation(this.program, "shapePositions"),
      enableClouds: this.gl.getUniformLocation(this.program, "enableClouds"),
    };
  }

  async loadShader(filename) {
    try {
      const response = await fetch(filename);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load ${filename}`);
      }
      const text = await response.text();
      console.log(`Loaded ${filename}: ${text.substring(0, 100)}...`);
      return text;
    } catch (error) {
      console.error(`Error loading ${filename}:`, error);
      throw error;
    }
  }

  createProgram(vertexShaderSource, fragmentShaderSource) {
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, vertexShaderSource);
    this.gl.compileShader(vertexShader);

    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(vertexShader);
      console.error("Vertex shader error:", error);
      alert("Vertex shader compilation error:\n" + error);
      throw new Error("Vertex shader compilation failed");
    }
    console.log("Vertex shader compiled successfully");

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader, fragmentShaderSource);
    this.gl.compileShader(fragmentShader);

    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(fragmentShader);
      console.error("Fragment shader error:", error);
      alert("Fragment shader compilation error:\n" + error);
      throw new Error("Fragment shader compilation failed");
    }
    console.log("Fragment shader compiled successfully");

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      console.error("Program link error:", error);
      alert("Program link error:\n" + error);
      throw new Error("Program link failed");
    }
    console.log("Program linked successfully");

    return program;
  }

  setupGeometry() {
    // Create fullscreen quad
    const quadData = new Float32Array([
      -1.0, -1.0, 0.0, 1.0, -1.0, 0.0, -1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0,
      -1.0, 0.0, 1.0, 1.0, 0.0,
    ]);

    const vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(vao);

    const vbo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, quadData, this.gl.STATIC_DRAW);

    const positionLocation = this.gl.getAttribLocation(
      this.program,
      "vertexPosition",
    );
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(
      positionLocation,
      3,
      this.gl.FLOAT,
      false,
      12,
      0,
    );

    this.vao = vao;
  }

  setupControls() {
    const shapeTypeSelect = document.getElementById("shapeType");
    shapeTypeSelect.addEventListener("change", (e) => {
      this.shapeType = parseInt(e.target.value);
    });

    const spawnButton = document.getElementById("spawnButton");
    spawnButton.addEventListener("click", () => this.spawnShape());

    const enableCloudsCheckbox = document.getElementById("enableClouds");
    enableCloudsCheckbox.addEventListener("change", (e) => {
      this.enableClouds = e.target.checked;
    });

    // Shape position sliders
    const shapeXSlider = document.getElementById("shapeX");
    const shapeYSlider = document.getElementById("shapeY");
    const shapeZSlider = document.getElementById("shapeZ");

    shapeXSlider.addEventListener("input", (e) => {
      // this.shapePosition[0] = parseFloat(e.target.value);
      document.getElementById("shapeXValue").textContent = e.target.value;
    });

    shapeYSlider.addEventListener("input", (e) => {
      // this.shapePosition[1] = parseFloat(e.target.value);
      document.getElementById("shapeYValue").textContent = e.target.value;
    });

    shapeZSlider.addEventListener("input", (e) => {
      // this.shapePosition[2] = parseFloat(e.target.value);
      document.getElementById("shapeZValue").textContent = e.target.value;
    });
  }

  setupInput() {
    document.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  spawnShape() {

    if (this.shapes.length >= MAX_SHAPES) {
      console.warn("Max shapes reached");
      return;
    }

    const groundY = -1.0;
    const normalizedDir = this.normalizeVector(this.cameraDirection);

    let spawnPoint = this.addVectors(
      this.cameraPosition,
      this.multiplyVector(normalizedDir, 4.0),
    );

    if (Math.abs(normalizedDir[1]) > 0.0001) {
      const tGround = (groundY - this.cameraPosition[1]) / normalizedDir[1];
      if (tGround > 0.0) {
        spawnPoint = this.addVectors(
          this.cameraPosition,
          this.multiplyVector(normalizedDir, tGround),
        );
      }
    }

    this.shapes.push({ type: this.shapeType, position: [...spawnPoint] });

    // Update sliders
    document.getElementById("shapeX").value = spawnPoint[0];
    document.getElementById("shapeY").value = spawnPoint[1];
    document.getElementById("shapeZ").value = spawnPoint[2];
    document.getElementById("shapeXValue").textContent =
      spawnPoint[0].toFixed(2);
    document.getElementById("shapeYValue").textContent =
      spawnPoint[1].toFixed(2);
    document.getElementById("shapeZValue").textContent =
      spawnPoint[2].toFixed(2);
  }

  updateCamera(deltaTime) {
    // Movement
    const moveDirection = [0, 0, 0];

    const horizontalForward = this.normalizeVector([
      this.cameraDirection[0],
      0.0,
      this.cameraDirection[2],
    ]);

    const right = this.normalizeVector(
      this.crossProduct(horizontalForward, [0, 1, 0]),
    );

    if (this.keys["w"]) {
      moveDirection[0] += horizontalForward[0];
      moveDirection[1] += horizontalForward[1];
      moveDirection[2] += horizontalForward[2];
    }
    if (this.keys["s"]) {
      moveDirection[0] -= horizontalForward[0];
      moveDirection[1] -= horizontalForward[1];
      moveDirection[2] -= horizontalForward[2];
    }
    if (this.keys["a"]) {
      moveDirection[0] -= right[0];
      moveDirection[1] -= right[1];
      moveDirection[2] -= right[2];
    }
    if (this.keys["d"]) {
      moveDirection[0] += right[0];
      moveDirection[1] += right[1];
      moveDirection[2] += right[2];
    }

    // Vertical movement
    if (this.keys[" "]) {
      moveDirection[1] += 1.0;
    }
    if (this.keys["shift"]) {
      moveDirection[1] -= 1.0;
    }

    // Apply movement
    const moveLength = Math.sqrt(
      moveDirection[0] * moveDirection[0] +
        moveDirection[1] * moveDirection[1] +
        moveDirection[2] * moveDirection[2],
    );

    if (moveLength > 0.0) {
      const normalizedMove = this.multiplyVector(
        moveDirection,
        (this.moveSpeed * deltaTime) / moveLength,
      );
      this.cameraPosition = this.addVectors(
        this.cameraPosition,
        normalizedMove,
      );
    }

    // Ground constraints
    const FLOOR_LEVEL = 0.0;
    const PLAYER_EYE_HEIGHT = 1.7;
    const MAX_HEIGHT = 50.0;

    this.cameraPosition[1] = Math.max(
      this.cameraPosition[1],
      FLOOR_LEVEL + PLAYER_EYE_HEIGHT,
    );
    this.cameraPosition[1] = Math.min(this.cameraPosition[1], MAX_HEIGHT);

    // Rotation
    if (this.keys["arrowleft"]) {
      this.cameraYaw += this.rotateSpeed * deltaTime;
    }
    if (this.keys["arrowright"]) {
      this.cameraYaw -= this.rotateSpeed * deltaTime;
    }
    if (this.keys["arrowup"]) {
      this.cameraPitch += this.rotateSpeed * deltaTime;
      this.cameraPitch = Math.min(this.cameraPitch, 1.5);
    }
    if (this.keys["arrowdown"]) {
      this.cameraPitch -= this.rotateSpeed * deltaTime;
      this.cameraPitch = Math.max(this.cameraPitch, -1.5);
    }

    // Update camera direction
    this.cameraDirection = [
      Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch),
      Math.sin(this.cameraPitch),
      Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch),
    ];

    // Update camera target
    this.cameraTarget = this.addVectors(
      this.cameraPosition,
      this.cameraDirection,
    );
  }

  render = () => {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000.0;
    this.lastFrameTime = currentTime;

    this.currentTime += deltaTime;

    // Update camera
    this.updateCamera(deltaTime);

    // Clear canvas
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Set uniforms
    this.gl.uniform1f(this.uniforms.time, this.currentTime);
    this.gl.uniform2f(
      this.uniforms.resolution,
      this.canvas.width,
      this.canvas.height,
    );
    this.gl.uniform3fv(this.uniforms.cameraPosition, this.cameraPosition);
    this.gl.uniform3fv(this.uniforms.cameraTarget, this.cameraTarget);
    // this.gl.uniform1i(this.uniforms.shapeType, this.shapeType);
    // this.gl.uniform3fv(this.uniforms.shapePosition, this.shapePosition);
    // this.gl.uniform1i(this.uniforms.hasShape, this.hasShape ? 1 : 0);
    this.gl.uniform1i(this.uniforms.enableClouds, this.enableClouds ? 1 : 0);

    // Upload all shapes
    const count = this.shapes.length;
    this.gl.uniform1i(this.uniforms.shapeCount, count);
    if (count > 0) {
      const positions = new Float32Array(count * 3);
      const types = new Int32Array(count);
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 0] = this.shapes[i].position[0];
        positions[i * 3 + 1] = this.shapes[i].position[1];
        positions[i * 3 + 2] = this.shapes[i].position[2];
        types[i] = this.shapes[i].type;
      }
      this.gl.uniform3fv(this.uniforms.shapePositions, positions);
      this.gl.uniform1iv(this.uniforms.shapeTypes, types);
    }

    // Draw
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Continue rendering
    requestAnimationFrame(this.render);
  };

  // Helper math functions
  addVectors(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  multiplyVector(v, scalar) {
    return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
  }

  normalizeVector(v) {
    const length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (length === 0) return v;
    return [v[0] / length, v[1] / length, v[2] / length];
  }

  crossProduct(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", () => {
  new RayMarcherWebGL();
});
