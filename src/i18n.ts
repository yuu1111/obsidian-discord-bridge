import { moment } from "obsidian";
import i18next from "i18next";

// Translation resources
const enTranslations = {
  "pluginName": "Discord Bridge",
  "pluginDescription": "Bridge between Discord and Obsidian for message synchronization",
  "settings": {
    "title": "Discord Bridge Plugin Settings",
    "botToken": {
      "name": "Bot Token",
      "desc": "Enter your Discord bot token",
      "placeholder": "Enter Discord bot token"
    },
    "clientId": {
      "name": "Client ID",
      "desc": "Enter your Discord bot client ID",
      "placeholder": "Enter Discord bot client ID"
    },
    "channelId": {
      "name": "Target Channel ID",
      "desc": "Specify the Discord channel ID for the bot to monitor",
      "placeholder": "Enter Discord channel ID"
    },
    "ownerId": {
      "name": "Owner User ID",
      "desc": "Specify your Discord user ID. Commands will only be allowed for this user",
      "placeholder": "Enter your Discord user ID"
    },
    "notePath": {
      "name": "Note Path",
      "desc": "Specify the path to the note in the Vault where Discord messages will be appended. Do not include .md",
      "placeholder": "Folder/Discord"
    }
  },
  "commands": {
    "setNote": {
      "description": "Set the note path for saving Discord messages",
      "pathOption": {
        "description": "Full path to the note. Example: Notes/Discord"
      }
    },
    "createNote": {
      "description": "Create a note at the specified location",
      "nameOption": {
        "description": "Path and name of the new note. Example: Folder/NewNote"
      }
    },
    "listNote": {
      "description": "List all notes in the Vault"
    },
    "setChannel": {
      "description": "Set the target channel for saving Discord messages to notes",
      "channelOption": {
        "description": "Channel to monitor for messages"
      }
    },
    "outputNote": {
      "description": "Output the contents of the specified note to Discord",
      "notePathOption": {
        "description": "Path to the note you want to output. Example: Folder/Discord"
      }
    }
  },
  "messages": {
    "status": {
      "error": "Discord: Error",
      "disconnected": "Discord: Disconnected",
      "reconnecting": "Discord: Reconnecting...",
      "loginFailed": "Discord: Login Failed",
      "connected": "Discord: Connected",
      "noToken": "Discord: No Token"
    },
    "logs": {
      "clientReInit": "Attempting to reinitialize Discord client...",
      "clientError": "Discord client error:",
      "clientDisconnect": "Discord client disconnected:",
      "clientReconnect": "Discord client reconnecting...",
      "loginFailed": "Failed to login to Discord:",
      "clientDestroyed": "Discord client destroyed",
      "clientReady": "Discord client is ready and connected",
      "clientAlreadyReady": "Discord client is already initialized and ready",
      "commandsRegistered": "Slash commands registered:",
      "commandRegistrationFailed": "Failed to register slash commands:",
      "targetChannelUpdated": "Updated Discord target channel:",
      "targetNoteUpdated": "Updated target note path:",
      "noteCreated": "Created new note:",
      "folderCreated": "Created folder:",
      "noteListOutput": "Output note list to Discord",
      "noteContentOutput": "Output note content to Discord:",
      "noteContentOutputSplit": "Output note content to Discord: (split messages)",
      "messageReceived": "Received message in target channel:",
      "messageSaved": "Saved message to",
      "newNoteCreatedForMessage": "Created new note for Discord messages:"
    },
    "errors": {
      "noPermission": "You do not have permission to use this command",
      "unknownCommand": "Unknown command",
      "invalidNotePath": "Invalid note path specified. Please specify a valid path. Example: Folder/Note",
      "invalidNoteName": "Invalid note name specified",
      "invalidChannelId": "Invalid channel ID specified. Discord channel IDs are numeric strings",
      "noteNotFound": "Note not found. Please check the path",
      "noteAlreadyExists": "Note already exists. Use /setnote command to select it",
      "folderCreationFailed": "Failed to create folder",
      "noteCreationFailed": "Failed to create note",
      "noteReadFailed": "Failed to read or output note",
      "messageSaveFailed": "Failed to save Discord message to note",
      "autocompleteResponseFailed": "Failed to respond to autocomplete:",
      "noteListRetrievalFailed": "Failed to retrieve note list. Check console for details",
      "clientNotReady": "Discord client is not ready or application ID is not available for command registration",
      "missingClientId": "Client ID not set. Cannot register slash commands",
      "missingBotToken": "Bot token not set in plugin settings. Please configure it",
      "cannotRegisterCommands": "Client ID missing. Cannot register slash commands",
      "invalidPath": "Invalid path. Please specify a file name",
      "noFileName": "No file name specified"
    },
    "success": {
      "commandsRegistered": "Slash commands successfully registered!",
      "targetNoteUpdated": "Updated target note path to",
      "noteCreated": "Created new note:",
      "folderCreated": "Created folder:",
      "targetChannelUpdated": "Updated Discord message target channel to",
      "noteListOutput": "Output note list to Discord",
      "noteContentOutput": "Output note content to Discord:",
      "loggedIn": "Logged in as"
    },
    "discord": {
      "currentTargetNote": "**Current target note:**",
      "vaultNotes": "**Notes in Vault:**",
      "obsidianNote": "**Obsidian Note:**",
      "noNotesFound": "No Markdown notes found in Vault",
      "emptyNote": "Note content is empty"
    },
    "ribbon": {
      "refreshConnection": "Refresh Discord connection"
    }
  }
};

