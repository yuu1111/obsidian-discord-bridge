import { Client, Intents, TextChannel, Interaction, CommandInteraction, Constants } from 'discord.js';
import { Notice } from 'obsidian';
import { t } from './i18n';
import { PluginSettings } from './types';
import { DISCORD_COMMANDS, DISCORD_CONSTANTS, DISCORD_COMMAND_TYPES } from './constants';

export interface DiscordManagerCallbacks {
  onMessageReceived: (content: string) => Promise<void>;
  onStatusUpdate: (status: string) => void;
  updateTargetNote: (path: string, interaction: CommandInteraction) => Promise<void>;
  createNewNote: (name: string, interaction: CommandInteraction) => Promise<void>;
  listObsidianNotes: (interaction: CommandInteraction) => Promise<void>;
  updateTargetChannel: (channelId: string, interaction: CommandInteraction) => Promise<void>;
  outputObsidianNote: (notePath: string, interaction: CommandInteraction) => Promise<void>;
  getMarkdownFiles: () => any[];
}

export class DiscordManager {
  private client: Client | null = null;
  private isReconnecting = false;
  private lastConnectionAttempt = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 30000; // 30 seconds
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private settings: PluginSettings,
    private callbacks: DiscordManagerCallbacks
  ) {}

  async initialize(): Promise<void> {
    if (this.client?.isReady()) {
      console.log(t('messages.logs.clientAlreadyReady'));
      return;
    }

    if (!this.settings.botToken) {
      new Notice(t('messages.errors.missingBotToken'));
      this.callbacks.onStatusUpdate(t('messages.status.noToken'));
      return;
    }

    await this.createClient();
    this.startConnectionMonitoring();
  }

  private async createClient(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }

    this.client = new Client({
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.MESSAGE_CONTENT,
        Intents.FLAGS.DIRECT_MESSAGES,
      ],
      partials: ['CHANNEL'],
    });

    this.setupEventListeners();
    
    try {
      await this.client.login(this.settings.botToken);
      this.reconnectAttempts = 0; // Reset on successful connection
    } catch (error) {
      if (!(error instanceof Error)) return;
      console.error(t('messages.logs.loginFailed'), error);
      new Notice(t('messages.logs.loginFailed') + error.message);
      this.callbacks.onStatusUpdate(t('messages.status.loginFailed'));
      this.scheduleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.once('ready', async () => {
      console.log(`${t('messages.success.loggedIn')} ${this.client?.user?.tag}!`);
      new Notice(`${t('messages.success.loggedIn')} ${this.client?.user?.tag}!`);
      this.callbacks.onStatusUpdate(`${t('messages.status.connected')} (${this.client?.user?.tag})`);
      this.setupInteractionListeners();
      
      if (this.settings.clientId) {
        await this.registerSlashCommands();
      } else {
        new Notice(t('messages.errors.missingClientId'));
        console.warn(t('messages.errors.missingClientId'));
      }
    });

    this.client.on('error', (error) => {
      console.error(t('messages.logs.clientError'), error);
      new Notice(t('messages.logs.clientError') + error.message);
      this.callbacks.onStatusUpdate(t('messages.status.error'));
    });

    this.client.on('shardDisconnect', (event) => {
      console.warn(t('messages.logs.clientDisconnect'), event.reason);
      this.callbacks.onStatusUpdate(t('messages.status.disconnected'));
      // Don't show notice for expected disconnections
      if (event.code !== 1000) {
        new Notice(t('messages.logs.clientDisconnect') + event.reason);
      }
    });

    this.client.on('shardReconnecting', () => {
      console.log(t('messages.logs.clientReconnect'));
      this.callbacks.onStatusUpdate(t('messages.status.reconnecting'));
      this.isReconnecting = true;
    });

    this.client.on('shardReady', () => {
      console.log(t('messages.logs.clientReady'));
      this.isReconnecting = false;
    });

    this.client.on('shardResume', () => {
      console.log('Discord client resumed connection');
      this.isReconnecting = false;
    });
  }

  private setupInteractionListeners(): void {
    if (!this.client) return;

    this.client.on('messageCreate', async message => {
      if (message.author.bot) return;

      if (this.settings.channelId && message.channel.id === this.settings.channelId) {
        console.log(`${t('messages.logs.messageReceived')} ${message.content}`);
        await this.callbacks.onMessageReceived(message.content);
      }
    });

    this.client.on('interactionCreate', async (interaction: Interaction) => {
      try {
        if (interaction.isCommand()) {
          if (this.settings.ownerId && interaction.user.id !== this.settings.ownerId) {
            await interaction.reply({content: t('messages.errors.noPermission'), ephemeral: true});
            return;
          }

          const commandInteraction = interaction as CommandInteraction;
          await this.handleSlashCommand(commandInteraction);
        } else if (interaction.isAutocomplete()) {
          await this.handleAutocomplete(interaction);
        }
      } catch (error) {
        console.error('Error handling interaction:', error);
        // Try to respond to the interaction if it hasn't been replied to yet
        try {
          if (interaction.isCommand() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: 'An error occurred while processing your command.',
              ephemeral: true
            });
          }
        } catch (replyError) {
          console.error('Failed to send error response:', replyError);
        }
      }
    });
  }

  private async handleSlashCommand(interaction: CommandInteraction): Promise<void> {
    switch (interaction.commandName) {
      case DISCORD_COMMANDS.SET_NOTE_PATH: {
        const pathOption = interaction.options.getString('path', true);
        await interaction.deferReply();
        await this.callbacks.updateTargetNote(pathOption, interaction);
        break;
      }
      case DISCORD_COMMANDS.CREATE_NOTE: {
        const nameOption = interaction.options.getString('name', true);
        await this.callbacks.createNewNote(nameOption, interaction);
        break;
      }
      case DISCORD_COMMANDS.LIST_NOTE: {
        await this.callbacks.listObsidianNotes(interaction);
        break;
      }
      case DISCORD_COMMANDS.SET_CHANNEL: {
        const channelOption = interaction.options.getChannel('channel', true);
        await interaction.deferReply();
        await this.callbacks.updateTargetChannel(channelOption.id, interaction);
        break;
      }
      case DISCORD_COMMANDS.OUTPUT_NOTE: {
        const notePathOption = interaction.options.getString('note_path', true);
        await interaction.deferReply();
        await this.callbacks.outputObsidianNote(notePathOption, interaction);
        break;
      }
      default: {
        await interaction.reply({content: t('messages.errors.unknownCommand'), ephemeral: true});
        break;
      }
    }
  }

  private async handleAutocomplete(interaction: any): Promise<void> {
    try {
      if (!interaction || !interaction.options) {
        console.warn('Invalid autocomplete interaction received');
        return;
      }

      const focusedOption = interaction.options.getFocused(true);
      if (!focusedOption) {
        console.warn('No focused option found in autocomplete');
        await interaction.respond([]);
        return;
      }

      const userQuery = (focusedOption.value || '').toLowerCase();
      const commandName = interaction.commandName;

      let suggestions: { name: string; value: string }[] = [];

      if ((commandName === DISCORD_COMMANDS.SET_NOTE_PATH && focusedOption.name === 'path') ||
          (commandName === DISCORD_COMMANDS.OUTPUT_NOTE && focusedOption.name === 'note_path')) {

        try {
          const allMarkdownFiles = this.callbacks.getMarkdownFiles();
          if (allMarkdownFiles && Array.isArray(allMarkdownFiles)) {
            const filteredFiles = allMarkdownFiles.filter(file => {
              if (!file || !file.path) return false;
              const pathWithoutExtension = file.path.slice(0, -3).toLowerCase();
              return pathWithoutExtension.includes(userQuery);
            });

            suggestions = filteredFiles.slice(0, DISCORD_CONSTANTS.MAX_AUTOCOMPLETE_SUGGESTIONS)
              .map(file => {
                const pathWithoutExtension = file.path.slice(0, -3);
                return {
                  name: pathWithoutExtension.length > 100 ? pathWithoutExtension.substring(0, 97) + '...' : pathWithoutExtension,
                  value: pathWithoutExtension
                };
              });
          }
        } catch (fileError) {
          console.error('Error getting markdown files for autocomplete:', fileError);
        }
      }

      await interaction.respond(suggestions);
    } catch (error) {
      console.error(t('messages.errors.autocompleteResponseFailed'), error);
      // Try to respond with empty array if possible
      try {
        if (interaction && typeof interaction.respond === 'function') {
          await interaction.respond([]);
        }
      } catch (fallbackError) {
        console.error('Failed to send fallback autocomplete response:', fallbackError);
      }
    }
  }

  private async registerSlashCommands(): Promise<void> {
    if (!this.client?.application?.id) {
      console.error(t('messages.errors.clientNotReady'));
      return;
    }
    if (!this.settings.clientId) {
      new Notice(t('messages.errors.missingClientId'));
      console.error(t('messages.errors.cannotRegisterCommands'));
      return;
    }

    const commands = [
      {
        name: DISCORD_COMMANDS.SET_NOTE_PATH,
        description: t('commands.setNote.description'),
        options: [
          {
            name: 'path',
            description: t('commands.setNote.pathOption.description'),
            type: DISCORD_COMMAND_TYPES.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        name: DISCORD_COMMANDS.CREATE_NOTE,
        description: t('commands.createNote.description'),
        options: [
          {
            name: 'name',
            description: t('commands.createNote.nameOption.description'),
            type: DISCORD_COMMAND_TYPES.STRING,
            required: true,
          },
        ],
      },
      {
        name: DISCORD_COMMANDS.LIST_NOTE,
        description: t('commands.listNote.description'),
      },
      {
        name: DISCORD_COMMANDS.SET_CHANNEL,
        description: t('commands.setChannel.description'),
        options: [
          {
            name: 'channel',
            description: t('commands.setChannel.channelOption.description'),
            type: DISCORD_COMMAND_TYPES.CHANNEL,
            required: true,
          },
        ],
      },
      {
        name: DISCORD_COMMANDS.OUTPUT_NOTE,
        description: t('commands.outputNote.description'),
        options: [
          {
            name: 'note_path',
            description: t('commands.outputNote.notePathOption.description'),
            type: DISCORD_COMMAND_TYPES.STRING,
            required: true,
            autocomplete: true,
          },
        ],
      },
    ];

    try {
      await this.client.application.commands.set(commands);
      new Notice(t('messages.success.commandsRegistered'));
      console.log(t('messages.logs.commandsRegistered'), commands);
    } catch (error) {
      if (!(error instanceof Error)) return;
      console.error(t('messages.logs.commandRegistrationFailed'), error);
      new Notice(`${t('messages.logs.commandRegistrationFailed')} ${error.message}`);
    }
  }

  private startConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    this.connectionCheckInterval = setInterval(() => {
      this.checkConnection();
    }, DISCORD_CONSTANTS.RECONNECT_CHECK_INTERVAL);
  }

  private checkConnection(): void {
    if (!this.settings.botToken) return;
    
    const now = Date.now();
    
    // If we're already trying to reconnect and it's been too recent, skip
    if (this.isReconnecting && (now - this.lastConnectionAttempt) < this.reconnectDelay) {
      return;
    }

    // Check if client is in a bad state and needs reconnection
    const needsReconnect = !this.client || 
                          !this.client.isReady() ||
                          this.client.ws.status === Constants.Status.DISCONNECTED;

    if (needsReconnect && !this.isReconnecting) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const now = Date.now();
    
    // Don't attempt reconnect too frequently
    if ((now - this.lastConnectionAttempt) < this.reconnectDelay) {
      return;
    }

    // Don't exceed max reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached. Stopping automatic reconnection.');
      return;
    }

    this.lastConnectionAttempt = now;
    this.reconnectAttempts++;
    this.isReconnecting = true;

    console.log(t('messages.logs.clientReInit'));
    new Notice(t('messages.logs.clientReInit'));

    // Delay the reconnection attempt
    setTimeout(() => {
      this.createClient();
    }, 5000); // 5 second delay
  }

  async forceReconnect(): Promise<void> {
    this.reconnectAttempts = 0; // Reset attempts for manual reconnection
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    this.isReconnecting = false;
    await this.initialize();
  }

  updateSettings(newSettings: PluginSettings): void {
    this.settings = newSettings;
  }

  async getChannel(channelId: string): Promise<TextChannel | null> {
    if (!this.client?.isReady()) return null;
    
    try {
      const channel = await this.client.channels.fetch(channelId);
      return channel instanceof TextChannel ? channel : null;
    } catch (error) {
      console.error('Failed to fetch channel:', error);
      return null;
    }
  }

  destroy(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    if (this.client) {
      this.client.destroy();
      console.log(t('messages.logs.clientDestroyed'));
      this.client = null;
    }
  }
}