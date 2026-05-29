const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));

const outputDir = packageJson.build?.directories?.output;
if (!outputDir) {
  throw new Error("Missing build.directories.output in package.json");
}

const targets = [
  path.join(root, "build", "renderer-ganglion-mechdog"),
  path.join(root, "dist", "MechDogServer.exe"),
  path.resolve(root, outputDir)
];

for (const target of targets) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to remove path outside repo: ${target}`);
  }

  if (fs.existsSync(target)) {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 500
    });
    console.log(`Removed ${relative}`);
  }
}