const jaTranslations = {
  "pluginName": "Discord Bridge",
  "pluginDescription": "DiscordとObsidianのメッセージ同期用ブリッジ",
  "settings": {
    "title": "Discord Bridge プラグイン設定",
    "botToken": {
      "name": "ボットトークン",
      "desc": "BotのTokenを入れる",
      "placeholder": "Discordボットのトークンを入力"
    },
    "clientId": {
      "name": "クライアントID",
      "desc": "BotのClientIDを入れる",
      "placeholder": "DiscordボットのクライアントIDを入力"
    },
    "channelId": {
      "name": "ターゲットチャンネルID",
      "desc": "Botで監視するDiscordチャンネルのIDを指定する",
      "placeholder": "DiscordチャンネルのIDを入力"
    },
    "ownerId": {
      "name": "オーナーユーザーID",
      "desc": "あなたのDiscordユーザーIDを指定する コマンドはこのユーザーのみに実行が許可される",
      "placeholder": "あなたのDiscordユーザーIDを入力"
    },
    "notePath": {
      "name": "ノートパス",
      "desc": "Discordメッセージを追記するVault内のノートのパスを指定する .mdは含めないこと",
      "placeholder": "Folder/Discord"
    }
  },
  "commands": {
    "setNote": {
      "description": "Discordメッセージを保存するノートのパスを設定します",
      "pathOption": {
        "description": "ノートのフルパス 例: Notes/Discord"
      }
    },
    "createNote": {
      "description": "指定した場所にノートを作成します",
      "nameOption": {
        "description": "新しいノートのパスと名前 例: Folder/NewNote"
      }
    },
    "listNote": {
      "description": "Vault内のすべてのノートをリスト表示します"
    },
    "setChannel": {
      "description": "Discordメッセージをノートに保存するターゲットチャンネルを設定します",
      "channelOption": {
        "description": "メッセージを監視するチャンネル"
      }
    },
    "outputNote": {
      "description": "指定したノートの内容をDiscordに出力します",
      "notePathOption": {
        "description": "出力したいノートのパス 例: Folder/Discord"
      }
    }
  },
  "messages": {
    "status": {
      "error": "Discord: エラー",
      "disconnected": "Discord: 未接続",
      "reconnecting": "Discord: 再接続中...",
      "loginFailed": "Discord: ログイン失敗",
      "connected": "Discord: 接続済み",
      "noToken": "Discord: トークンなし"
    },
    "logs": {
      "clientReInit": "Discordクライアントの再初期化を試行中...",
      "clientError": "Discordクライアントエラー:",
      "clientDisconnect": "Discordクライアントが切断されました:",
      "clientReconnect": "Discordクライアントが再接続中...",
      "loginFailed": "Discordへのログインに失敗しました:",
      "clientDestroyed": "Discordクライアントが破棄されました",
      "clientReady": "Discordクライアントの準備が完了し、接続されました",
      "clientAlreadyReady": "Discordクライアントは既に初期化され、準備ができています",
      "commandsRegistered": "スラッシュコマンドが登録されました:",
      "commandRegistrationFailed": "スラッシュコマンドの登録に失敗しました:",
      "targetChannelUpdated": "Discordターゲットチャンネルを更新しました:",
      "targetNoteUpdated": "ターゲットノートパスを更新しました:",
      "noteCreated": "新しいノートを作成しました:",
      "folderCreated": "フォルダを作成しました:",
      "noteListOutput": "ノートリストをDiscordに出力しました",
      "noteContentOutput": "ノートの内容をDiscordに出力しました:",
      "noteContentOutputSplit": "ノートの内容をDiscordに出力しました: (分割送信)",
      "messageReceived": "ターゲットチャンネルでメッセージを受信しました:",
      "messageSaved": "メッセージを保存しました:",
      "newNoteCreatedForMessage": "Discordメッセージ用の新しいノートを作成しました:"
    },
    "errors": {
      "noPermission": "このコマンドを使用する権限がありません",
      "unknownCommand": "不明なコマンドです",
      "invalidNotePath": "無効なノートパスが指定されました 有効なパスを指定してください 例: Folder/Note",
      "invalidNoteName": "無効なノート名が指定されました",
      "invalidChannelId": "無効なチャンネルIDが指定されました DiscordのチャンネルIDは数字の羅列です",
      "noteNotFound": "ノートが見つかりませんでした パスを確認してください",
      "noteAlreadyExists": "ノートは既に存在します /setnote コマンドで選択してください",
      "folderCreationFailed": "フォルダの作成に失敗しました",
      "noteCreationFailed": "ノートの作成に失敗しました",
      "noteReadFailed": "ノートの読み込みまたは出力に失敗しました",
      "messageSaveFailed": "Discordメッセージをノートに保存できませんでした",
      "autocompleteResponseFailed": "オートコンプリートの応答に失敗しました:",
      "noteListRetrievalFailed": "ノートリストの取得に失敗しました コンソールを確認してください",
      "clientNotReady": "Discordクライアントが準備できていないか、アプリケーションIDがコマンド登録に利用できません",
      "missingClientId": "クライアントIDが設定されていません スラッシュコマンドを登録できません",
      "missingBotToken": "ボットトークンがプラグイン設定で設定されていません 設定してください",
      "cannotRegisterCommands": "クライアントIDが不足しています スラッシュコマンドを登録できません",
      "invalidPath": "無効なパスです ファイル名を指定してください",
      "noFileName": "ファイル名が指定されていません"
    },
    "success": {
      "commandsRegistered": "スラッシュコマンドが正常に登録されました！",
      "targetNoteUpdated": "ターゲットノートパスを更新しました:",
      "noteCreated": "新しいノートを作成しました:",
      "folderCreated": "フォルダを作成しました:",
      "targetChannelUpdated": "Discordメッセージ保存のターゲットチャンネルを更新しました:",
      "noteListOutput": "ノートリストをDiscordに出力しました",
      "noteContentOutput": "ノートの内容をDiscordに出力しました:",
      "loggedIn": "ログインしました:"
    },
    "discord": {
      "currentTargetNote": "**現在保存しているノート:**",
      "vaultNotes": "**Vault内のノート:**",
      "obsidianNote": "**Obsidianノート:**",
      "noNotesFound": "Vault内にMarkdownノートは見つかりませんでした",
      "emptyNote": "ノートの内容は空です"
    },
    "ribbon": {
      "refreshConnection": "Discord接続を更新"
    }
  }
};

