# Voice of the Sea — コンテンツ管理ガイド

製作: たみふるD

---

## 初回公開（まだ一度も公開していない場合）

Finderでこのフォルダ（`~/Projects/voice-of-the-sea`）を開き、
**`初回公開セットアップ.command` をダブルクリック**してください。

1. ブラウザが開くので、ターミナルに表示される8桁コードを入力し **Authorize** を押す（GitHubログイン、初回のみ）
2. あとは自動でアップロードと公開設定が完了し、最後に公開URLが表示されます

公開URL: `https://<GitHubユーザー名>.github.io/voice-of-the-sea/` — このURLを共有するだけで誰でも使えます。

---

## コンテンツの追加・差し替え手順

### 音声トラックを追加する

1. **mp3ファイルを配置**
   ```
   audio/XX.mp3      ← 番号トラック(2桁の数字)
   audio/cX.mp3      ← Compassトラック
   ```

2. **data/manifest.json にエントリを追加**

   番号トラックの例（`lat`/`lng`は省略可。指定すると現在地ナビの対象になる）:
   ```json
   {
     "code": "42",
     "title": "トラック名（日本語）",
     "en": "Track Name (English)",
     "file": "audio/42.mp3",
     "lat": 35.626482,
     "lng": 139.885933
   }
   ```
   Compassトラックの例:
   ```json
   {
     "code": "C8",
     "title": "エリア名",
     "file": "audio/c8.mp3"
   }
   ```
   - `tracks` 配列はコード順で追記（94は末尾に保持）
   - `compass` 配列は `C1`〜 の順で追記
   - `en` フィールドは空文字 `""` でも可

3. **デプロイ**
   ```bash
   ./deploy.sh
   ```

---

### スポットの座標を修正する

manifest.json の各トラックの `lat`/`lng` を直接編集して `./deploy.sh`。座標を削除するとマップ上のピンが消え、現在地ナビの対象外になります。

---

## admin.html での検証

ブラウザで `admin.html` を開くと、全トラックのファイル存在確認（○/×）と座標表示・試聴ができます。デプロイ前後に確認することを推奨します。

ローカルでの確認には簡易HTTPサーバが必要です（file://では動作しません）:
```bash
python3 -m http.server 8080
# → http://localhost:8080/admin.html
```

---

## デプロイ方法

```bash
./deploy.sh
```

このスクリプトは変更をコミットして GitHub Pages にプッシュします。プッシュ後 1〜2 分で反映されます。

---

## Claude Code に依頼する場合

このリポジトリのルートで Claude Code を起動し、たとえば「トラック42を追加して。ファイルは audio/42.mp3 に置いた」と伝えるだけで、manifest.json の更新からデプロイまで代わりに行ってくれます。
