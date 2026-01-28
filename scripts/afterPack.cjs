const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack hook
 * Writes distribution mode to a JSON file in resources directory.
 * Default is "installed" - afterAllArtifactBuild will change ZIP to "portable".
 */
exports.default = async function (context) {
  let resourcesDir;

  // macOS: resources are inside .app bundle
  if (context.packager.platform.name === 'mac') {
    const appName = context.packager.appInfo.productFilename;
    resourcesDir = path.join(context.appOutDir, `${appName}.app`, 'Contents', 'Resources');
  } else {
    // Windows/Linux: resources are directly in appOutDir
    resourcesDir = path.join(context.appOutDir, 'resources');
  }

  const configPath = path.join(resourcesDir, 'distribution.json');

  const config = {
    mode: 'installed', // Default to installed, ZIP will be patched to portable
    buildTime: new Date().toISOString(),
  };

  // Ensure directory exists
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`Distribution mode: ${config.mode} (written to ${configPath})`);
};
