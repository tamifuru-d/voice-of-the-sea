#!/bin/bash
# Voice of the Sea — 初回公開セットアップ
# このファイルをダブルクリックするだけで、GitHubへの公開が完了します。
# (2回目以降のコンテンツ更新は deploy.sh を使ってください)

cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "🌊 Voice of the Sea — 初回公開セットアップ"
echo "============================================"

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ GitHub CLI (gh) が見つかりません。ターミナルで brew install gh を実行してください。"
  read -r -p "Enterで終了"; exit 1
fi

# 1. GitHub認証(未認証のときだけ)
if ! gh auth status --hostname github.com >/dev/null 2>&1; then
  echo ""
  echo "📝 GitHubへのログインが必要です(初回のみ)。"
  echo "   このあとブラウザが開きます。ターミナルに表示される 8桁のコード を"
  echo "   ブラウザに入力し、緑色の Authorize ボタンを押してください。"
  echo ""
  gh auth login --hostname github.com --git-protocol https --web || { echo "❌ 認証に失敗しました"; read -r -p "Enterで終了"; exit 1; }
fi
gh auth setup-git --hostname github.com >/dev/null 2>&1

OWNER=$(gh api user -q .login)
REPO="voice-of-the-sea"
echo "✅ GitHub認証OK: $OWNER"

# 2. リポジトリ作成 & プッシュ(音声157MBのため数分かかることがあります)
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO.git"
  echo "📤 既存リポジトリへプッシュ中..."
  git push -u origin main || { echo "❌ プッシュに失敗しました"; read -r -p "Enterで終了"; exit 1; }
else
  echo "📤 リポジトリを作成してアップロード中(数分かかります)..."
  gh repo create "$REPO" --public --source . --remote origin --push || { echo "❌ 作成に失敗しました"; read -r -p "Enterで終了"; exit 1; }
fi

# 3. GitHub Pages 有効化(既に有効なら何もしない)
gh api -X POST "repos/$OWNER/$REPO/pages" \
  -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1
URL=$(gh api "repos/$OWNER/$REPO/pages" -q .html_url 2>/dev/null)
[ -z "$URL" ] && URL="https://$OWNER.github.io/$REPO/"

echo ""
echo "============================================"
echo "🎉 公開設定が完了しました!"
echo "   公開URL: $URL"
echo "   (初回は反映まで1〜3分かかります)"
echo "============================================"
echo "90秒後にブラウザで開きます..."
sleep 90
open "$URL"
read -r -p "Enterで終了"
