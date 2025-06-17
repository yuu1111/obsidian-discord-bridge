import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { Client, Intents, TextChannel, Interaction, CommandInteraction } from 'discord.js';
import { EmbedBuilder } from "@discordjs/builders";


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
			if (this.settings.botToken && (!this.discordClient || !this.discordClient.isReady())) {
				console.log('Discordクライアントが切断または準備未完了を検知。再初期化を試行中。');
				new Notice('Discordクライアントが切断されました。再初期化を試行中...');
				if (this.discordClient) {
					this.discordClient.destroy();
					this.discordClient = null;
				}
				this.initializeDiscordClient();
			}
		}, 5 * 60 * 1000)); // 5分ごとにチェック (5 * 60 * 1000 ミリ秒)
	}

	onunload() {
		if (this.discordClient) {
			this.discordClient.destroy();
			console.log('Discordクライアントが破棄されました。');
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
			console.log('Discordクライアントは既に初期化され、準備ができています。');
			if (this.settings.clientId && (!this.discordClient.application?.commands.cache.size || this.discordClient.application?.commands.cache.size < 3)) { // コマンド数が少ない場合も再登録
				console.log('スラッシュコマンドが不足または不完全なため、登録中...');
				this.registerSlashCommands();
			}
			return;
		}

		if (!this.settings.botToken) {
			new Notice('ボットトークンがプラグイン設定で設定されていません。設定してください。');
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

		this.discordClient.once('ready', () => {
			console.log(`${this.discordClient?.user?.tag}としてログインしました！`);
			new Notice(`${this.discordClient?.user?.tag}としてログインしました！`);
			this.updateStatusBar(`Discord: 接続済み (${this.discordClient?.user?.tag})`);
			this.setupDiscordListeners();
			if (this.settings.clientId) {
				this.registerSlashCommands();
			} else {
				new Notice('クライアントIDが設定されていません。スラッシュコマンドは登録されません。');
				console.warn('クライアントIDが設定されていません。readyイベントでのスラッシュコマンド登録をスキップします。');
			}
		});

		this.discordClient.on('error', (error) => {
			console.error('Discordクライアントエラー:', error);
			new Notice(`Discordクライアントエラー: ${error.message}`);
			this.updateStatusBar('Discord: エラー');
		});

		this.discordClient.on('shardDisconnect', (event) => {
			console.warn('Discordクライアントが切断されました:', event.reason);
			new Notice('Discordクライアントが切断されました。');
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
			new Notice(`Discordへのログインに失敗しました: ${error.message}`);
			this.updateStatusBar('Discord: ログイン失敗');
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
				await interaction.reply({ content: 'このコマンドを使用する権限がありません。', ephemeral: true });
				return;
			}

			const commandInteraction = interaction as CommandInteraction;

			switch (commandInteraction.commandName) {
				case 'setnote':
					const pathOption = commandInteraction.options.getString('path', true);
					await commandInteraction.deferReply();
					await this.updateTargetNote(pathOption, commandInteraction, true);
					break;
				case 'createnote':
					const nameOption = commandInteraction.options.getString('name', true);
					await this.createNewNote(nameOption, commandInteraction);
					break;
				case 'listnotes':
					await this.listObsidianNotes(commandInteraction);
					break;
				default:
					await commandInteraction.reply({ content: '不明なコマンドです。', ephemeral: true });
					break;
			}
		});
	}

	/**
	 * Discordスラッシュコマンドを登録します。
	 */
	private async registerSlashCommands() {
		if (!this.discordClient || !this.discordClient.application?.id) {
			console.error('Discordクライアントが準備できていないか、アプリケーションIDがコマンド登録に利用できません。');
			return;
		}
		if (!this.settings.clientId) {
			new Notice('クライアントIDが設定されていません。スラッシュコマンドを登録できません。');
			console.error('クライアントIDが不足しています。スラッシュコマンドを登録できません。');
			return;
		}

		const commands = [
			{
				name: 'setnote',
				description: 'Discordメッセージを保存するObsidianノートのパスを設定します。',
				options: [
					{
						name: 'path',
						description: 'Obsidianノートのフルパス（例: `Notes/Discord Inbox.md`）。',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: 'createnote',
				description: '新しいObsidianノートを作成し、保存先に設定します。',
				options: [
					{
						name: 'name',
						description: '新しいObsidianノートの名前（例: `日次Discordログ`）。',
						type: 3,
						required: true,
					},
				],
			},
			{
				name: 'listnotes',
				description: 'Obsidian Vault内のすべてのMarkdownノートをリスト表示します。',
			},
		];

		try {
			await this.discordClient.application.commands.set(commands);
			new Notice('スラッシュコマンドが正常に登録されました！');
			console.log('スラッシュコマンドが登録されました:', commands);
		} catch (error) {
			console.error('スラッシュコマンドの登録に失敗しました:', error);
			new Notice(`スラッシュコマンドの登録に失敗しました: ${error.message}`);
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
				new Notice(`Discordメッセージ用の新しいノートを作成しました: ${targetFilePath}`);
				console.log(`新しいノートを作成しました: ${targetFilePath}`);
			} catch (error) {
				console.error(`ノート ${targetFilePath} の作成に失敗しました:`, error);
				new Notice(`エラー: ノート ${targetFilePath} の作成に失敗しました: ${error.message}`);
				return;
			}
		}

		if (file instanceof TFile) {
			const timestamp = new Date().toLocaleString();
			const messageToSave = `\n---\n**[${timestamp}] ${author} in #${channelName}:**\n${content}\n`;
			await this.app.vault.append(file, messageToSave);
			console.log(`メッセージを ${targetFilePath} に保存しました。`);
		} else {
			console.error('Discordメッセージの保存先ファイルが見つからないか、作成できませんでした。');
			new Notice('エラー: Discordメッセージをノートに保存できませんでした。');
		}
	}

	/**
	 * Discordコマンドに応じてObsidianの保存先ノートパスを更新します。
	 * この関数は、親の関数から呼ばれる際に、すでに deferReply されていることを前提とします。
	 * @param newPath 新しいノートパス
	 * @param interaction Discordコマンドインタラクションオブジェクト（応答用）
	 * @param shouldReply この関数自身が deferReply/editReply を行うべきか (主に直接呼ばれる場合)
	 */
	private async updateTargetNote(newPath: string, interaction: CommandInteraction, shouldReply: boolean = false) {
		if (shouldReply) {
			await interaction.deferReply();
		}

		if (!newPath || newPath.length > 255) {
			await interaction.editReply('無効なノートパスが指定されました。有効なパスを指定してください（例: `フォルダ名/ノート名.md`）。');
			return;
		}

		this.settings.targetNotePath = newPath;
		await this.saveSettings();

		await interaction.editReply(`Obsidianのターゲットノートパスを \`${newPath}\` に更新しました。`);

		new Notice(`Obsidianのターゲットノートパスを更新しました: ${newPath}`);
		console.log(`Obsidianのターゲットノートパスを更新しました: ${newPath}`);
	}


	/**
	 * Discordコマンドに応じてObsidianに新しいノートを作成します。
	 * @param noteName 新しいノート名 (拡張子なしでも可)
	 * @param interaction Discordコマンドインタラクションオブジェクト（応答用）
	 */
	private async createNewNote(noteName: string, interaction: CommandInteraction) {
		await interaction.deferReply(); // この関数で初期応答を送信

		const sanitizedNoteName = noteName.replace(/[\\/:*?"<>|]/g, '');
		if (!sanitizedNoteName) {
			await interaction.editReply('無効なノート名が指定されました。');
			return;
		}
		const newPath = `${sanitizedNoteName}.md`;

		try {
			if (this.app.vault.getAbstractFileByPath(newPath)) {
				await interaction.editReply(`ノート \`${newPath}\` は既に存在します。`/setnote` コマンドで選択してください。`);
				new Notice(`ノートは既に存在します: ${newPath}`);
				return;
			}

			const file = await this.app.vault.create(newPath, '');
			await interaction.editReply(`新しいノート \`${newPath}\` をObsidianに作成しました。`); // 応答メッセージを修正
			new Notice(`新しいノートを作成しました: ${newPath}`);
			console.log(`新しいノートを作成しました: ${newPath}`);

			// --- 変更点: ターゲットノートの更新ロジックを削除 ---
			// updateTargetNote の呼び出しを完全に削除
			// this.settings.targetNotePath = newPath; // これらの行も削除
			// await this.saveSettings();
			// new Notice(`Obsidianのターゲットノートパスを更新しました: ${newPath}`);
			// console.log(`Obsidianのターゲットノートパスを更新しました: ${newPath}`);
			// --- ここまで変更 ---

		} catch (error) {
			console.error('新しいノートの作成に失敗しました:', error);
			await interaction.editReply(`ノート \`${newPath}\` の作成に失敗しました。エラー: ${error.message}`);
			new Notice(`エラー: ノートの作成に失敗しました: ${error.message}`);
		}
	}
	/**
	 * Discordコマンドに応じてObsidian Vault内のノートリストをDiscordに送信します。
	 * @param interaction Discordコマンドインタラクションオブジェクト（応答用）
	 */
	private async listObsidianNotes(interaction: CommandInteraction) {
		await interaction.deferReply(); // 全員に見える「考え中...」応答

		const files = this.app.vault.getMarkdownFiles();
		let fileList = files.map(file => `- ${file.path}`).join('\n');

		if (fileList.length === 0) {
			fileList = "Vault内にMarkdownノートは見つかりませんでした。";
		} else if (fileList.length > 1800) {
			fileList = fileList.substring(0, 1800) + '\n... (省略)';
		}

		try {
			const embed = new EmbedBuilder()
				.setColor(0x0099FF)
				.setTitle('Obsidian Vault内のノート')
				.setDescription(`\`\`\`\n${fileList}\n\`\`\`\n\n**現在保存しているノート:** \`${this.settings.targetNotePath}\``);

			await interaction.editReply({ embeds: [embed] }); // 最終応答
		} catch (error) {
			console.error('ノートリストをDiscordに送信できませんでした:', error);
			await interaction.editReply('ノートリストの取得に失敗しました。コンソールを確認してください。'); // エラー応答
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
			.setDesc('このトークンはBase64形式で保存されますが、セキュリティ目的ではありません。')
			.addText(text => text
				.setPlaceholder('Discordボットのトークンを入力')
				.setValue(this.plugin.settings.botToken)
				.onChange(async (value) => {
					this.plugin.settings.botToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('クライアントID')
			.setDesc('このIDはBase64形式で保存されますが、セキュリティ目的ではありません。')
			.addText(text => text
				.setPlaceholder('DiscordボットのクライアントIDを入力')
				.setValue(this.plugin.settings.clientId)
				.onChange(async (value) => {
					this.plugin.settings.clientId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ターゲットチャンネルID')
			.setDesc('DiscordメッセージをObsidianに保存するために監視するDiscordチャンネルのIDです。')
			.addText(text => text
				.setPlaceholder('DiscordチャンネルIDを入力')
				.setValue(this.plugin.settings.channelId)
				.onChange(async (value) => {
					this.plugin.settings.channelId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('オーナーユーザーID')
			.setDesc('あなたのDiscordユーザーIDです。`/setnote` や `/createnote` などのコマンドは、このユーザーからのみ処理されます。')
			.addText(text => text
				.setPlaceholder('あなたのDiscordユーザーIDを入力')
				.setValue(this.plugin.settings.ownerId)
				.onChange(async (value) => {
					this.plugin.settings.ownerId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Obsidianターゲットノートパス')
			.setDesc('Discordメッセージを追記するObsidian Vault内のMarkdownファイルのパスです（例: `メモ/Discord受信トレイ.md`）。')
			.addText(text => text
				.setPlaceholder('Discord_Messages.md')
				.setValue(this.plugin.settings.targetNotePath)
				.onChange(async (value) => {
					this.plugin.settings.targetNotePath = value;
					await this.plugin.saveSettings();
				}));
	}
}

