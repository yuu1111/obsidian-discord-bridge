# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Language**: When working in this repository, communicate with users in Japanese. Keep this CLAUDE.md file in English.

**Git Operations**: 
- ALWAYS ask for explicit user confirmation before running any git commit or git push commands
- Never commit or push changes without user approval, even if the user asks to "complete the task" or similar
- When ready to commit, present a summary of changes and ask: "これらの変更をコミット・プッシュしてもよろしいですか？"

## Development Commands

- `npm run dev` - Start development build with watch mode (uses esbuild)
- `npm run build` - Production build with TypeScript type checking and minification
- `npm run version` - Version bump script that updates manifest.json and versions.json
- `npm run release <version>` - Complete release process with version update, build, and git tagging

## Project Architecture

This is an Obsidian plugin that bridges Discord and Obsidian, enabling automatic message synchronization and remote note management via Discord slash commands.

### Core Components

**Main Plugin (`main.ts`)**
- `DiscordBridgePlugin` extends Obsidian's Plugin class
- Manages plugin lifecycle, settings, and UI integration
- Handles Obsidian-specific operations (file creation, reading, writing)
- Settings are Base64-encoded for sensitive data (bot tokens)

**Discord Manager (`src/discord-manager.ts`)**
- `DiscordManager` class handles all Discord operations
- Uses Discord.js v13 with specific intents for messages and guilds
- Implements automatic reconnection logic with rate limiting (max 3 attempts, 30s delay)
- Manages slash command registration and interaction handling
- Connection monitoring with 5-minute intervals

**Internationalization (`src/i18n.ts`)**
- Full i18next integration with English and Japanese support
- Auto-detects language from Obsidian's localStorage or moment.locale()
- All user-facing strings are localized
- Translation files embedded in the i18n.ts module

**Configuration (`src/types.ts`, `src/constants.ts`)**
- `PluginSettings` interface defines all configurable options
- `DISCORD_CONSTANTS` centralizes Discord API limits and intervals
- `DISCORD_COMMANDS` contains slash command names
- File validation regex for cross-platform compatibility

### Key Features

**Discord Slash Commands**
- `/setnote` - Change target note path (with autocomplete)
- `/createnote` - Create new notes with folder support
- `/listnote` - List all markdown files in vault
- `/outputnote` - Send note contents to Discord (with message splitting)
- `/setchannel` - Update monitored Discord channel

**Message Synchronization**
- Real-time message monitoring from specified Discord channel
- Automatic appending to target Obsidian note
- Creates notes/folders if they don't exist
- Only processes messages from non-bot users

**Security & Authentication**
- Owner-only command execution (Discord User ID validation)
- Bot token and client ID stored with Base64 encoding
- Proper permission checking for all Discord interactions

## Technical Implementation Details

**Build System**
- ESBuild configuration in `esbuild.config.mjs`
- Targets ES2022 with Node.js platform
- Bundles Discord.js while externalizing Obsidian APIs
- Comprehensive Node.js built-in module externalization
- Development mode includes inline source maps

**TypeScript Configuration**
- Strict mode enabled with ES2022 target
- Module resolution set to Node.js
- Includes DOM and ES2020 lib types
- Isolated modules for build performance

**Error Handling Patterns**
- Graceful degradation for Discord connection failures
- User notifications via Obsidian Notice system
- Console logging for debugging with internationalized messages
- Automatic retry logic for transient failures

**File Operations**
- Automatic `.md` extension handling
- Cross-platform path validation and sanitization
- Folder creation with proper error handling
- Large note content splitting for Discord message limits (1990 chars)

## Development Guidelines

**When making changes:**
1. Always run `npm run build` to ensure TypeScript compilation passes
2. Test both Discord connection and slash command functionality
3. Verify internationalization for any new user-facing strings
4. Check console for connection/error logs during testing

**Obsidian Plugin Guidelines Compliance:**
- Keep manifest description under 100 characters
- Ensure proper error handling with user-friendly messages
- Include security and privacy information in README
- Test offline behavior and network failures
- Follow Obsidian's API best practices
- Avoid blocking the main thread with heavy operations

**Adding new Discord commands:**
1. Add command name to `DISCORD_COMMANDS` in `src/constants.ts`
2. Add command handler in `DiscordManager.handleSlashCommand()`
3. Register command definition in `registerSlashCommands()`
4. Add internationalized strings to both language files in `src/i18n.ts`

**Modifying settings:**
1. Update `PluginSettings` interface in `src/types.ts`
2. Add setting UI in `SettingTab.display()` method in `main.ts`
3. Handle Base64 encoding for sensitive fields if needed
4. Update `DEFAULT_SETTINGS` appropriately

**File operations:**
- Use `ensureMarkdownExtension()` for consistent `.md` handling
- Follow existing path validation patterns with `INVALID_FILENAME_CHARS_REGEX`
- Always check if files/folders exist before creating
- Use Obsidian's vault API methods rather than Node.js fs

## Testing Notes

**Manual testing workflow:**
1. Build with `npm run build`
2. Copy `main.js`, `manifest.json`, and `styles.css` to Obsidian plugins folder
3. Configure Discord bot token, client ID, owner ID, and channel ID in settings
4. Test slash commands in Discord server where bot is added
5. Send messages to monitored channel to verify synchronization

**Discord Bot Setup Requirements:**
- Bot needs MESSAGE_CONTENT intent for message reading
- Requires GUILDS and GUILD_MESSAGES intents
- Slash commands need application.commands scope
- Bot must have Send Messages permission in target channels