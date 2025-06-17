import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface PluginSettings {
	botToken: string,
	clintId: string,
	ownerId: string,
	channelId: string
}

const DEFAULT_SETTINGS: PluginSettings = {
	botToken: "",
	clintId: "",
	ownerId: "",
	channelId: ""
}

export default class MyPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('dice', 'Discord Bridge Plugin', (evt: MouseEvent) => {
			new Notice('This is a notice!');
		});
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		this.addSettingTab(new SettingTab(this.app, this));

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		if (this.settings.botToken) {
			this.settings.botToken = atob(this.settings.botToken);
		}
		if (this.settings.clintId) {
			this.settings.clintId = atob(this.settings.clintId);
		}
	}

	async saveSettings() {
		const settingsToSave = { ...this.settings };

		if (settingsToSave.botToken) {
			settingsToSave.botToken = btoa(settingsToSave.botToken);
		}
		if (settingsToSave.clintId) {
			settingsToSave.clintId = btoa(settingsToSave.clintId);
		}

		await this.saveData(settingsToSave);
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
				.setValue(this.plugin.settings.clintId)
				.onChange(async (value) => {
					this.plugin.settings.clintId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Channel ID')
			.setDesc('The ID of your Discord channel.')
			.addText(text => text
				.setPlaceholder('Enter your Discord Channel ID')
				.setValue(this.plugin.settings.channelId)
				.onChange(async (value) => {
					this.plugin.settings.channelId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Owner ID')
			.setDesc('Your Discord user ID.')
			.addText(text => text
				.setPlaceholder('Enter your Discord user ID')
				.setValue(this.plugin.settings.ownerId)
				.onChange(async (value) => {
					this.plugin.settings.ownerId = value;
					await this.plugin.saveSettings();
				}));
	}
}
