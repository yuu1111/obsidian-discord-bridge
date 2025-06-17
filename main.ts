import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import { Client, Intents, TextChannel, Interaction, CommandInteraction, Constants } from 'discord.js';


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
	targetNotePath: "Discord_Messages"
}

export default class MyPlugin extends Plugin {
	settings: PluginSettings;
	private discordClient: Client | null = null;
	private statusBarItem: HTMLElement;

	async onload() {
		await this.loadSettings();

		this.initializeDiscordClient();

		const ribbonIconEl = this.addRibbonIcon('refresh-ccw', 'Discord接続を更新', async () => {
			new Notice('Discordクライアントの再初期化を試行中...');
			if (this.discordClient) {
				this.discordClient.destroy();
				this.discordClient = null;
			}
			await this.initializeDiscordClient();
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar('Discord: 未接続');

		this.addSettingTab(new SettingTab(this.app, this));

		this.registerInterval(window.setInterval(() => {
			if (this.settings.botToken &&
				(!this.discordClient ||
					(this.discordClient && this.discordClient.status === Constants.Status.DISCONNECTED))
			) {
				console.log('Discordクライアントが完全に切断された状態を検知 再初期化を試行中');
				new Notice('Discordクライアントが切断されました 再初期化を試行中...');
				if (this.discordClient) {
					this.discordClient.destroy();
					this.discordClient = null;
				}
				this.initializeDiscordClient();
			} else if (this.discordClient && this.discordClient.status === Constants.Status.RECONNECTING) {
				console.log('Discordクライアントは現在再接続中です 手動での再初期化はスキップします');
			}
		}, 5 * 60 * 1000)); // 5分ごとにチェック
	}

	onunload() {
		if (this.discordClient) {
			this.discordClient.destroy();
			console.log('Discordクライアントが破棄されました');
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
		const settingsToSave = {...this.settings};
		if (settingsToSave.botToken) {
			settingsToSave.botToken = btoa(settingsToSave.botToken);
		}
		if (settingsToSave.clientId) {
			settingsToSave.clientId = btoa(settingsToSave.clientId);
		}
		await this.saveData(settingsToSave);
	}

	/**
	 * Discord クライアントを初期化し、ログインを試みる
	 */
	private async initializeDiscordClient() {
		if (this.discordClient && this.discordClient.isReady()) {
			console.log('Discordクライアントは既に初期化され、準備ができています');
			return;
		}

		if (!this.settings.botToken) {
			new Notice('ボットトークンがプラグイン設定で設定されていません 設定してください');
			this.updateStatusBar('Discord: トークンなし');
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

		this.discordClient.once('ready', async () => {
			console.log(`${this.discordClient?.user?.tag}としてログインしました！`);
			new Notice(`${this.discordClient?.user?.tag}としてログインしました！`);
			this.updateStatusBar(`Discord: 接続済み (${this.discordClient?.user?.tag})`);
			this.setupDiscordListeners();
			if (this.settings.clientId) {
				await this.registerSlashCommands();
			} else {
				new Notice('クライアントIDが設定されていません スラッシュコマンドは登録されません');
				console.warn('クライアントIDが設定されていません readyイベントでのスラッシュコマンド登録をスキップします');
			}
		});

		this.discordClient.on('error', (error) => {
			console.error('Discordクライアントエラー:', error);
			new Notice(`Discordクライアントエラー: ${error.message}`);
			this.updateStatusBar('Discord: エラー');
		});

		this.discordClient.on('shardDisconnect', (event) => {
			console.warn('Discordクライアントが切断されました:', event.reason);
			new Notice('Discordクライアントが切断されました');
			this.updateStatusBar('Discord: 未接続');
		});

		this.discordClient.on('shardReconnecting', () => {
			console.log('Discordクライアントが再接続中...');
			new Notice('Discordクライアントが再接続中...');
			this.updateStatusBar('Discord: 再接続中...');
		});

		try {
			await this.discordClient.login(this.settings.botToken);
		} catch (error) {
			console.error('Discordへのログインに失敗しました:', error);
			// @ts-ignore
			new Notice(`Discordへのログインに失敗しました: ${error.message}`);
			this.updateStatusBar('Discord: ログイン失敗');
		}
	}

	/**
	 * ステータスバーの表示を更新する
	 * @param text 表示するテキスト
	 */
	private updateStatusBar(text: string) {
		this.statusBarItem.setText(text);
	}

	/**
	 * Discord クライアントのイベントリスナーを設定する
	 */
	private setupDiscordListeners() {
		if (!this.discordClient) return;

		this.discordClient.on('messageCreate', async message => {
			if (message.author.bot) return;

			let channelDisplayName = 'ダイレクトメッセージ';
			if (message.channel instanceof TextChannel) {
				channelDisplayName = message.channel.name;
			}

			if (this.settings.channelId && message.channel.id === this.settings.channelId) {
				console.log(`ターゲットチャンネルでメッセージを受信しました: ${message.content}`);
				await this.saveMessageToObsidianNote(message.content, message.author.username, channelDisplayName);
			}
		});

		this.discordClient.on('interactionCreate', async (interaction: Interaction) => {
			if (!interaction.isCommand()) return;

			if (this.settings.ownerId && interaction.user.id !== this.settings.ownerId) {
				await interaction.reply({content: 'このコマンドを使用する権限がありません', ephemeral: true});
				return;
			}

			const commandInteraction = interaction as CommandInteraction;

			switch (commandInteraction.commandName) {
				case 'setnote':
					// eslint-disable-next-line no-case-declarations
					const pathOption = commandInteraction.options.getString('path', true);
					await commandInteraction.deferReply();
					await this.updateTargetNote(pathOption, commandInteraction);
					break;
				case 'createnote':
					// eslint-disable-next-line no-case-declarations
					const nameOption = commandInteraction.options.getString('name', true);
					await this.createNewNote(nameOption, commandInteraction);
					break;
				case 'listnotes':
					await this.listObsidianNotes(commandInteraction);
					break;
				case 'setchannel':
					// eslint-disable-next-line no-case-declarations
					const channelOption = commandInteraction.options.getChannel('channel', true);
					await commandInteraction.deferReply();
					await this.updateTargetChannel(channelOption.id, commandInteraction);
					break;
				case 'outputnote':
					// eslint-disable-next-line no-case-declarations
					const notePathOption = commandInteraction.options.getString('note_path', true);
					await commandInteraction.deferReply();
					await this.outputObsidianNote(notePathOption, commandInteraction);
					break;
				default:
					await commandInteraction.reply({content: '不明なコマンドです', ephemeral: true});
					break;
			}
		});
	}

	/**
	 * Discordスラッシュコマンドを登録する
	 */
	private async registerSlashCommands() {
		if (!this.discordClient || !this.discordClient.application?.id) {
			console.error('Discordクライアントが準備できていないか、アプリケーションIDがコマンド登録に利用できません');
			return;
		}
		if (!this.settings.clientId) {
			new Notice('クライアントIDが設定されていません スラッシュコマンドを登録できません');
			console.error('クライアントIDが不足しています スラッシュコマンドを登録できません');
			return;
		}

		const commands = [
			{
				name: 'setnote',
				description: 'Discordメッセージを保存するObsidianノートのパスを設定します',
				options: [
					{
						name: 'path',
						description: 'Obsidianノートのフルパス(例: `Notes/Discord Inbox.md`)',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: 'createnote',
				description: '新しいObsidianノートを作成します フォルダ階層を含めることも可能です',
				options: [
					{
						name: 'name',
						description: '新しいObsidianノートのパスと名前(例: `フォルダ名/新しいノート`)',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: 'listnotes',
				description: 'Obsidian Vault内のすべてのMarkdownノートをリスト表示します',
			},
			{
				name: 'setchannel',
				description: 'DiscordメッセージをObsidianに保存するターゲットチャンネルを設定します',
				options: [
					{
						name: 'channel',
						description: 'メッセージを監視するチャンネル',
						type: 7, // CHANNEL type
						required: true,
					},
				],
			},
			{
				name: 'outputnote',
				description: '指定したObsidianノートの内容をDiscordに出力します',
				options: [
					{
						name: 'note_path',
						description: '出力したいObsidianノートのパス(例: `My Folder/My Note`)',
						type: 3,
						required: true,
					},
				],
			},
		];

		try {
			await this.discordClient.application.commands.set(commands);
			new Notice('スラッシュコマンドが正常に登録されました！');
			console.log('スラッシュコマンドが登録されました:', commands);
		} catch (error) {
			console.error('スラッシュコマンドの登録に失敗しました:', error);
			// @ts-ignore
			new Notice(`スラッシュコマンドの登録に失敗しました: ${error.message}`);
		}
	}

	/**
	 * 指定されたパスに.md拡張子を補完する
	 * @param path 補完するパス
	 * @returns .md拡張子が付与されたパス
	 */
	private ensureMarkdownExtension(path: string): string {
		if (!path.endsWith('.md')) {
			return `${path}.md`;
		}
		return path;
	}

	/**
	 * DiscordメッセージをObsidianノートに保存する
	 * @param content メッセージの内容
	 * @param author メッセージの送信者名
	 * @param channelName メッセージが送信されたチャンネル名
	 */
	private async saveMessageToObsidianNote(content: string, author: string, channelName: string) {
		const targetFilePath = this.ensureMarkdownExtension(this.settings.targetNotePath);

		let file = this.app.vault.getAbstractFileByPath(targetFilePath);

		if (!file || !(file instanceof TFile)) {
			try {
				file = await this.app.vault.create(targetFilePath, '');
				new Notice(`Discordメッセージ用の新しいノートを作成しました: ${targetFilePath}`);
				console.log(`新しいノートを作成しました: ${targetFilePath}`);
			} catch (error) {
				console.error(`ノート ${targetFilePath} の作成に失敗しました:`, error);
				// @ts-ignore
				new Notice(`エラー: ノート ${targetFilePath} の作成に失敗しました: ${error.message}`);
				return;
			}
		}

		if (file instanceof TFile) {
			const timestamp = new Date().toLocaleString();
			const messageToSave = `\n---\n**[${timestamp}] ${author} in #${channelName}:**\n${content}\n`;
			await this.app.vault.append(file, messageToSave);
			console.log(`メッセージを ${targetFilePath} に保存しました`);
		} else {
			console.error('Discordメッセージの保存先ファイルが見つからないか、作成できませんでした');
			new Notice('エラー: Discordメッセージをノートに保存できませんでした');
		}
	}

	/**
	 * Discordコマンドに応じてObsidianの保存先ノートパスを更新する
	 * @param newPath 新しいノートパス
	 * @param interaction Discordコマンドインタラクションオブジェクト(応答用)
	 */
	private async updateTargetNote(newPath: string, interaction: CommandInteraction) {

		const finalPath = this.ensureMarkdownExtension(newPath);

		if (!finalPath || finalPath.length > 255) {
			await interaction.editReply('無効なノートパスが指定されました 有効なパスを指定してください(例: `フォルダ名/ノート名.md`)');
			return;
		}

		this.settings.targetNotePath = newPath;
		await this.saveSettings();

		await interaction.editReply(`Obsidianのターゲットノートパスを \`${finalPath}\` に更新しました`);

		new Notice(`Obsidianのターゲットノートパスを更新しました: ${finalPath}`);
		console.log(`Obsidianのターゲットノートパスを更新しました: ${finalPath}`);
	}


	/**
	 * Discordコマンドに応じてObsidianに新しいノートを作成する
	 * @param noteName 新しいノートの名前(フォルダ階層を含む場合も)
	 * @param interaction Discordコマンドインタラクションオブジェクト(応答用)
	 */
	private async createNewNote(noteName: string, interaction: CommandInteraction) {
		await interaction.deferReply();

		const INVALID_FILENAME_CHARS_EXCEPT_SLASH_AND_BACKSLASH_REGEX = /[<>:"|?*]/g;
		const sanitizedNoteName = noteName.replace(INVALID_FILENAME_CHARS_EXCEPT_SLASH_AND_BACKSLASH_REGEX, '');

		if (!sanitizedNoteName) {
			await interaction.editReply('無効なノート名が指定されました');
			return;
		}

		let fullPath: string;
		const lastSlashIndex = sanitizedNoteName.lastIndexOf('/');

		if (lastSlashIndex !== -1) {
			const folderPath = sanitizedNoteName.substring(0, lastSlashIndex);
			const fileName = sanitizedNoteName.substring(lastSlashIndex + 1);

			if (!fileName) {
				await interaction.editReply('無効なパスです ファイル名を指定してください');
				return;
			}
			fullPath = this.ensureMarkdownExtension(`${folderPath}/${fileName}`);

			// フォルダが存在しない場合は作成
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder || !(folder instanceof TFolder)) {
				try {
					await this.app.vault.createFolder(folderPath);
					new Notice(`フォルダを作成しました: ${folderPath}`);
					console.log(`フォルダを作成しました: ${folderPath}`);
				} catch (folderError) {
					console.error(`フォルダ ${folderPath} の作成に失敗しました:`, folderError);
					// @ts-ignore
					await interaction.editReply(`フォルダ \`${folderPath}\` の作成に失敗しましたエラー: ${folderError.message}`);
					// @ts-ignore
					new Notice(`エラー: フォルダの作成に失敗しました: ${folderError.message}`);
					return;
				}
			}
		} else {
			fullPath = this.ensureMarkdownExtension(sanitizedNoteName);
		}

		try {
			if (this.app.vault.getAbstractFileByPath(fullPath)) {
				// @ts-ignore
				await interaction.editReply(`ノート \`${fullPath}\` は既に存在します` / setnote` コマンドで選択してください`);
				new Notice(`ノートは既に存在します: ${fullPath}`);
				return;
			}

			const file = await this.app.vault.create(fullPath, '');
			await interaction.editReply(`新しいノート \`${fullPath}\` をObsidianに作成しました`);
			new Notice(`新しいノートを作成しました: ${fullPath}`);
			console.log(`新しいノートを作成しました: ${fullPath}`);

		} catch (error) {
			console.error('新しいノートの作成に失敗しました:', error);
			// @ts-ignore
			await interaction.editReply(`ノート \`${fullPath}\` の作成に失敗しました エラー: ${error.message}`);
			// @ts-ignore
			new Notice(`エラー: ノートの作成に失敗しました: ${error.message}`);
		}
	}

	/**
	 * Discordコマンドに応じてObsidian Vault内のノートリストをDiscordに送信する
	 * @param interaction Discordコマンドインタラクションオブジェクト(応答用)
	 */
	private async listObsidianNotes(interaction: CommandInteraction) {
		await interaction.deferReply(); // 全員に見える「考え中...」応答

		const files = this.app.vault.getMarkdownFiles();
		let fileListContent = files.map(file => `- ${file.path}`).join('\n');
		
		const DISCORD_MAX_MESSAGE_LENGTH = 1990;
		
		const messageChunks: string[] = [];
		let currentChunk = `**Obsidian Vault内のノート:**\n\`\`\`\n`;
		
		if (fileListContent.length === 0) {
			currentChunk += "Vault内にMarkdownノートは見つかりませんでした\n";
		} else {
			const lines = fileListContent.split('\n');
			for (const line of lines) {
				if ((currentChunk + line + '```').length + 1 > DISCORD_MAX_MESSAGE_LENGTH) {
					messageChunks.push(currentChunk + '```');
					currentChunk = `\`\`\`\n${line}`;
				} else {
					currentChunk += `\n${line}`;
				}
			}
		}
		if (currentChunk.length > 0) {
			messageChunks.push(currentChunk + '```');
		}
		
		const currentTargetPathMessage = `\n**現在保存しているノート:** \`${this.ensureMarkdownExtension(this.settings.targetNotePath)}\``;
		const lastChunkIndex = messageChunks.length - 1;

		if (lastChunkIndex >= 0 && (messageChunks[lastChunkIndex] + currentTargetPathMessage).length <= DISCORD_MAX_MESSAGE_LENGTH) {
			messageChunks[lastChunkIndex] += currentTargetPathMessage;
		} else {
			messageChunks.push(currentTargetPathMessage);
		}

		try {
			if (messageChunks.length > 0) {
				await interaction.editReply({content: messageChunks[0]});
				for (let i = 1; i < messageChunks.length; i++) {
					await interaction.followUp({content: messageChunks[i], ephemeral: false});
				}
				new Notice(`ノートリストをDiscordに出力しました`);
				console.log(`ノートリストをDiscordに出力しました`);
			} else {
				await interaction.editReply('ノートリストの取得に失敗しました');
			}
		} catch (error) {
			console.error('ノートリストをDiscordに送信できませんでした:', error);
			await interaction.editReply('ノートリストの取得に失敗しました コンソールを確認してください');
		}
	}

	/**
	 * Discordコマンドに応じてメッセージ保存用のターゲットチャンネルを更新します
	 * @param channelId 設定するチャンネルのID
	 * @param interaction Discordコマンドインタラクションオブジェクト(応答用)
	 */
	private async updateTargetChannel(channelId: string, interaction: CommandInteraction) {
		if (!/^\d+$/.test(channelId)) {
			await interaction.editReply('無効なチャンネルIDが指定されました DiscordのチャンネルIDは数字の羅列です');
			return;
		}

		this.settings.channelId = channelId;
		await this.saveSettings();
		let channelName = channelId;
		if (this.discordClient && this.discordClient.isReady()) {
			const channel = await this.discordClient.channels.fetch(channelId);
			if (channel && channel instanceof TextChannel) {
				channelName = channel.name;
			}
		}

		await interaction.editReply(`Discordメッセージ保存のターゲットチャンネルを \`#${channelName}\` (ID: \`${channelId}\`) に更新しました`);
		new Notice(`Discordターゲットチャンネルを更新しました: #${channelName} (ID: ${channelId})`);
		console.log(`Discordターゲットチャンネルを更新しました: #${channelName} (ID: ${channelId})`);
	}

	/**
	 * 指定されたObsidianノートの内容をDiscordに出力する
	 * @param notePath 出力したいノートのパス
	 * @param interaction Discordコマンドインタラクションオブジェクト(応答用)
	 */
	private async outputObsidianNote(notePath: string, interaction: CommandInteraction) {
		const fullPath = notePath;

		if (!fullPath || fullPath.length > 255) {
			await interaction.editReply('無効なノートパスが指定されました 有効なパスを指定してください(例: `My Folder/My Note`)');
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(fullPath);

		if (!file || !(file instanceof TFile)) {
			await interaction.editReply(`ノート \`${fullPath}\` が見つかりませんでした パスを確認してください`);
			new Notice(`ノートが見つかりませんでした: ${fullPath}`);
			console.warn(`ノートが見つかりませんでした: ${fullPath}`);
			return;
		}

		try {
			const content = await this.app.vault.read(file);
			let outputContent = `**Obsidianノート: \`${fullPath}\`**\n\n`;

			const DISCORD_MAX_MESSAGE_LENGTH = 1990;

			if ((outputContent + content).length > DISCORD_MAX_MESSAGE_LENGTH) {
				const chunks: string[] = [];
				let currentChunk = outputContent;

				const lines = content.split('\n');
				for (const line of lines) {
					if ((currentChunk + line).length + 1 > DISCORD_MAX_MESSAGE_LENGTH) {
						chunks.push(currentChunk);
						currentChunk = line;
					} else {
						currentChunk += `\n${line}`;
					}
				}
				if (currentChunk.length > 0) {
					chunks.push(currentChunk);
				}

				if (chunks.length > 0) {
					await interaction.editReply(chunks[0]);
					for (let i = 1; i < chunks.length; i++) {
						await interaction.followUp({content: chunks[i], ephemeral: false});
					}
					new Notice(`ノートの内容をDiscordに出力しました: ${fullPath} (分割送信)`);
					console.log(`ノートの内容をDiscordに出力しました: ${fullPath} (分割送信)`);
				} else {
					await interaction.editReply('ノートの内容は空です');
				}

			} else {
				outputContent += content;
				await interaction.editReply(outputContent);
				new Notice(`ノートの内容をDiscordに出力しました: ${fullPath}`);
				console.log(`ノートの内容をDiscordに出力しました: ${fullPath}`);
			}

		} catch (error) {
			console.error(`ノート ${fullPath} の読み込みまたは出力に失敗しました:`, error);
			await interaction.editReply(`ノート \`${fullPath}\` の読み込みに失敗しました エラー: ${error.message}`);
			new Notice(`エラー: ノート ${fullPath} の読み込みまたは出力に失敗しました: ${error.message}`);
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

		containerEl.createEl('h2', { text: 'Discord Bridge プラグイン設定' });

		new Setting(containerEl)
			.setName('ボットトークン')
			.setDesc('このトークンはBase64形式で保存されるが、セキュリティ目的では無い')
			.addText(text => text
				.setPlaceholder('Discordボットのトークンを入力')
				.setValue(this.plugin.settings.botToken)
				.onChange(async (value) => {
					this.plugin.settings.botToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('クライアントID')
			.setDesc('このIDはBase64形式で保存されるが、セキュリティ目的では無い')
			.addText(text => text
				.setPlaceholder('DiscordボットのクライアントIDを入力')
				.setValue(this.plugin.settings.clientId)
				.onChange(async (value) => {
					this.plugin.settings.clientId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ターゲットチャンネルID')
			.setDesc('DiscordメッセージをObsidianに保存するために監視するDiscordチャンネルのIDを指定する')
			.addText(text => text
				.setPlaceholder('DiscordチャンネルIDを入力')
				.setValue(this.plugin.settings.channelId)
				.onChange(async (value) => {
					this.plugin.settings.channelId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('オーナーユーザーID')
			.setDesc('あなたのDiscordユーザーIDですを指定する `/setnote` や `/createnote` などのコマンドは、このユーザーからのみ処理される')
			.addText(text => text
				.setPlaceholder('あなたのDiscordユーザーIDを入力')
				.setValue(this.plugin.settings.ownerId)
				.onChange(async (value) => {
					this.plugin.settings.ownerId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Obsidianターゲットノートパス')
			.setDesc('Discordメッセージを追記するObsidian Vault内のMarkdownファイルのパスを指定する(例: `メモ/Discord受信トレイ`)')
			.addText(text => text
				.setPlaceholder('Discord_Messages')
				.setValue(this.plugin.settings.targetNotePath)
				.onChange(async (value) => {
					this.plugin.settings.targetNotePath = value;
					await this.plugin.saveSettings();
				}));
	}
}
