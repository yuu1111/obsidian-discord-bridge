# Discord Bridge for Obsidian

[Japanese README](README-JP.md)

A powerful Obsidian plugin that creates a seamless bridge between Discord and your Obsidian vault. Automatically synchronize Discord messages to your notes and manage your vault directly from Discord commands.

## Features

### 🔄 **Message Synchronization**
- Automatically save Discord messages from specified channels to Obsidian notes
- Real-time message capturing with customizable target notes
- Automatic note creation if the target file doesn't exist

### 🎮 **Discord Slash Commands**
- `/setnote` - Set the target note path for saving Discord messages
- `/createnote` - Create new notes in your Obsidian vault from Discord
- `/listnote` - List all notes in your vault
- `/setchannel` - Configure which Discord channel to monitor
- `/outputnote` - Send Obsidian note contents to Discord

### 🌐 **Multi-Language Support**
- Full internationalization support with i18next
- Automatic language detection from Obsidian settings
- Currently supports English and Japanese
- Easy to extend for additional languages

### ⚡ **Robust Connection Management**
- Improved Discord client reconnection logic
- Automatic connection monitoring and recovery
- Prevents infinite reconnection loops
- Manual reconnection option via ribbon button

### 🔐 **Security & Permissions**
- Owner-only command execution for security
- Encrypted storage of bot tokens and client IDs
- Configurable channel and user restrictions

## Installation

### Manual Installation
1. Download the latest release from the [releases page](https://github.com/yuu1111/obsidian-discord-bridge/releases)
2. Extract the files to your vault's plugins folder: `VaultFolder/.obsidian/plugins/obsidian-discord-bridge-plugin/`
3. Reload Obsidian and enable the plugin in Settings > Community Plugins

### For Developers
```bash
# Clone the repository
git clone https://github.com/yuu1111/obsidian-discord-bridge.git
cd obsidian-discord-bridge

# Install dependencies
npm install

# Build the plugin
npm run build

# For development with hot reload
npm run dev
```

## Setup

### 1. Create a Discord Bot
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the **Bot Token** and **Client ID**
4. Enable the following bot permissions:
   - Send Messages
   - Use Slash Commands
   - Read Message History
   - View Channels

### 2. Configure the Plugin
1. Open Obsidian Settings > Community Plugins > Discord Bridge
2. Enter your **Bot Token** and **Client ID**
3. Set your **Discord User ID** (for command permissions)
4. Configure the **Target Channel ID** to monitor
5. Set the **Note Path** where Discord messages will be saved

### 3. Invite the Bot to Your Server
Use this URL format (replace `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

## Usage

### Basic Message Synchronization
1. Set up your bot token and channel ID in the plugin settings
2. Configure the target note path (e.g., `Discord/General`)
3. Messages from the monitored Discord channel will automatically appear in your specified note

### Discord Commands
All commands are available as Discord slash commands:

- **Set Note Path**: `/setnote path:Notes/Discord`
- **Create Note**: `/createnote name:Meeting Notes`
- **List Notes**: `/listnote`
- **Set Channel**: `/setchannel channel:#general`
- **Output Note**: `/outputnote note_path:Daily Notes`

### Advanced Features
- **Auto-completion**: Note paths auto-complete in Discord commands
- **Multi-language**: Plugin interface adapts to your Obsidian language setting
- **Reconnection**: Use the ribbon button to manually reconnect if needed

## Configuration

### Plugin Settings
| Setting | Description | Required |
|---------|-------------|----------|
| Bot Token | Your Discord bot's secret token | ✅ |
| Client ID | Your Discord application's client ID | ✅ |
| Owner User ID | Your Discord user ID (for command permissions) | ✅ |
| Target Channel ID | Discord channel to monitor for messages | ✅ |
| Note Path | Obsidian note path for saving messages (without .md) | ✅ |

### File Structure
```
your-vault/
├── .obsidian/
│   └── plugins/
│       └── obsidian-discord-bridge-plugin/
│           ├── main.js
│           ├── manifest.json
│           └── styles.css
└── Discord Messages.md  # Your configured note file
```

## Troubleshooting

### Common Issues

**Bot not responding to commands**
- Verify the bot token and client ID are correct
- Check that your Discord User ID matches the Owner User ID setting
- Ensure the bot has proper permissions in your Discord server

**Messages not being saved**
- Confirm the Target Channel ID is correct
- Check that the note path is valid and writable
- Verify the bot can see and read the configured channel

**Connection issues**
- Use the refresh button in Obsidian's ribbon to reconnect
- Check the console for detailed error messages
- Try restarting Obsidian if issues persist

### Debug Information
Enable developer tools in Obsidian (Ctrl+Shift+I) to view console logs for detailed troubleshooting information.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the build: `npm run build`
5. Submit a pull request

### Adding New Languages
1. Add translations to `src/i18n.ts`
2. Update the language detection logic if needed
3. Test with different language settings

## Changelog

### v1.1.0
- 🌐 Added full internationalization support with i18next
- 🔧 Improved Discord reconnection logic to prevent infinite loops
- 🏗️ Major code refactoring for better maintainability
- 🛡️ Enhanced error handling and connection stability
- 📝 Better autocomplete support for Discord commands
- 🎯 Fixed command option validation issues

### v1.0.0
- 🎉 Initial release
- ⚡ Basic Discord message synchronization
- 🎮 Discord slash commands
- 📁 Note management features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you find this plugin helpful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs or requesting features
- 💖 Supporting development through [GitHub Sponsors](https://github.com/sponsors/yuu1111)

---

**Note**: This plugin requires a Discord bot token and appropriate server permissions. Please follow Discord's Terms of Service and Bot Guidelines when using this plugin.