import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { Client, Intents, TextChannel, Interaction, CommandInteraction} from 'discord.js';
import {EmbedBuilder} from "@discordjs/builders";


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
			if (this.settings.botToken && (!this.discordClient || !this.discordClient.isReady())) {
				console.log('Discord client detected as disconnected or not ready. Attempting to re-initialize.');
				new Notice('Discord client disconnected. Attempting to re-initialize...');
				if (this.discordClient) {
					this.discordClient.destroy();
					this.discordClient = null;
				}
				this.initializeDiscordClient();
			}
		}, 5 * 60 * 1000));
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
			if (this.settings.clientId && (!this.discordClient.application?.commands.cache.size || this.discordClient.application?.commands.cache.size < 3)) { // コマンド数が少ない場合も再登録
				console.log('Registering slash commands as they might be missing or incomplete.');
				this.registerSlashCommands();
			}
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
			if (this.settings.clientId) {
				this.registerSlashCommands();
			} else {
				new Notice('Client ID is not set. Slash commands will not be registered.');
				console.warn('Client ID is not set. Skipping slash command registration on ready.');
			}
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

			let channelDisplayName = 'Direct Message';
			if (message.channel instanceof TextChannel) {
				channelDisplayName = message.channel.name;
			}

			if (this.settings.channelId && message.channel.id === this.settings.channelId) {
				console.log(`Received message in target channel: ${message.content}`);
				await this.saveMessageToObsidianNote(message.content, message.author.username, channelDisplayName);
			}
		});

		this.discordClient.on('interactionCreate', async (interaction: Interaction) => {
			if (!interaction.isCommand()) return;

			if (this.settings.ownerId && interaction.user.id !== this.settings.ownerId) {
				await interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
				return;
			}

			const commandInteraction = interaction as CommandInteraction;

			switch (commandInteraction.commandName) {
				case 'setnote':
					const pathOption = commandInteraction.options.getString('path', true);
					await this.updateTargetNote(pathOption, commandInteraction);
					break;
				case 'createnote':
					const nameOption = commandInteraction.options.getString('name', true);
					await this.createNewNote(nameOption, commandInteraction);
					break;
				case 'listnotes':
					await this.listObsidianNotes(commandInteraction);
					break;
				default:
					await commandInteraction.reply({ content: 'Unknown command.', ephemeral: true });
					break;
			}
		});
	}

	/**
	 * Discordスラッシュコマンドを登録します。
	 */
	private async registerSlashCommands() {
		if (!this.discordClient || !this.discordClient.application?.id) {
			console.error('Discord client not ready or application ID not available for command registration.');
			return;
		}
		if (!this.settings.clientId) {
			new Notice('Client ID is not set. Cannot register slash commands.');
			console.error('Client ID is missing, cannot register slash commands.');
			return;
		}

		const commands = [
			{
				name: 'setnote',
				description: 'Set the target Obsidian note path for Discord messages.',
				options: [
					{
						name: 'path',
						description: 'The full path to the Obsidian note (e.g., `Notes/Discord Inbox.md`).',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: 'createnote',
				description: 'Create a new Obsidian note and set it as the target.',
				options: [
					{
						name: 'name',
						description: 'The name of the new Obsidian note (e.g., `Daily Discord Log`).',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: 'listnotes',
				description: 'List all Markdown notes in your Obsidian vault.',
			},
		];

		try {
			await this.discordClient.application.commands.set(commands);
			new Notice('Slash commands registered successfully!');
			console.log('Slash commands registered:', commands);
		} catch (error) {
			console.error('Failed to register slash commands:', error);
			new Notice(`Failed to register slash commands: ${error.message}`);
		}
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
				return;
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
	 * @param interaction Discordメッセージオブジェクト（応答用）
	 */
	private async updateTargetNote(newPath: string, interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		if (!newPath || newPath.length > 255) {
			await interaction.editReply('Invalid note path provided. Please provide a valid path (e.g., `MyFolder/MyNote.md`).');
			return;
		}

		this.settings.targetNotePath = newPath;
		await this.saveSettings();

		await interaction.editReply(`Obsidian target note path updated to: \`${newPath}\`.`);

		new Notice(`Obsidian target note path updated to: ${newPath}`);
		console.log(`Obsidian target note path updated to: ${newPath}`);
	}


	private async createNewNote(noteName: string, interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		const sanitizedNoteName = noteName.replace(/[\\/:*?"<>|]/g, '');
		if (!sanitizedNoteName) {
			await interaction.editReply('Invalid note name provided.');
			return;
		}
		const newPath = `${sanitizedNoteName}.md`;

		try {
			if (this.app.vault.getAbstractFileByPath(newPath)) {
				await interaction.editReply(`Note \`${newPath}\` already exists. Use \`/setnote\` to select it.`);
				new Notice(`Note already exists: ${newPath}`);
				return;
			}

			const file = await this.app.vault.create(newPath, '');
			await interaction.editReply(`New note \`${newPath}\` created in Obsidian. Setting it as current target.`);
			new Notice(`Created new note: ${newPath}`);
			console.log(`Created new note: ${newPath}`);

			await this.updateTargetNote(newPath, interaction);
		} catch (error) {
			console.error('Failed to create new note:', error);
			await interaction.editReply(`Failed to create note \`${newPath}\`. Error: ${error.message}`);
			new Notice(`Error creating note: ${error.message}`);
		}
	}
	/**
	 * Discordコマンドに応じてObsidian Vault内のノートリストをDiscordに送信します。
	 * @param interaction Discordコマンドインタラクションオブジェクト（応答用）
	 */
	private async listObsidianNotes(interaction: CommandInteraction) {
		await interaction.deferReply({ ephemeral: true });

		const files = this.app.vault.getMarkdownFiles();
		let fileList = files.map(file => `- ${file.path}`).join('\n');

		if (fileList.length === 0) {
			fileList = "No Markdown notes found in your Vault.";
		} else if (fileList.length > 1800) {
			fileList = fileList.substring(0, 1800) + '\n... (truncated)';
		}

		try {
			const embed = new EmbedBuilder()
				.setColor(0x0099FF)
				.setTitle('Obsidian Notes in Vault')
				.setDescription(`\`\`\`\n${fileList}\n\`\`\`\n\n**Currently saving to:** \`${this.settings.targetNotePath}\``);

			await interaction.editReply({ embeds: [embed] }); // 最終応答
		} catch (error) {
			console.error('Failed to send note list to Discord:', error);
			await interaction.editReply('Failed to retrieve note list. Check console for errors.'); // エラー応答
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
			.setDesc('Your Discord user ID.')
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

