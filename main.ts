import {AbstractInputSuggest, App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder} from 'obsidian';
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

// コマンド
const COMMAND_SET_NOTE_PATH = "setnote"
const COMMAND_CREATE_NOTE = "createnote"
const COMMAND_LIST_NOTE = "listnote"
const COMMAND_SET_CHANNEL = "setchannel"
const COMMAND_OUT_PUT_NOTE = "outputnote"

// ログ系
const LOG_DISCORD_CLIENT_RE_INIT = "Discordクライアントの再初期化を試行中..."
const LOG_DISCORD_CLIENT_ERROR = "Discordクライアントエラー:"
const LOG_DISCORD_CLIENT_DISCONNECT = "Discordクライアントが切断されました:"
const LOG_DISCORD_CLIENT_RECONNECT= "Discordクライアントが再接続中..."
const LOG_DISCORD_CLIENT_LOGIN_FAILED = "Discordへのログインに失敗しました:"

// ステータスメッセージ
const STATUS_DISCORD_ERROR = "Discord: エラー"
const STATUS_DISCORD_DISCONNECT = "Discord: 未接続"
const STATUS_DISCORD_RECONNECT = "Discord: 再接続中..."
const STATUS_DISCORD_LOGIN_FAILED = "Discord: ログイン失敗"
const STATUS_DISCORD_CONNECTED = "Discord: 接続済み"

// インタラクションメッセージ
const INTERACTION_USE_COMMAND_NON_PERMISSION = "このコマンドを使用する権限がありません"




export default class MyPlugin extends Plugin {
	settings: PluginSettings;
	private discordClient: Client | null = null;
	private statusBarItem: HTMLElement;

