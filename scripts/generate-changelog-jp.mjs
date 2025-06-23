#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";

function getCommitsSinceLastTag(currentVersion) {
  try {
    const tags = execSync('git tag --sort=-version:refname', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(tag => tag.startsWith('v'));
    
    const currentTag = `v${currentVersion}`;
    const lastTag = tags.find(tag => tag !== currentTag);
    
    if (!lastTag) {
      return execSync('git log --pretty=format:"%H|%s|%an|%ad" --date=short', { encoding: 'utf8' })
        .trim()
        .split('\n');
    }
    
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

function generateReleaseNotesJP(version, categories) {
  let notes = `## [${version}] - ${new Date().toISOString().split('T')[0]}\n\n`;
  
  const sections = [
    { key: 'breaking', title: '💥 破壊的変更', emoji: '⚠️' },
    { key: 'feat', title: '✨ 新機能', emoji: '✨' },
    { key: 'fix', title: '🐛 バグ修正', emoji: '🐛' },
    { key: 'perf', title: '⚡ パフォーマンス改善', emoji: '⚡' },
    { key: 'docs', title: '📚 ドキュメント', emoji: '📚' },
    { key: 'style', title: '💄 スタイル', emoji: '💄' },
    { key: 'refactor', title: '♻️ コードリファクタリング', emoji: '♻️' },
    { key: 'test', title: '✅ テスト', emoji: '✅' },
    { key: 'chore', title: '🔧 その他の変更', emoji: '🔧' },
    { key: 'ci', title: '👷 CI/CD', emoji: '👷' },
    { key: 'build', title: '📦 ビルドシステム', emoji: '📦' }
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
    notes += `### 📝 その他の変更\n\n`;
    categories.other.forEach(commit => {
      notes += `- ${commit.description} ([${commit.hash}](https://github.com/yuu1111/obsidian-discord-bridge/commit/${commit.hash}))\n`;
    });
    notes += '\n';
    hasContent = true;
  }
  
  if (!hasContent) {
    notes += '- 特記すべき変更はありません\n\n';
  }
  
  return notes;
}

function updateChangelogJP(newReleaseNotes) {
  const changelogPath = 'CHANGELOG-JP.md';
  let existingContent = '';
  
  if (existsSync(changelogPath)) {
    existingContent = readFileSync(changelogPath, 'utf8');
  } else {
    existingContent = `# 変更履歴

このプロジェクトの注目すべき変更は全てこのファイルに文書化されます。

フォーマットは [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) に基づいており、
このプロジェクトは [Semantic Versioning](https://semver.org/spec/v2.0.0.html) に準拠しています。

`;
  }
  
  const lines = existingContent.split('\n');
  const headerEndIndex = lines.findIndex(line => line.startsWith('## '));
  
  if (headerEndIndex === -1) {
    existingContent += newReleaseNotes;
  } else {
    lines.splice(headerEndIndex, 0, ...newReleaseNotes.split('\n'));
    existingContent = lines.join('\n');
  }
  
  writeFileSync(changelogPath, existingContent);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ バージョンを指定してください: node generate-changelog-jp.mjs <version>');
    process.exit(1);
  }
  
  const version = args[0];
  console.log(`📝 バージョン ${version} の日本語変更履歴を生成中...`);
  
  const commitLines = getCommitsSinceLastTag(version);
  
  if (commitLines.length === 0 || (commitLines.length === 1 && commitLines[0] === '')) {
    console.log('📝 前回のリリース以降の新しいコミットが見つかりません');
    return '';
  }
  
  console.log(`📊 前回のリリース以降 ${commitLines.length} 件のコミットが見つかりました`);
  
  const commits = commitLines.map(parseCommit);
  const categories = categorizeCommits(commits);
  const releaseNotes = generateReleaseNotesJP(version, categories);
  
  updateChangelogJP(releaseNotes);
  console.log('✅ CHANGELOG-JP.md が正常に更新されました');
  
  return releaseNotes;
}

// Export for use in other scripts
export { main as generateChangelogJP, generateReleaseNotesJP, categorizeCommits, parseCommit };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}