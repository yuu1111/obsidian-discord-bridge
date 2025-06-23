# Discord Bridge for Obsidian

[English README](README.md)

**Discordの会話を自動的にObsidianノートに整理保存**

大切なDiscordメッセージを知識ベースに保存したい、DiscordからObsidianを操作したいと思ったことはありませんか？このプラグインが会話とノートの間の橋渡しをします。

## 機能

### 💬 **Discordメッセージの自動保存**
- 指定したDiscordチャンネルのメッセージをObsidianノートに自動保存
- リアルタイムでメッセージを同期

### 🎮 **Discordスラッシュコマンド**
- `/createnote` - 新しいノートを作成
- `/listnote` - ノート一覧を表示
- `/outputnote` - ノート内容をDiscordに出力
- `/setnote` - メッセージ保存先を変更

### 🔧 **設定とセキュリティ**
- 自動再接続機能
- ユーザーID認証（設定したユーザーのみコマンド使用可能）
- 日本語・英語対応


## かんたんセットアップ（5分）

### ステップ1: Discordボットの準備
1. [Discord Developer Portal](https://discord.com/developers/applications) → 「New Application」
2. ボットを作成し、**ボットトークン**と**アプリケーションID**をコピー
3. [このリンク](https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands)でボットをサーバーに招待（YOUR_CLIENT_IDを置き換え）

### ステップ2: プラグインの設定
1. Obsidianでプラグインをインストール
2. 設定で**ボットトークン**と**クライアントID**を貼り付け
3. **DiscordユーザーID**を追加（Discordで自分の名前を右クリック → ユーザーIDをコピー）
4. 監視する**チャンネル**と保存先**ノート**を設定

これで完了！選択したチャンネルのメッセージがObsidianノートに表示されます。

## 使用可能なコマンド

セットアップ後、Discordでこれらを入力:

- `/setnote path:研究ノート` - メッセージの保存先を変更
- `/createnote name:チーム会議 1月15日` - 新しいノートを作成
- `/listnote` - すべてのノートを表示
- `/outputnote note_path:プロジェクト状況` - ノートをDiscordチャンネルに共有

## インストール

### ソースからビルド
```bash
# リポジトリをクローン
git clone https://github.com/yuu1111/obsidian-discord-bridge.git
cd obsidian-discord-bridge

# 依存関係をインストール
npm install

# プラグインをビルド
npm run build

# ビルドファイルをObsidianプラグインフォルダにコピー
# VaultFolder/.obsidian/plugins/obsidian-discord-bridge-plugin/
```

3. Obsidianを再起動して設定で有効化

## セキュリティとプライバシー

**データの取り扱い:**
- ボットトークンとクライアントIDはObsidian内にBase64エンコーディングでローカル保存
- Discord公式API以外の外部サーバーにはデータを送信しません
- 設定されたチャンネルのメッセージのみを処理
- ユーザー認証により不正なコマンド使用を防止

**権限:**
- ボットに必要な最小限のDiscord権限：メッセージ送信とスラッシュコマンドの使用
- 明示的に設定しない限り、ボットはDMを読み取れません
- プラグインはローカルのObsidian vault内でのみ動作

**ベストプラクティス:**
- ボットトークンを安全に保管し、他人と共有しないでください
- 設定されたチャンネルとユーザー権限を定期的に確認してください
- 必要に応じて専用のDiscordサーバーでテストしてください

## トラブルシューティング

**ボットがコマンドに応答しない？**
- 設定のDiscordユーザーIDが正しいか確認
- ボットがサーバーで権限を持っているか確認

**メッセージが保存されない？**
- チャンネルIDが正しいか確認（チャンネル右クリック → チャンネルIDをコピー）
- ノートパスが存在するかプラグインが作成可能か確認

**困ったときは？**
- コンソール（Ctrl+Shift+I）でエラーメッセージを確認
- Obsidianツールバーの更新ボタンを試す
- [こちらで問題を報告](https://github.com/yuu1111/obsidian-discord-bridge/issues)

## コントリビューション

バグを見つけたり機能が欲しい場合は、[Issue作成](https://github.com/yuu1111/obsidian-discord-bridge/issues)やプルリクエストをお願いします！

### 開発環境のセットアップ
1. リポジトリをフォーク
2. ローカルマシンにクローン
3. 依存関係をインストール: `npm install`
4. 開発ビルドを開始: `npm run dev`
5. 変更を加えてテスト
6. プルリクエストを提出


## プロジェクトのサポート

このプラグインが役に立ったら:
- ⭐ リポジトリにスターを付ける
- 🐛 バグ報告で改善に協力

---

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

このプロジェクトはISCライセンスの下でライセンスされています - 詳細については[LICENSE](LICENSE)ファイルを参照してください。

**ObsidianとDiscordコミュニティへの❤️を込めて**