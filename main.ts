import { AbstractInputSuggest, App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import { TextChannel, CommandInteraction } from 'discord.js';
import { initializeI18n, t } from './src/i18n';
import { PluginSettings, DEFAULT_SETTINGS } from './src/types';
import { DISCORD_CONSTANTS, INVALID_FILENAME_CHARS_REGEX } from './src/constants';
import { DiscordManager, DiscordManagerCallbacks } from './src/discord-manager';

export default class DiscordBridgePlugin extends Plugin {
  settings: PluginSettings;
  private discordManager: DiscordManager;
  private statusBarItem: HTMLElement;

  async onload() {
    await initializeI18n(this.app);
    await this.loadSettings();
    
    this.setupDiscordManager();
    await this.discordManager.initialize();

    this.setupUI();
    this.addSettingTab(new SettingTab(this.app, this));
  }

  onunload() {
    this.discordManager?.destroy();
  }

  private setupDiscordManager(): void {
    const callbacks: DiscordManagerCallbacks = {
      onMessageReceived: this.saveMessageToObsidianNote.bind(this),
      onStatusUpdate: this.updateStatusBar.bind(this),
      updateTargetNote: this.updateTargetNote.bind(this),
      createNewNote: this.createNewNote.bind(this),
      listObsidianNotes: this.listObsidianNotes.bind(this),
      updateTargetChannel: this.updateTargetChannel.bind(this),
      outputObsidianNote: this.outputObsidianNote.bind(this),
      getMarkdownFiles: () => this.app.vault.getMarkdownFiles(),
    };

    this.discordManager = new DiscordManager(this.settings, callbacks);
  }

  private setupUI(): void {
    const ribbonIconEl = this.addRibbonIcon('refresh-ccw', t('messages.ribbon.refreshConnection'), async () => {
      new Notice(t('messages.logs.clientReInit'));
      await this.discordManager.forceReconnect();
    });
    ribbonIconEl.addClass('discord-bridge-ribbon-class');

    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar(t('messages.status.disconnected'));
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
    this.discordManager?.updateSettings(this.settings);
  }

  private updateStatusBar(text: string) {
    this.statusBarItem.setText(text);
  }

  private ensureMarkdownExtension(path: string): string {
    if (!path.endsWith('.md')) {
      return `${path}.md`;
    }
    return path;
  }

  private async saveMessageToObsidianNote(content: string) {
    const targetFilePath = this.ensureMarkdownExtension(this.settings.targetNotePath);
    let file = this.app.vault.getAbstractFileByPath(targetFilePath);

    if (!file || !(file instanceof TFile)) {
      try {
        file = await this.app.vault.create(targetFilePath, '');
        new Notice(`${t('messages.logs.newNoteCreatedForMessage')} ${targetFilePath}`);
        console.log(`${t('messages.logs.noteCreated')} ${targetFilePath}`);
      } catch (error) {
        if (!(error instanceof Error)) return;
        console.error(`${t('messages.errors.noteCreationFailed')} ${targetFilePath}:`, error);
        new Notice(`${t('messages.errors.noteCreationFailed')} ${targetFilePath}: ${error.message}`);
        return;
      }
    }

    if (file instanceof TFile) {
      const messageToSave = `${content}\n`;
      await this.app.vault.append(file, messageToSave);
      console.log(`${t('messages.logs.messageSaved')} ${targetFilePath}`);
    } else {
      console.error(t('messages.errors.messageSaveFailed'));
      new Notice(t('messages.errors.messageSaveFailed'));
    }
  }

  private async updateTargetNote(newPath: string, interaction: CommandInteraction) {
    const finalPath = this.ensureMarkdownExtension(newPath);

    if (!finalPath || finalPath.length > DISCORD_CONSTANTS.MAX_PATH_LENGTH) {
      await interaction.editReply(t('messages.errors.invalidNotePath'));
      return;
    }

    this.settings.targetNotePath = newPath;
    await this.saveSettings();

    await interaction.editReply(`${t('messages.success.targetNoteUpdated')} \`${finalPath}\``);
    new Notice(`${t('messages.logs.targetNoteUpdated')} ${finalPath}`);
    console.log(`${t('messages.logs.targetNoteUpdated')} ${finalPath}`);
  }

  private async createNewNote(noteName: string, interaction: CommandInteraction) {
    await interaction.deferReply();

    const sanitizedNoteName = noteName.replace(INVALID_FILENAME_CHARS_REGEX, '');

    if (!sanitizedNoteName) {
      await interaction.editReply(t('messages.errors.invalidNoteName'));
      return;
    }

    let fullPath: string;
    const lastSlashIndex = sanitizedNoteName.lastIndexOf('/');

    if (lastSlashIndex !== -1) {
      const folderPath = sanitizedNoteName.substring(0, lastSlashIndex);
      const fileName = sanitizedNoteName.substring(lastSlashIndex + 1);

      if (!fileName) {
        await interaction.editReply(t('messages.errors.noFileName'));
        return;
      }
      fullPath = this.ensureMarkdownExtension(`${folderPath}/${fileName}`);

      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder || !(folder instanceof TFolder)) {
        try {
          await this.app.vault.createFolder(folderPath);
          new Notice(`${t('messages.success.folderCreated')} ${folderPath}`);
          console.log(`${t('messages.logs.folderCreated')} ${folderPath}`);
        } catch (folderError) {
          if (!(folderError instanceof Error)) return;
          console.error(`${t('messages.errors.folderCreationFailed')} ${folderPath}:`, folderError);
          await interaction.editReply(`${t('messages.errors.folderCreationFailed')} \`${folderPath}\`: ${folderError.message}`);
          new Notice(`${t('messages.errors.folderCreationFailed')}: ${folderError.message}`);
          return;
        }
      }
    } else {
      fullPath = this.ensureMarkdownExtension(sanitizedNoteName);
    }

    try {
      if (this.app.vault.getAbstractFileByPath(fullPath)) {
        await interaction.editReply(`${t('messages.errors.noteAlreadyExists')} \`${fullPath}\``);
        new Notice(`${t('messages.errors.noteAlreadyExists')}: ${fullPath}`);
        return;
      }

      await this.app.vault.create(fullPath, '');
      await interaction.editReply(`${t('messages.success.noteCreated')} \`${fullPath}\``);
      new Notice(`${t('messages.logs.noteCreated')} ${fullPath}`);
      console.log(`${t('messages.logs.noteCreated')} ${fullPath}`);

    } catch (error) {
      if (!(error instanceof Error)) return;
      console.error(t('messages.errors.noteCreationFailed'), error);
      await interaction.editReply(`${t('messages.errors.noteCreationFailed')} \`${fullPath}\`: ${error.message}`);
      new Notice(`${t('messages.errors.noteCreationFailed')}: ${error.message}`);
    }
  }

  private async listObsidianNotes(interaction: CommandInteraction) {
    await interaction.deferReply();

    const files = this.app.vault.getMarkdownFiles();
    const fileListContent = files.map(file => `- ${file.path}`).join('\n');

    const messageChunks: string[] = [];
    let currentChunk = `**${t('messages.discord.vaultNotes')}**\n\`\`\`\n`;

    if (fileListContent.length === 0) {
      currentChunk += t('messages.discord.noNotesFound') + '\n';
    } else {
      const lines = fileListContent.split('\n');
      for (const line of lines) {
        if ((currentChunk + line + '```').length + 1 > DISCORD_CONSTANTS.MAX_MESSAGE_LENGTH) {
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

    const currentTargetPathMessage = `\n**${t('messages.discord.currentTargetNote')}** \`${this.ensureMarkdownExtension(this.settings.targetNotePath)}\``;
    const lastChunkIndex = messageChunks.length - 1;

    if (lastChunkIndex >= 0 && (messageChunks[lastChunkIndex] + currentTargetPathMessage).length <= DISCORD_CONSTANTS.MAX_MESSAGE_LENGTH) {
      messageChunks[lastChunkIndex] += currentTargetPathMessage;
    } else {
      messageChunks.push(currentTargetPathMessage);
    }

    try {
      if (messageChunks.length > 0) {
        await interaction.editReply({ content: messageChunks[0] });
        for (let i = 1; i < messageChunks.length; i++) {
          await interaction.followUp({ content: messageChunks[i], ephemeral: false });
        }
        new Notice(t('messages.success.noteListOutput'));
        console.log(t('messages.logs.noteListOutput'));
      } else {
        await interaction.editReply(t('messages.errors.noteListRetrievalFailed'));
      }
    } catch (error) {
      console.error(t('messages.errors.noteListRetrievalFailed'), error);
      await interaction.editReply(t('messages.errors.noteListRetrievalFailed'));
    }
  }

  private async updateTargetChannel(channelId: string, interaction: CommandInteraction) {
    if (!/^\d+$/.test(channelId)) {
      await interaction.editReply(t('messages.errors.invalidChannelId'));
      return;
    }

    this.settings.channelId = channelId;
    await this.saveSettings();
    
    let channelName = channelId;
    const channel = await this.discordManager.getChannel(channelId);
    if (channel instanceof TextChannel) {
      channelName = channel.name;
    }

    await interaction.editReply(`${t('messages.success.targetChannelUpdated')} \`#${channelName}\` (ID: \`${channelId}\`)`);
    new Notice(`${t('messages.logs.targetChannelUpdated')} #${channelName} (ID: ${channelId})`);
    console.log(`${t('messages.logs.targetChannelUpdated')} #${channelName} (ID: ${channelId})`);
  }

  private async outputObsidianNote(notePath: string, interaction: CommandInteraction) {
    const fullPath = this.ensureMarkdownExtension(notePath);

    if (!fullPath || fullPath.length > DISCORD_CONSTANTS.MAX_PATH_LENGTH) {
      await interaction.editReply(t('messages.errors.invalidNotePath'));
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(fullPath);

    if (!file || !(file instanceof TFile)) {
      await interaction.editReply(`${t('messages.errors.noteNotFound')} \`${fullPath}\``);
      new Notice(`${t('messages.errors.noteNotFound')}: ${fullPath}`);
      console.warn(`${t('messages.errors.noteNotFound')}: ${fullPath}`);
      return;
    }

    try {
      const content = await this.app.vault.read(file);
      let outputContent = `**${t('messages.discord.obsidianNote')} \`${fullPath}\`**\n\n`;

      if ((outputContent + content).length > DISCORD_CONSTANTS.MAX_MESSAGE_LENGTH) {
        const chunks: string[] = [];
        let currentChunk = outputContent;

        const lines = content.split('\n');
        for (const line of lines) {
          if ((currentChunk + line).length + 1 > DISCORD_CONSTANTS.MAX_MESSAGE_LENGTH) {
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
            await interaction.followUp({ content: chunks[i], ephemeral: false });
          }
          new Notice(`${t('messages.logs.noteContentOutputSplit')} ${fullPath}`);
          console.log(`${t('messages.logs.noteContentOutputSplit')} ${fullPath}`);
        } else {
          await interaction.editReply(t('messages.discord.emptyNote'));
        }

      } else {
        outputContent += content;
        await interaction.editReply(outputContent);
        new Notice(`${t('messages.logs.noteContentOutput')} ${fullPath}`);
        console.log(`${t('messages.logs.noteContentOutput')} ${fullPath}`);
      }

    } catch (error) {
      if (!(error instanceof Error)) return;
      console.error(`${t('messages.errors.noteReadFailed')} ${fullPath}:`, error);
      await interaction.editReply(`${t('messages.errors.noteReadFailed')} \`${fullPath}\`: ${error.message}`);
      new Notice(`${t('messages.errors.noteReadFailed')} ${fullPath}: ${error.message}`);
    }
  }
}

class SettingTab extends PluginSettingTab {
  plugin: DiscordBridgePlugin;

  constructor(app: App, plugin: DiscordBridgePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: t('settings.title') });

    new Setting(containerEl)
      .setName(t('settings.botToken.name'))
      .setDesc(t('settings.botToken.desc'))
      .addText(text => text
        .setPlaceholder(t('settings.botToken.placeholder'))
        .setValue(this.plugin.settings.botToken)
        .onChange(async (value) => {
          this.plugin.settings.botToken = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.clientId.name'))
      .setDesc(t('settings.clientId.desc'))
      .addText(text => text
        .setPlaceholder(t('settings.clientId.placeholder'))
        .setValue(this.plugin.settings.clientId)
        .onChange(async (value) => {
          this.plugin.settings.clientId = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.channelId.name'))
      .setDesc(t('settings.channelId.desc'))
      .addText(text => text
        .setPlaceholder(t('settings.channelId.placeholder'))
        .setValue(this.plugin.settings.channelId)
        .onChange(async (value) => {
          this.plugin.settings.channelId = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.ownerId.name'))
      .setDesc(t('settings.ownerId.desc'))
      .addText(text => text
        .setPlaceholder(t('settings.ownerId.placeholder'))
        .setValue(this.plugin.settings.ownerId)
        .onChange(async (value) => {
          this.plugin.settings.ownerId = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.notePath.name'))
      .setDesc(t('settings.notePath.desc'))
      .addText(text => {
        text.setPlaceholder(t('settings.notePath.placeholder'))
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