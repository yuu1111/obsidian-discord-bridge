#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { generateChangelog } from "./generate-changelog.mjs";

function validateVersion(version) {
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[0-9a-zA-Z-]*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*|[0-9a-zA-Z-]*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}

function runCommand(command, description) {
  console.log(`🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function updateVersionFiles(newVersion) {
  // Update package.json
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  packageJson.version = newVersion;
  writeFileSync("package.json", JSON.stringify(packageJson, null, "\t"));
  console.log(`✅ Updated package.json to version ${newVersion}`);

  // Update manifest.json
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
  const { minAppVersion } = manifest;
  manifest.version = newVersion;
  writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));
  console.log(`✅ Updated manifest.json to version ${newVersion}`);

  // Update versions.json
  const versions = JSON.parse(readFileSync("versions.json", "utf8"));
  versions[newVersion] = minAppVersion;
  writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
  console.log(`✅ Updated versions.json with ${newVersion} -> ${minAppVersion}`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error("❌ Please specify a version: npm run release <version>");
    console.error("   Example: npm run release 1.2.0");
    process.exit(1);
  }

  const newVersion = args[0];
  
  if (!validateVersion(newVersion)) {
    console.error(`❌ Invalid version format: ${newVersion}`);
    console.error("   Please use semantic versioning (e.g., 1.2.0)");
    process.exit(1);
  }

  console.log(`🚀 Starting release process for version ${newVersion}`);

  // Check if we're in a git repository
  if (!existsSync('.git')) {
    console.error("❌ Not in a git repository");
    process.exit(1);
  }

  // Check for uncommitted changes
  try {
    execSync('git diff --exit-code', { stdio: 'pipe' });
    execSync('git diff --cached --exit-code', { stdio: 'pipe' });
  } catch (error) {
    console.error("❌ Please commit all changes before releasing");
    process.exit(1);
  }

  // Run tests
  runCommand('npm run build', 'Building project');
  
  // Update version files
  updateVersionFiles(newVersion);

  // Generate changelog
  console.log('🔄 Generating changelog...');
  try {
    generateChangelog(newVersion);
    console.log('✅ Changelog generated successfully');
  } catch (error) {
    console.error('⚠️ Changelog generation failed:', error.message);
  }

  // Build again with new version
  runCommand('npm run build', 'Building with new version');

  // Create release package for local testing
  console.log('🔄 Creating release package for testing...');
  runCommand('mkdir -p dist', 'Creating dist directory');
  runCommand('cp main.js manifest.json styles.css dist/', 'Copying files to dist');
  runCommand(`cd dist && zip -r ../obsidian-discord-bridge-${newVersion}.zip .`, 'Creating test zip package');
  
  console.log(`✅ Test package created: obsidian-discord-bridge-${newVersion}.zip`);
  console.log('📁 Files in package:');
  runCommand(`unzip -l obsidian-discord-bridge-${newVersion}.zip`, 'Listing zip contents');

  // Create git commit and tag
  runCommand('git add .', 'Staging changes');
  runCommand(`git commit -m "chore: release v${newVersion}"`, 'Creating release commit');
  runCommand(`git tag v${newVersion}`, 'Creating git tag');

  console.log(`🎉 Release ${newVersion} prepared successfully!`);
  console.log(`📝 Next steps:`);
  console.log(`   1. Review the changes: git show`);
  console.log(`   2. Push to repository: git push && git push --tags`);
  console.log(`   3. Create GitHub release with tag v${newVersion}`);
}

main();