export async function initializeI18n(app?: any): Promise<void> {
  // Detect language from multiple sources
  let detectedLanguage = 'en';
  
  // First try localStorage (Obsidian's language setting)
  const localStorageLanguage = localStorage.getItem('language');
  if (localStorageLanguage) {
    console.log(`Language from localStorage: ${localStorageLanguage}`);
    detectedLanguage = localStorageLanguage;
  } else {
    // Fallback to other methods
    const obsidianLocale = app?.vault?.adapter?.app?.locale || moment.locale();
    console.log(`Fallback language detection: ${obsidianLocale}`);
    
    if (obsidianLocale === 'ja' || obsidianLocale.startsWith('ja')) {
      detectedLanguage = 'ja';
    }
  }
  
  // Normalize language code for i18next
  if (detectedLanguage.startsWith('ja')) {
    detectedLanguage = 'ja';
  } else {
    detectedLanguage = 'en';
  }
  
  console.log(`Final detected language: ${detectedLanguage}`);
  
  await i18next.init({
    lng: detectedLanguage,
    fallbackLng: 'en',
    debug: false,
    resources: {
      en: {
        translation: enTranslations
      },
      ja: {
        translation: jaTranslations
      }
    },
    interpolation: {
      escapeValue: false
    }
  });
  
  console.log('i18next initialized successfully');
}

export function t(key: string, options?: any): string {
  return i18next.t(key, options) as string;
}

export function getCurrentLanguage(): string {
  return i18next.language;
}

export function setLanguage(lang: string): Promise<any> {
  return i18next.changeLanguage(lang);
}