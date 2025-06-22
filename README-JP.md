# Discord Bridge for Obsidian

[English README](README.md)

DiscordとObsidianをシームレスに接続する強力なプラグインです。Discordメッセージを自動的にObsidianノートに同期し、Discordコマンドから直接Vaultを管理できます。

## 機能

### 🔄 **メッセージ同期**
- 指定したDiscordチャンネルからObsidianノートへの自動メッセージ保存
- カスタマイズ可能なターゲットノートでのリアルタイムメッセージキャプチャ
- ターゲットファイルが存在しない場合の自動ノート作成

### 🎮 **Discordスラッシュコマンド**
- `/setnote` - Discordメッセージを保存するターゲットノートパスを設定
- `/createnote` - DiscordからObsidian Vaultに新しいノートを作成
- `/listnote` - Vault内のすべてのノートをリスト表示
- `/setchannel` - 監視するDiscordチャンネルを設定
- `/outputnote` - ObsidianノートのコンテンツをDiscordに送信

### 🌐 **多言語サポート**
- i18nextによる完全な国際化サポート
- Obsidian設定からの自動言語検出
- 現在英語と日本語をサポート
- 追加言語への拡張が容易

### ⚡ **堅牢な接続管理**
- 改良されたDiscordクライアント再接続ロジック
- 自動接続監視と復旧
- 無限再接続ループの防止
- リボンボタンによる手動再接続オプション

### 🔐 **セキュリティと権限**
- セキュリティのためのオーナー限定コマンド実行
- ボットトークンとクライアントIDの暗号化保存
- 設定可能なチャンネルとユーザー制限

## インストール

### 手動インストール
1. [リリースページ](https://github.com/yuu1111/obsidian-discord-bridge/releases)から最新版をダウンロード
2. ファイルをVaultのプラグインフォルダに展開: `VaultFolder/.obsidian/plugins/obsidian-discord-bridge-plugin/`
3. Obsidianを再読み込みし、設定 > コミュニティプラグインでプラグインを有効化

### 開発者向け
```bash
# リポジトリをクローン
git clone https://github.com/yuu1111/obsidian-discord-bridge.git
cd obsidian-discord-bridge

# 依存関係をインストール
npm install

# プラグインをビルド
npm run build

# ホットリロード付き開発環境
npm run dev
```

## セットアップ

### 1. Discordボットの作成
1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 新しいアプリケーションとボットを作成
3. **ボットトークン**と**クライアントID**をコピー
4. 以下のボット権限を有効化:
   - メッセージを送信
   - スラッシュコマンドを使用
   - メッセージ履歴を読む
   - チャンネルを見る

### 2. プラグインの設定
1. Obsidian設定 > コミュニティプラグイン > Discord Bridgeを開く
2. **ボットトークン**と**クライアントID**を入力
3. **DiscordユーザーID**を設定（コマンド権限用）
4. 監視する**ターゲットチャンネルID**を設定
5. Discordメッセージが保存される**ノートパス**を設定

### 3. ボットをサーバーに招待
以下のURL形式を使用（`YOUR_CLIENT_ID`を置き換え）:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

## 使用方法

### 基本的なメッセージ同期
1. プラグイン設定でボットトークンとチャンネルIDを設定
2. ターゲットノートパスを設定（例: `Discord/General`）
3. 監視対象のDiscordチャンネルからのメッセージが指定したノートに自動的に表示されます

### Discordコマンド
すべてのコマンドはDiscordスラッシュコマンドとして利用可能：

- **ノートパス設定**: `/setnote path:Notes/Discord`
- **ノート作成**: `/createnote name:会議ノート`
- **ノート一覧**: `/listnote`
- **チャンネル設定**: `/setchannel channel:#general`
- **ノート出力**: `/outputnote note_path:デイリーノート`

### 高度な機能
- **オートコンプリート**: Discordコマンドでノートパスが自動補完
- **多言語対応**: Obsidianの言語設定に合わせてプラグインUIが適応
- **再接続**: 必要に応じてリボンボタンで手動再接続

## 設定

### プラグイン設定
| 設定項目 | 説明 | 必須 |
|---------|-------------|----------|
| ボットトークン | Discordボットのシークレットトークン | ✅ |
| クライアントID | DiscordアプリケーションのクライアントID | ✅ |
| オーナーユーザーID | あなたのDiscordユーザーID（コマンド権限用） | ✅ |
| ターゲットチャンネルID | メッセージを監視するDiscordチャンネル | ✅ |
| ノートパス | メッセージを保存するObsidianノートパス（.md拡張子なし） | ✅ |

### ファイル構造
```
your-vault/
├── .obsidian/
│   └── plugins/
│       └── obsidian-discord-bridge-plugin/
│           ├── main.js
│           ├── manifest.json
│           └── styles.css
└── Discord Messages.md  # 設定したノートファイル
```

## トラブルシューティング

### よくある問題

**ボットがコマンドに応答しない**
- ボットトークンとクライアントIDが正しいことを確認
- DiscordユーザーIDがオーナーユーザーID設定と一致することを確認
- Discordサーバーでボットが適切な権限を持っていることを確認

**メッセージが保存されない**
- ターゲットチャンネルIDが正しいことを確認
- ノートパスが有効で書き込み可能であることを確認
- ボットが設定されたチャンネルを見て読むことができることを確認

**接続の問題**
- Obsidianのリボンにある更新ボタンを使用して再接続
- 詳細なエラーメッセージはコンソールを確認
- 問題が続く場合はObsidianを再起動

### デバッグ情報
詳細なトラブルシューティング情報については、Obsidianで開発者ツール（Ctrl+Shift+I）を有効にしてコンソールログを確認してください。

## コントリビューション

コントリビューションを歓迎します！課題やプルリクエストをお気軽に提出してください。

### 開発環境のセットアップ
1. リポジトリをフォーク
2. 機能ブランチを作成: `git checkout -b feature-name`
3. 変更を加えてテストを追加
4. ビルドを実行: `npm run build`
5. プルリクエストを提出

### 新しい言語の追加
1. `src/i18n.ts`に翻訳を追加
2. 必要に応じて言語検出ロジックを更新
3. 異なる言語設定でテスト

## 変更履歴

### v1.1.0
- 🌐 i18nextによる完全な国際化サポートを追加
- 🔧 無限ループを防ぐDiscord再接続ロジックを改善
- 🏗️ メンテナンスしやすさのための大規模コードリファクタリング
- 🛡️ エラーハンドリングと接続安定性を強化
- 📝 Discordコマンドのオートコンプリートサポートを改善
- 🎯 コマンドオプション検証の問題を修正

### v1.0.0
- 🎉 初回リリース
- ⚡ 基本的なDiscordメッセージ同期
- 🎮 Discordスラッシュコマンド
- 📁 ノート管理機能

## ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細については[LICENSE](LICENSE)ファイルを参照してください。

## サポート

このプラグインが役に立つと思われる場合は、以下をご検討ください：
- ⭐ リポジトリにスターを付ける
- 🐛 バグを報告したり機能をリクエストする
- 💖 [GitHub Sponsors](https://github.com/sponsors/yuu1111)を通じて開発をサポート

---

**注意**: このプラグインにはDiscordボットトークンと適切なサーバー権限が必要です。このプラグインを使用する際は、Discordの利用規約とボットガイドラインに従ってください。