const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from current directory
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Ray Marcher WebGL running at http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop the server`);
});
