# Ray Marcher (WebGL)

A browser-based ray marching demo built with WebGL. It runs on a local server and renders an interactive 3D scene directly in your browser.

## Demo


https://github.com/user-attachments/assets/73bc8c9f-d1b6-4ddd-a148-c5b1474204d1



## Setup

**Prerequisites**
- Node.js + npm

**Run locally**
cd main-webgl
npm install
npm start

Then open: http://localhost:3000

## Controls
- W/A/S/D – Move
- Arrow keys – Look around
- Space / Shift – Move up / down

## Features
- Real-time ray marching (fullscreen)
- Spawn basic shapes (sphere, cube) with addition, subtraction, and blending
- Volumetric clouds
- Camera movement with ground constraints
- Simple control panel for interaction

## Stack
- WebGL2
- GLSL fragment shader for per-pixel ray marching
- SDF-based rendering (sphere, cube, ground)
- Volumetric lighting using Beer’s Law