	async onload() {

		await this.loadSettings();
		await this.initializeDiscordClient();

		// 左のリボンボタン
		const ribbonIconEl = this.addRibbonIcon('refresh-ccw', 'Discord接続を更新', async () => {
			new Notice(LOG_DISCORD_CLIENT_RE_INIT);
			if (this.discordClient) {
				this.discordClient.destroy();
				this.discordClient = null;
			}
			await this.initializeDiscordClient();
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// これはどこで出るんだ
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar('Discord: 未接続');

		// 設定を追加
		this.addSettingTab(new SettingTab(this.app, this));

		// 定期的にDiscordのBotが起動できているかチェック
		// 分 * 秒 * ミリ秒
		this.registerInterval(window.setInterval(() => {
			if (this.settings.botToken && (!this.discordClient || (this.discordClient && this.discordClient.ws.status === Constants.Status.DISCONNECTED))
			) {
				console.log('Discordクライアントが完全に切断された状態を検知 再初期化を試行中');
				new Notice('Discordクライアントが切断されました 再初期化を試行中...');
				if (this.discordClient) {
					this.discordClient.destroy();
					this.discordClient = null;
				}
				this.initializeDiscordClient();
			} else if (this.discordClient && this.discordClient.ws.status === Constants.Status.RECONNECTING) {
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
			this.updateStatusBar(STATUS_DISCORD_CONNECTED + ` (${this.discordClient?.user?.tag})`);
			this.setupDiscordListeners();
			if (this.settings.clientId) {
				await this.registerSlashCommands();
			} else {
				new Notice('クライアントIDが設定されていません スラッシュコマンドは登録されません');
				console.warn('クライアントIDが設定されていません readyイベントでのスラッシュコマンド登録をスキップします');
			}
		});

		this.discordClient.on('error', (error) => {
			console.error(LOG_DISCORD_CLIENT_ERROR, error);
			new Notice(LOG_DISCORD_CLIENT_ERROR + error.message);
			this.updateStatusBar(STATUS_DISCORD_ERROR);
		});

		this.discordClient.on('shardDisconnect', (event) => {
			console.warn(LOG_DISCORD_CLIENT_DISCONNECT, event.reason);
			new Notice(LOG_DISCORD_CLIENT_DISCONNECT + event.reason);
			this.updateStatusBar(STATUS_DISCORD_DISCONNECT);
		});

		this.discordClient.on('shardReconnecting', () => {
			console.log(LOG_DISCORD_CLIENT_RECONNECT);
			new Notice(LOG_DISCORD_CLIENT_RECONNECT);
			this.updateStatusBar(STATUS_DISCORD_RECONNECT);
		});

		try {
			await this.discordClient.login(this.settings.botToken);
		} catch (error) {
			if (!(error instanceof Error)) return
			console.error(LOG_DISCORD_CLIENT_LOGIN_FAILED, error);
			new Notice(LOG_DISCORD_CLIENT_LOGIN_FAILED + error.message);
			this.updateStatusBar(STATUS_DISCORD_LOGIN_FAILED);
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

			if (this.settings.channelId && message.channel.id === this.settings.channelId) {
				console.log(`ターゲットチャンネルでメッセージを受信しました: ${message.content}`);
				await this.saveMessageToObsidianNote(message.content);
			}
		});

		this.discordClient.on('interactionCreate', async (interaction: Interaction) => {
			if (interaction.isCommand()) {
				if (this.settings.ownerId && interaction.user.id !== this.settings.ownerId) {
					await interaction.reply({content: INTERACTION_USE_COMMAND_NON_PERMISSION, ephemeral: true});
					return;
				}

				const commandInteraction = interaction as CommandInteraction;

				switch (commandInteraction.commandName) {
					case COMMAND_SET_NOTE_PATH: {
						const pathOption = commandInteraction.options.getString('path', true);
						await commandInteraction.deferReply();
						await this.updateTargetNote(pathOption, commandInteraction);
						break;
					}
					case COMMAND_CREATE_NOTE: {
						const nameOption = commandInteraction.options.getString('name', true);
						await this.createNewNote(nameOption, commandInteraction);
						break;
					}
					case COMMAND_LIST_NOTE: {
						await this.listObsidianNotes(commandInteraction);
						break;
					}
					case COMMAND_SET_CHANNEL: {
						const channelOption = commandInteraction.options.getChannel('channel', true);
						await commandInteraction.deferReply();
						await this.updateTargetChannel(channelOption.id, commandInteraction);
						break;
					}
					case COMMAND_OUT_PUT_NOTE: {
						const notePathOption = commandInteraction.options.getString('note_path', true);
						await commandInteraction.deferReply();
						await this.outputObsidianNote(notePathOption, commandInteraction);
						break;
					}
					default: {
						await commandInteraction.reply({content: '不明なコマンドです', ephemeral: true});
						break;
					}
				}
			}
			else if (interaction.isAutocomplete()) {
				const focusedOption = interaction.options.getFocused(true);
				const userQuery = focusedOption.value.toLowerCase();
				const commandName = interaction.commandName;

				let suggestions: { name: string; value: string }[] = [];

				if ((commandName === COMMAND_SET_NOTE_PATH && focusedOption.name === 'path') ||
					(commandName === COMMAND_OUT_PUT_NOTE && focusedOption.name === 'note_path')) {

					const allMarkdownFiles = this.app.vault.getMarkdownFiles()
					const filteredFiles = allMarkdownFiles.filter(file => {
						const pathWithoutExtension = file.path.slice(0, -3).toLowerCase();
						return pathWithoutExtension.includes(userQuery);
					});

					suggestions = filteredFiles.slice(0, 25)
						.map(file => {
							const pathWithoutExtension = file.path.slice(0, -3);
							return {
								name: pathWithoutExtension,
								value: pathWithoutExtension
							};
						});
				}

				try {
					await interaction.respond(suggestions);
				} catch (error) {
					console.error('オートコンプリートの応答に失敗しました:', error);
				}
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
				name:  COMMAND_OUT_PUT_NOTE,
				description: 'Discordメッセージを保存するノートのパスを設定します',
				options: [
					{
						name: 'path',
						description: 'ノートのフルパス 例: Notes/Discord',
						type: 3,
						required: true,
						autocomplete: true,
					},
				],
			},
			{
				name: COMMAND_CREATE_NOTE,
				description: '指定した場所にノートを作成します',
				options: [
					{
						name: 'name',
						description: '新しいノートのパスと名前 例: Folder/NewNote',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: COMMAND_LIST_NOTE,
				description: 'Vault内のすべてのノートをリスト表示します',
			},
			{
				name: COMMAND_SET_CHANNEL,
				description: 'Discordメッセージをノートに保存するターゲットチャンネルを設定します',
				options: [
					{
						name: 'channel',
						description: 'メッセージを監視するチャンネル',
						type: 7,
						required: true,
					},
				],
			},
			{
				name: COMMAND_OUT_PUT_NOTE,
				description: '指定したノートの内容をDiscordに出力します',
				options: [
					{
						name: 'note_path',
						description: '出力したいノートのパス 例: Folder/Discord',
						type: 3,
						required: true,
						autocomplete: true,
					},
				],
			},
		];

		try {
			await this.discordClient.application.commands.set(commands);
			new Notice('スラッシュコマンドが正常に登録されました！');
			console.log('スラッシュコマンドが登録されました:', commands);
		} catch (error) {
			if (!(error instanceof Error)) return
			console.error('スラッシュコマンドの登録に失敗しました:', error);
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
	 */
	private async saveMessageToObsidianNote(content: string) {

		// 設定から.md抜きの相対ファイルパスを取得し、.mdを付与する
		const targetFilePath = this.ensureMarkdownExtension(this.settings.targetNotePath);
		let file = this.app.vault.getAbstractFileByPath(targetFilePath);

		if (!file || !(file instanceof TFile)) {
			try {
				file = await this.app.vault.create(targetFilePath, '');
				new Notice(`Discordメッセージ用の新しいノートを作成しました: ${targetFilePath}`);
				console.log(`新しいノートを作成しました: ${targetFilePath}`);
			} catch (error) {
				if (!(error instanceof Error)) return
				console.error(`ノート ${targetFilePath} の作成に失敗しました:`, error);
				new Notice(`エラー: ノート ${targetFilePath} の作成に失敗しました: ${error.message}`);
				return;
			}
		}

		if (file instanceof TFile) {
			const messageToSave = `${content}\n`;
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

		// .md無しのファイルを入れる
		const finalPath = this.ensureMarkdownExtension(newPath);

		// TODO : 必ず.md抜きで指定されるようにする
		if (!finalPath || finalPath.length > 255) {
			await interaction.editReply('無効なノートパスが指定されました 有効なパスを指定してください 例: Folder/Note');
			return;
		}

		this.settings.targetNotePath = newPath;
		await this.saveSettings();

		await interaction.editReply(`ターゲットノートパスを \`${finalPath}\` に更新しました`);

		new Notice(`ターゲットノートパスを更新しました: ${finalPath}`);
		console.log(`ターゲットノートパスを更新しました: ${finalPath}`);
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

		// TODO : 必ず.md抜きで指定されるようにする
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
					if (!(folderError instanceof Error)) return
					console.error(`フォルダ ${folderPath} の作成に失敗しました:`, folderError);
					await interaction.editReply(`フォルダ \`${folderPath}\` の作成に失敗しましたエラー: ${folderError.message}`);
					new Notice(`エラー: フォルダの作成に失敗しました: ${folderError.message}`);
					return;
				}
			}
		} else {
			fullPath = this.ensureMarkdownExtension(sanitizedNoteName);
		}

		try {
			if (this.app.vault.getAbstractFileByPath(fullPath)) {
				await interaction.editReply(`ノート \`${fullPath}\` は既に存在します /setnote コマンドで選択してください`);
				new Notice(`ノートは既に存在します: ${fullPath}`);
				return;
			}

			await interaction.editReply(`新しいノート \`${fullPath}\` を作成しました`);
			new Notice(`新しいノートを作成しました: ${fullPath}`);
			console.log(`新しいノートを作成しました: ${fullPath}`);

		} catch (error) {
			if (!(error instanceof Error)) return
			console.error('新しいノートの作成に失敗しました:', error);
			await interaction.editReply(`ノート \`${fullPath}\` の作成に失敗しました エラー: ${error.message}`);
			new Notice(`エラー: ノートの作成に失敗しました: ${error.message}`);
		}
	}

	/**
	 * Discordコマンドに応じてObsidian Vault内のノートリストをDiscordに送信する
	 * @param interaction Discordコマンドインタラクションオブジェクト(応答用)
	 */
	private async listObsidianNotes(interaction: CommandInteraction) {

		await interaction.deferReply();

		const files = this.app.vault.getMarkdownFiles();
		const fileListContent = files.map(file => `- ${file.path}`).join('\n');

		// TODO : 多分これ上の方で定義してグローバル変数にした方がいい
		const DISCORD_MAX_MESSAGE_LENGTH = 1990;

		const messageChunks: string[] = [];
		let currentChunk = `**Vault内のノート:**\n\`\`\`\n`;

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
		const fullPath = this.ensureMarkdownExtension(notePath);

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
			if (!(error instanceof Error)) return
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
			.setDesc('BotのTokenを入れる')
			.addText(text => text
				.setPlaceholder('Discordボットのトークンを入力')
				.setValue(this.plugin.settings.botToken)
				.onChange(async (value) => {
					this.plugin.settings.botToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('クライアントID')
			.setDesc('BotのClientIDを入れる')
			.addText(text => text
				.setPlaceholder('DiscordボットのクライアントIDを入力')
				.setValue(this.plugin.settings.clientId)
				.onChange(async (value) => {
					this.plugin.settings.clientId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ターゲットチャンネルID')
			.setDesc('Botで監視するDiscordチャンネルのIDを指定する')
			.addText(text => text
				.setPlaceholder('DiscordチャンネルのIDを入力')
				.setValue(this.plugin.settings.channelId)
				.onChange(async (value) => {
					this.plugin.settings.channelId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('オーナーユーザーID')
			.setDesc('あなたのDiscordユーザーIDを指定する コマンドはこのユーザーのみに実行が許可される')
			.addText(text => text
				.setPlaceholder('あなたのDiscordユーザーIDを入力')
				.setValue(this.plugin.settings.ownerId)
				.onChange(async (value) => {
					this.plugin.settings.ownerId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ノートパス')
			.setDesc('Discordメッセージを追記するVault内のノートのパスを指定する .mdは含めないこと')
			.addText(text => {
				text.setPlaceholder('Folder/Discord')
					.setValue(this.plugin.settings.targetNotePath)
					.onChange(async (value) => {
						this.plugin.settings.targetNotePath = value;
						await this.plugin.saveSettings();
					});
				new NotePathSuggest(this.app, text.inputEl);
			});
	}
}

class NotePathSuggest extends AbstractInputSuggest<TFile> {
	constructor(app: App, private inputEl: HTMLInputElement) {
		super(app, inputEl);
	}

	getSuggestions(inputStr: string): TFile[] {
		const files = this.app.vault.getMarkdownFiles();
		const lowerCaseInputStr = inputStr.toLowerCase();

		return files.filter(file => {
			const pathWithoutExtension = file.path.slice(0, -3);
			return file.path.toLowerCase().includes(lowerCaseInputStr) ||
				pathWithoutExtension.toLowerCase().includes(lowerCaseInputStr);
		});
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path.slice(0, -3));
	}

	selectSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.inputEl.value = file.path.slice(0, -3);
		this.inputEl.trigger('input');
		this.close();
	}
}
