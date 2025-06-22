export const DISCORD_COMMANDS = {
  SET_NOTE_PATH: 'setnote',
  CREATE_NOTE: 'createnote',
  LIST_NOTE: 'listnote',
  SET_CHANNEL: 'setchannel',
  OUTPUT_NOTE: 'outputnote',
} as const;

export const DISCORD_CONSTANTS = {
  MAX_MESSAGE_LENGTH: 1990,
  RECONNECT_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  MAX_PATH_LENGTH: 255,
  MAX_AUTOCOMPLETE_SUGGESTIONS: 25,
} as const;

export const DISCORD_COMMAND_TYPES = {
  STRING: 3,
  CHANNEL: 7,
} as const;

export const INVALID_FILENAME_CHARS_REGEX = /[<>:"|?*]/g;