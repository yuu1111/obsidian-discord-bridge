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
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 60000; // 1 minute base delay
  private maxReconnectDelay = 600000; // 10 minutes max delay
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastDisconnectTime = 0;
  private minimumStableConnectionTime = 300000; // 5 minutes stable before reset

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
      
      let errorMessage = error.message;
      let shouldRetry = true;
      
      // Provide more specific error messages for common issues
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        errorMessage = 'Invalid bot token. Please check your Discord bot token in settings.';
        shouldRetry = false; // Don't retry authentication errors
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Network connection failed. Please check your internet connection.';
      } else if (error.message.includes('rate limit') || error.message.includes('429')) {
        errorMessage = 'Discord rate limit exceeded. Retrying in 30 seconds...';
      }
      
      console.error(t('messages.logs.loginFailed'), error);
      new Notice(`${t('messages.logs.loginFailed')} ${errorMessage}`);
      this.callbacks.onStatusUpdate(t('messages.status.loginFailed'));
      
      if (shouldRetry) {
        this.scheduleReconnect();
      }
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.once('ready', async () => {
      console.log(`${t('messages.success.loggedIn')} ${this.client?.user?.tag}!`);
      new Notice(`${t('messages.success.loggedIn')} ${this.client?.user?.tag}!`);
      this.callbacks.onStatusUpdate(`${t('messages.status.connected')} (${this.client?.user?.tag})`);
      
      // Reset reconnection attempts on successful connection
      this.resetReconnectionState();
      
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
      this.lastDisconnectTime = Date.now();
      
      // Only show notice for unexpected disconnections
      if (event.code !== 1000 && event.code !== 1001) {
        new Notice(t('messages.logs.clientDisconnect') + event.reason);
      }
      
      // Don't immediately try to reconnect for certain error codes
      if (this.shouldSkipReconnection(event.code)) {
        console.log(`Skipping reconnection for disconnect code: ${event.code}`);
        return;
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
    
    // If we're already trying to reconnect, skip
    if (this.isReconnecting) {
      return;
    }

    // If we recently attempted reconnection, wait longer
    if ((now - this.lastConnectionAttempt) < this.getReconnectDelay()) {
      return;
    }

    // Check if client is in a bad state and needs reconnection
    const needsReconnect = !this.client || 
                          !this.client.isReady() ||
                          this.client.ws.status === Constants.Status.DISCONNECTED;

    if (needsReconnect) {
      // Wait a bit after disconnect before attempting reconnection
      const timeSinceDisconnect = now - this.lastDisconnectTime;
      if (timeSinceDisconnect < 30000) { // Wait at least 30 seconds after disconnect
        return;
      }
      
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const now = Date.now();
    
    // Prevent multiple concurrent reconnection attempts
    if (this.isReconnecting || this.reconnectTimeout) {
      return;
    }
    
    // Don't attempt reconnect too frequently
    const reconnectDelay = this.getReconnectDelay();
    if ((now - this.lastConnectionAttempt) < reconnectDelay) {
      return;
    }

    // Don't exceed max reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached. Stopping automatic reconnection.');
      this.callbacks.onStatusUpdate('Discord: Max retry attempts reached');
      return;
    }

    this.lastConnectionAttempt = now;
    this.reconnectAttempts++;
    this.isReconnecting = true;

    console.log(`${t('messages.logs.clientReInit')} (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    new Notice(`${t('messages.logs.clientReInit')} (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.callbacks.onStatusUpdate(`Discord: Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    // Use exponential backoff with jitter
    const delay = Math.min(reconnectDelay + (Math.random() * 10000), this.maxReconnectDelay);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.createClient();
    }, delay);
  }

  private getReconnectDelay(): number {
    // Exponential backoff: base * (2 ^ attempts)
    return Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
  }

  private resetReconnectionState(): void {
    const now = Date.now();
    
    // If we've been connected for a reasonable time, reset retry count
    if (this.lastConnectionAttempt > 0 && (now - this.lastConnectionAttempt) > this.minimumStableConnectionTime) {
      this.reconnectAttempts = 0;
      console.log('Connection stable, reset reconnection attempts');
    }
    
    this.isReconnecting = false;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private shouldSkipReconnection(code: number): boolean {
    // Skip reconnection for certain Discord close codes
    const skipCodes = [
      4004, // Authentication failed
      4010, // Invalid shard
      4011, // Sharding required
      4012, // Invalid API version
      4013, // Invalid intent(s)
      4014  // Disallowed intent(s)
    ];
    return skipCodes.includes(code);
  }

  async forceReconnect(): Promise<void> {
    console.log('Force reconnect requested');
    
    // Clean up any existing reconnection state
    this.resetReconnectionState();
    this.reconnectAttempts = 0; // Reset attempts for manual reconnection
    
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
    
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
    console.log('DiscordManager destroy called');
    
    // Clear all intervals and timeouts
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Reset reconnection state
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    
    // Destroy Discord client
    if (this.client) {
      this.client.destroy();
      console.log(t('messages.logs.clientDestroyed'));
      this.client = null;
    }
  }
}