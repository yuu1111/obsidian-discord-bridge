#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";

function getCommitsSinceLastTag(currentVersion) {
  try {
    // Get all tags sorted by version
    const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(tag => tag.startsWith('v'));
    
    const currentTag = `v${currentVersion}`;
    const lastTag = tags.find(tag => tag !== currentTag);
    
    if (!lastTag) {
      // If no previous tag, get all commits
      return execSync('git log --pretty=format:"%H|%s|%an|%ad" --date=short', { encoding: 'utf8' })
        .trim()
        .split('\n');
    }
    
    // Get commits since last tag
    return execSync(`git log ${lastTag}..HEAD --pretty=format:"%H|%s|%an|%ad" --date=short`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(line => line.length > 0);
  } catch (error) {
    console.error('Error getting commits:', error.message);
    return [];
  }
}

function parseCommit(commitLine) {
  const [hash, subject, author, date] = commitLine.split('|');
  
  // Parse conventional commit format
  const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?: (.+)$/;
  const match = subject.match(conventionalCommitRegex);
  
  if (match) {
    const [, type, scope, description] = match;
    return {
      hash: hash.substring(0, 7),
      type,
      scope: scope ? scope.slice(1, -1) : null,
      description,
      subject,
      author,
      date,
      isBreaking: subject.includes('BREAKING CHANGE') || subject.includes('!')
    };
  }
  
  // If not conventional commit, categorize as 'other'
  return {
    hash: hash.substring(0, 7),
    type: 'other',
    scope: null,
    description: subject,
    subject,
    author,
    date,
    isBreaking: false
  };
}

function categorizeCommits(commits) {
  const categories = {
    'breaking': [],
    'feat': [],
    'fix': [],
    'perf': [],
    'docs': [],
    'style': [],
    'refactor': [],
    'test': [],
    'chore': [],
    'ci': [],
    'build': [],
    'other': []
  };
  
  commits.forEach(commit => {
    if (commit.isBreaking) {
      categories.breaking.push(commit);
    } else {
      categories[commit.type].push(commit);
    }
  });
  
  return categories;
}

function generateReleaseNotes(version, categories) {
  let notes = `## [${version}] - ${new Date().toISOString().split('T')[0]}\n\n`;
  
  const sections = [
    { key: 'breaking', title: '💥 BREAKING CHANGES', emoji: '⚠️' },
    { key: 'feat', title: '✨ Features', emoji: '✨' },
    { key: 'fix', title: '🐛 Bug Fixes', emoji: '🐛' },
    { key: 'perf', title: '⚡ Performance Improvements', emoji: '⚡' },
    { key: 'docs', title: '📚 Documentation', emoji: '📚' },
    { key: 'style', title: '💄 Styles', emoji: '💄' },
    { key: 'refactor', title: '♻️ Code Refactoring', emoji: '♻️' },
    { key: 'test', title: '✅ Tests', emoji: '✅' },
    { key: 'chore', title: '🔧 Chores', emoji: '🔧' },
    { key: 'ci', title: '👷 CI/CD', emoji: '👷' },
    { key: 'build', title: '📦 Build System', emoji: '📦' }
  ];
  
  let hasContent = false;
  
  sections.forEach(section => {
    const commits = categories[section.key];
    if (commits && commits.length > 0) {
      notes += `### ${section.title}\n\n`;
      commits.forEach(commit => {
        const scope = commit.scope ? `**${commit.scope}**: ` : '';
        notes += `- ${scope}${commit.description} ([${commit.hash}](https://github.com/yuu1111/obsidian-discord-bridge/commit/${commit.hash}))\n`;
      });
      notes += '\n';
      hasContent = true;
    }
  });
  
  if (categories.other && categories.other.length > 0) {
    notes += `### 📝 Other Changes\n\n`;
    categories.other.forEach(commit => {
      notes += `- ${commit.description} ([${commit.hash}](https://github.com/yuu1111/obsidian-discord-bridge/commit/${commit.hash}))\n`;
    });
    notes += '\n';
    hasContent = true;
  }
  
  if (!hasContent) {
    notes += '- No notable changes\n\n';
  }
  
  return notes;
}

function updateChangelog(newReleaseNotes) {
  const changelogPath = 'CHANGELOG.md';
  let existingContent = '';
  
  if (existsSync(changelogPath)) {
    existingContent = readFileSync(changelogPath, 'utf8');
  } else {
    // Create new changelog with header
    existingContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
  }
  
  // Insert new release notes after the header
  const lines = existingContent.split('\n');
  const headerEndIndex = lines.findIndex(line => line.startsWith('## '));
  
  if (headerEndIndex === -1) {
    // No existing releases, append to end
    existingContent += newReleaseNotes;
  } else {
    // Insert new release at the beginning of releases
    lines.splice(headerEndIndex, 0, ...newReleaseNotes.split('\n'));
    existingContent = lines.join('\n');
  }
  
  writeFileSync(changelogPath, existingContent);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Please specify a version: node generate-changelog.mjs <version>');
    process.exit(1);
  }
  
  const version = args[0];
  console.log(`📝 Generating changelog for version ${version}...`);
  
  const commitLines = getCommitsSinceLastTag(version);
  
  if (commitLines.length === 0 || (commitLines.length === 1 && commitLines[0] === '')) {
    console.log('📝 No new commits found since last release');
    return '';
  }
  
  console.log(`📊 Found ${commitLines.length} commits since last release`);
  
  const commits = commitLines.map(parseCommit);
  const categories = categorizeCommits(commits);
  const releaseNotes = generateReleaseNotes(version, categories);
  
  updateChangelog(releaseNotes);
  console.log('✅ CHANGELOG.md updated successfully');
  
  return releaseNotes;
}

// Export for use in other scripts
export { main as generateChangelog, generateReleaseNotes, categorizeCommits, parseCommit };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}