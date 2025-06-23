# Discord Bridge for Obsidian

[日本語README](README-JP.md)

**Turn your Discord conversations into organized Obsidian notes automatically.**

Ever wish you could save important Discord messages to your knowledge base? Or manage your Obsidian vault without leaving Discord? This plugin bridges the gap between your conversations and your notes.

## Features

### 💬 **Automatic Discord message saving**
- Automatically save messages from specified Discord channels to Obsidian notes
- Real-time message synchronization

### 🎮 **Discord slash commands**
- `/createnote` - Create new notes
- `/listnote` - Display note list
- `/outputnote` - Output note contents to Discord
- `/setnote` - Change message save destination

### 🔧 **Settings and security**
- Automatic reconnection functionality
- User ID authentication (only configured users can use commands)
- English and Japanese language support


## Quick Setup (5 minutes)

### Step 1: Get your Discord bot ready
1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → "New Application"
2. Create a bot and copy the **Bot Token** and **Application ID**
3. Invite the bot to your server with [this link](https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands) (replace YOUR_CLIENT_ID)

### Step 2: Configure the plugin
1. Install the plugin in Obsidian
2. Paste your **Bot Token** and **Client ID** in settings
3. Add your **Discord User ID** (right-click your name in Discord → Copy User ID)
4. Set which **channel** to monitor and which **note** to save to

That's it! Messages from your chosen channel will now appear in your Obsidian note.

## Available Commands

Type these in Discord after setup:

- `/setnote path:My Research Notes` - Change where messages are saved
- `/createnote name:Team Meeting Jan 15` - Create a new note
- `/listnote` - See all your notes
- `/outputnote note_path:Project Status` - Share a note with your Discord channel

## Installation

### Building from Source
```bash
# Clone the repository
git clone https://github.com/yuu1111/obsidian-discord-bridge.git
cd obsidian-discord-bridge

# Install dependencies
npm install

# Build the plugin
npm run build

# Copy build files to Obsidian plugin folder
# VaultFolder/.obsidian/plugins/obsidian-discord-bridge-plugin/
```

3. Restart Obsidian and enable in Settings

## Security & Privacy

**Data Handling:**
- Bot tokens and client IDs are stored locally in Obsidian with Base64 encoding
- No data is sent to external servers except Discord's official APIs
- Only messages from the configured channel are processed
- User authentication prevents unauthorized command usage

**Permissions:**
- The bot only requires minimal Discord permissions: Send Messages and Use Slash Commands
- Bot cannot read DMs unless explicitly configured
- Plugin operates entirely within your local Obsidian vault

**Best Practices:**
- Keep your bot token secure and never share it
- Regularly review configured channels and user permissions
- Use a dedicated Discord server for testing if needed

## Troubleshooting

**Bot doesn't respond to commands?**
- Make sure your Discord User ID matches what you put in settings
- Check the bot has permissions in your server

**Messages not saving?**
- Verify the channel ID is correct (right-click channel → Copy Channel ID)
- Make sure the note path exists or the plugin can create it

**Need help?**
- Check the console (Ctrl+Shift+I) for error messages
- Try the refresh button in Obsidian's toolbar
- [Report issues here](https://github.com/yuu1111/obsidian-discord-bridge/issues)

## Contributing

Found a bug or want a feature? [Open an issue](https://github.com/yuu1111/obsidian-discord-bridge/issues) or submit a pull request!

### Development Setup
1. Fork the repository
2. Clone to your local machine
3. Install dependencies: `npm install`
4. Start development build: `npm run dev`
5. Make your changes and test
6. Submit a pull request


## Support the Project

If this plugin is helpful:
- ⭐ Star the repository
- 🐛 Report bugs to help improve it

---

## Changelog

For detailed release notes and version history, see [CHANGELOG.md](CHANGELOG.md).

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

**Made with ❤️ for the Obsidian and Discord communities**