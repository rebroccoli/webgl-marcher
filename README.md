# Ray Marcher WebGL

Browser-based WebGL implementation of the ray marcher. This runs a localhost server and displays the same ray marching scene in your browser.

## Setup

### Prerequisites

- Node.js and npm installed

### Installation & Running

1. Navigate to this directory:

   ```bash
   cd main-webgl
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open your browser and go to:
   ```
   http://localhost:3000
   ```

## Controls

- **W/A/S/D** - Move forward/left/back/right
- **Arrow Keys** - Look around (up/down/left/right)
- **Space** - Move up
- **Shift** - Move down

## Features

- Ray marching with fullscreen rendering
- Interactive shape spawning (sphere/cube)
- Volumetric cloud rendering
- Real-time controls panel
- Camera movement with ground collision constraints

## Technical Details

- WebGL2 for shader-based ray marching
- Three.js-free vanilla WebGL implementation
- Fragment shader performs per-pixel ray marching
- Supports SDF-based sphere, cube, and ground plane
- Volumetric lighting for cloud rendering using Beer's law

## Performance Note

WebGL rendering runs entirely on the GPU (fragment shader). Performance depends on your GPU and browser. If experiencing lag:

- Reduce MAX_MARCHING_STEPS in the fragment shader
- Reduce CLOUD_SAMPLE_STEPS for fewer cloud samples
- Close browser tabs/extensions using GPU resources
