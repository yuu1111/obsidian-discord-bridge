export interface PluginSettings {
  botToken: string;
  clientId: string;
  ownerId: string;
  channelId: string;
  targetNotePath: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  botToken: '',
  clientId: '',
  ownerId: '',
  channelId: '',
  targetNotePath: 'Discord_Messages',
};