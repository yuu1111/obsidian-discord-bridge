import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { Client, Intents, TextChannel, DMChannel } from 'discord.js';

interface PluginSettings {
	botToken: string,
	clientId: string,
	ownerId: string,
	channelId: string,
	targetNotePath: string
}

const DEFAULT_SETTINGS: PluginSettings = {
	botToken: "",
	clientId: "",
	ownerId: "",
	channelId: "",
	targetNotePath: "Discord_Messages.md"
}

export default class MyPlugin extends Plugin {
	settings: PluginSettings;
	private discordClient: Client | null = null;
	private statusBarItem: HTMLElement;

	async onload() {
		await this.loadSettings();

		this.initializeDiscordClient();

		const ribbonIconEl = this.addRibbonIcon('refresh-ccw', 'Refresh Discord Connection', async () => {
			new Notice('Attempting to re-initialize Discord client...');
			if (this.discordClient) {
				this.discordClient.destroy();
				this.discordClient = null;
			}
			await this.initializeDiscordClient();
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar('Discord: Disconnected');

		this.addSettingTab(new SettingTab(this.app, this));

		this.registerInterval(window.setInterval(() => {
			// ボットが落ちてしまっていたら再起動を試みる
			if (!this.discordClient || !this.discordClient.isReady()) {
				console.log('Discord client detected as disconnected or not ready. Attempting to re-initialize.');
				new Notice('Discord client disconnected. Attempting to re-initialize...');
				this.initializeDiscordClient();
			}
		}, 5 * 60 * 1000)); // 5分ごとにチェック (5 * 60 * 1000 ミリ秒)
	}

	onunload() {
		if (this.discordClient) {
			this.discordClient.destroy();
			console.log('Discord client destroyed.');
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (this.settings.botToken) {
			this.settings.botToken = atob(this.settings.botToken);
		}
		if (this.settings.clientId) {
			this.settings.clientId = atob(this.settings.clientId);
		}
	}

	async saveSettings() {
		const settingsToSave = { ...this.settings };
		if (settingsToSave.botToken) {
			settingsToSave.botToken = btoa(settingsToSave.botToken);
		}
		if (settingsToSave.clientId) {
			settingsToSave.clientId = btoa(settingsToSave.clientId);
		}
		await this.saveData(settingsToSave);
	}

	/**
	 * Discord クライアントを初期化し、ログインを試みます。
	 */
	private async initializeDiscordClient() {
		if (this.discordClient && this.discordClient.isReady()) {
			console.log('Discord client already initialized and ready.');
			return;
		}

		if (!this.settings.botToken) {
			new Notice('Bot Token is not set in plugin settings. Please configure it.');
			this.updateStatusBar('Discord: No Token');
			return;
		}

		this.discordClient = new Client({
			intents: [
				Intents.FLAGS.GUILDS,
				Intents.FLAGS.GUILD_MESSAGES,
				Intents.FLAGS.MESSAGE_CONTENT,
				Intents.FLAGS.DIRECT_MESSAGES,
			],
			partials: ['CHANNEL'],
		});

		this.discordClient.once('ready', () => {
			console.log(`Logged in as ${this.discordClient?.user?.tag}!`);
			new Notice(`Logged in as ${this.discordClient?.user?.tag}!`);
			this.updateStatusBar(`Discord: Connected (${this.discordClient?.user?.tag})`);
			this.setupDiscordListeners();
		});

		this.discordClient.on('error', (error) => {
			console.error('Discord client error:', error);
			new Notice(`Discord client error: ${error.message}`);
			this.updateStatusBar('Discord: Error');
		});

		this.discordClient.on('shardDisconnect', (event) => {
			console.warn('Discord client disconnected:', event.reason);
			new Notice('Discord client disconnected.');
			this.updateStatusBar('Discord: Disconnected');
		});

		this.discordClient.on('shardReconnecting', () => {
			console.log('Discord client reconnecting...');
			new Notice('Discord client reconnecting...');
			this.updateStatusBar('Discord: Reconnecting...');
		});

		try {
			await this.discordClient.login(this.settings.botToken);
		} catch (error) {
			console.error('Failed to log in to Discord:', error);
			new Notice(`Failed to log in to Discord: ${error.message}`);
			this.updateStatusBar('Discord: Login Failed');
		}
	}

	/**
	 * ステータスバーの表示を更新します。
	 * @param text 表示するテキスト
	 */
	private updateStatusBar(text: string) {
		this.statusBarItem.setText(text);
	}

	/**
	 * Discord クライアントのイベントリスナーを設定します。
	 */
	private setupDiscordListeners() {
		if (!this.discordClient) return;

		this.discordClient.on('messageCreate', async message => {
			if (message.author.bot) return;

			let channelDisplayName = 'Direct Message'; // DMの場合のデフォルト名

			if (message.channel instanceof TextChannel) {
				channelDisplayName = message.channel.name;
			}
			if (this.settings.channelId && message.channel.id === this.settings.channelId) {
				console.log(`Received message in target channel: ${message.content}`);
				await this.saveMessageToObsidianNote(message.content, message.author.username, channelDisplayName);
			}
			if (this.settings.ownerId && message.author.id === this.settings.ownerId) {
				if (message.content.startsWith('!setnote ')) {
					const args = message.content.slice('!setnote '.length).trim();
					const notePath = args.endsWith('.md') ? args : `${args}.md`; // .md拡張子を自動追加
					await this.updateTargetNote(notePath, message);
				} else if (message.content.startsWith('!createnote ')) {
					const noteName = message.content.slice('!createnote '.length).trim();
					await this.createNewNote(noteName, message);
				} else if (message.content === '!listnotes') {
					await this.listObsidianNotes(message);
				}
			}
		});
	}

	/**
	 * DiscordメッセージをObsidianノートに保存します。
	 * @param content メッセージの内容
	 * @param author メッセージの送信者名
	 * @param channelName メッセージが送信されたチャンネル名
	 */
	private async saveMessageToObsidianNote(content: string, author: string, channelName: string) {
		const targetFilePath = this.settings.targetNotePath;

		let file = this.app.vault.getAbstractFileByPath(targetFilePath);

		if (!file || !(file instanceof TFile)) {
			try {
				file = await this.app.vault.create(targetFilePath, '');
				new Notice(`Created new note for Discord messages: ${targetFilePath}`);
				console.log(`Created new note: ${targetFilePath}`);
			} catch (error) {
				console.error(`Failed to create note ${targetFilePath}:`, error);
				new Notice(`Error creating note ${targetFilePath}: ${error.message}`);
				return; // ファイル作成失敗時は処理を中断
			}
		}

		if (file instanceof TFile) {
			const timestamp = new Date().toLocaleString();
			const messageToSave = `\n---\n**[${timestamp}] ${author} in #${channelName}:**\n${content}\n`;
			await this.app.vault.append(file, messageToSave);
			console.log(`Message saved to ${targetFilePath}`);
		} else {
			console.error('Failed to get or create target file for Discord messages.');
			new Notice('Error: Could not save Discord message to note.');
		}
	}

	/**
	 * Discordコマンドに応じてObsidianの保存先ノートパスを更新します。
	 * @param newPath 新しいノートパス
	 * @param message Discordメッセージオブジェクト（応答用）
	 */
	private async updateTargetNote(newPath: string, message: any) {
		if (!newPath || newPath.length > 255) {
			if (message.channel instanceof TextChannel || message.channel instanceof DMChannel) {
				message.channel.send('Invalid note path provided. Please provide a valid path (e.g., `MyFolder/MyNote.md`).');
			}
			return;
		}

		this.settings.targetNotePath = newPath;
		await this.plugin.saveSettings();

		if (message.channel instanceof TextChannel || message.channel instanceof DMChannel) {
			message.channel.send(`Saving new messages to \`${newPath}\`.`);
		}
		new Notice(`Obsidian target note path updated to: ${newPath}`);
		console.log(`Obsidian target note path updated to: ${newPath}`);
	}

	/**
	 * Discordコマンドに応じてObsidianに新しいノートを作成します。
	 * @param noteName 新しいノート名 (拡張子なしでも可)
	 * @param message Discordメッセージオブジェクト（応答用）
	 */
	private async createNewNote(noteName: string, message: any) {
		const sanitizedNoteName = noteName.replace(/[\\/:*?"<>|]/g, ''); // ファイル名として無効な文字をサニタイズ
		if (!sanitizedNoteName) {
			if (message.channel instanceof TextChannel || message.channel instanceof DMChannel) {
				message.channel.send('Invalid note name provided.');
			}
			return;
		}
		const newPath = `${sanitizedNoteName}.md`;

		try {
			// ノートが既に存在するか確認
			if (this.app.vault.getAbstractFileByPath(newPath)) {
				if (message.channel instanceof TextChannel || message.channel instanceof DMChannel) {
					message.channel.send(`Note \`${newPath}\` already exists. Use \`!setnote\` to select it.`);
				}
				new Notice(`Note already exists: ${newPath}`);
				return;
			}

			const file = await this.app.vault.create(newPath, '');
			if (message.channel instanceof TextChannel || message.channel instanceof DMChannel) {
				message.channel.send(`New note \`${newPath}\` created in Obsidian. Setting it as current target.`);
			}
			new Notice(`Created new note: ${newPath}`);
			console.log(`Created new note: ${newPath}`);

			await this.updateTargetNote(newPath, message);

		} catch (error) {
			console.error('Failed to create new note:', error);
			if (message.channel instanceof TextChannel || message.channel instanceof DMChannel) {
				message.channel.send(`Failed to create note \`${newPath}\`. Error: ${error.message}`);
			}
			new Notice(`Error creating note: ${error.message}`);
		}
	}

	/**
	 * Discordコマンドに応じてObsidian Vault内のノートリストをDiscordに送信します。
	 * @param message Discordメッセージオブジェクト（応答用）
	 */
	private async listObsidianNotes(message: any) {
		if (!(message.channel instanceof TextChannel || message.channel instanceof DMChannel)) return;

		const files = this.app.vault.getMarkdownFiles();
		let fileList = files.map(file => `- ${file.path}`).join('\n');

		if (fileList.length === 0) {
			fileList = "No Markdown notes found in your Vault.";
		} else if (fileList.length > 1900) {
			fileList = fileList.substring(0, 1900) + '\n... (truncated)';
		}

		try {
			await message.channel.send(`**Obsidian Notes in Vault:**\n\`\`\`\n${fileList}\n\`\`\`\nCurrently saving to: \`${this.settings.targetNotePath}\``);
		} catch (error) {
			console.error('Failed to send note list to Discord:', error);
			message.channel.send('Failed to retrieve note list. Check console for errors.');
		}
	}
}

class SettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Discord Bridge Plugin Settings' });

		new Setting(containerEl)
			.setName('Bot Token')
			.setDesc('This token will be stored in Base64 format, but this is not for security purposes.')
			.addText(text => text
				.setPlaceholder('Enter your Discord Bot Token')
				.setValue(this.plugin.settings.botToken)
				.onChange(async (value) => {
					this.plugin.settings.botToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Client ID')
			.setDesc('This ID will be stored in Base64 format, but this is not for security purposes.')
			.addText(text => text
				.setPlaceholder('Enter your Discord Bot Client ID')
				.setValue(this.plugin.settings.clientId)
				.onChange(async (value) => {
					this.plugin.settings.clientId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Target Channel ID')
			.setDesc('The ID of the Discord channel where messages will be monitored for saving to Obsidian.')
			.addText(text => text
				.setPlaceholder('Enter your Discord Channel ID')
				.setValue(this.plugin.settings.channelId)
				.onChange(async (value) => {
					this.plugin.settings.channelId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Owner User ID')
			.setDesc('Your Discord user ID. Commands like `!setnote` and `!createnote` will only be processed from this user.')
			.addText(text => text
				.setPlaceholder('Enter your Discord user ID')
				.setValue(this.plugin.settings.ownerId)
				.onChange(async (value) => {
					this.plugin.settings.ownerId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Obsidian Target Note Path')
			.setDesc('The path to the Markdown file in your Obsidian vault where Discord messages will be appended (e.g., `Notes/Discord Inbox.md`).')
			.addText(text => text
				.setPlaceholder('Discord_Messages.md')
				.setValue(this.plugin.settings.targetNotePath)
				.onChange(async (value) => {
					this.plugin.settings.targetNotePath = value;
					await this.plugin.saveSettings();
				}));
	}
}

