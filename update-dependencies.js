const fs = require('fs');
const path = require('path');

// Get the path to package.json
const packageJsonPath = path.resolve(__dirname, 'package.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get the version from the environment variable (if not set, do nothing)
const newVersion = process.env.NODE_PSTCORE_VERSION;

if (newVersion) {
  // Change the version of test_module to the one specified by the environment variable
  packageJson.dependencies['node-pstcore'] = newVersion;

  // Update package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
  console.log(`Updated node-pstcore version to ${newVersion} in package.json`);
}else{
  console.log(`Use node-pstcore original version ${packageJson.dependencies['node-pstcore']} in package.json`);
}