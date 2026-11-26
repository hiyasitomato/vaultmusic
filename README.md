# VaultMusic

Google Drive に置いてある自分の音楽を、iPhone の通学中に **通信なし** で聴くための PWA。

- 既存の Google Drive フォルダを読み取り専用で接続する（アップロード・暗号化・変換なし）
- 保存済みの曲は端末内（IndexedDB）から再生し、モバイル通信を使わない
- 未保存の曲はそのままストリーミング再生（毎回の確認なし）。データを抑えたいときは設定で「未保存の曲を通信で再生する」をOFFにする
- 画面ロック中も動く `<audio>` 1 個 + MediaSession（ロック画面／イヤホン操作）
- オフライン・未ログインでも、カタログと保存済み音源があれば起動できる

設計書: [`docs/superpowers/specs/2026-11-26-vaultmusic-design.md`](docs/superpowers/specs/2026-11-26-vaultmusic-design.md)

## 構成

```
vaultmusic/
  pwa/    Next.js 15 の静的 PWA（Cloudflare Pages / GitHub Pages）
  docs/   設計書と実装計画
```

## クイックスタート

```bash
cd pwa
npm install
cp .env.example .env.local   # NEXT_PUBLIC_GOOGLE_CLIENT_ID を設定
npm run dev
```

`http://localhost:3000` を開き、クライアント ID と音楽フォルダを設定する。

## Google Cloud の設定

VaultStream と同じ OAuth クライアントを再利用できる。

1. Google Cloud Console → 「API とサービス」→ Google Drive API を有効化
2. OAuth クライアント（ウェブアプリケーション）の「承認済みの JavaScript 生成元」に、
   VaultMusic を開くオリジンを追加する
   - `http://localhost:3000`
   - 本番 URL（例：`https://vaultmusic.pages.dev`）
3. クライアント ID を `NEXT_PUBLIC_GOOGLE_CLIENT_ID` か、アプリの設定画面に入力
4. アプリのスコープは `drive.readonly`（読み取りのみ）

音楽フォルダは、設定画面で URL を貼るか「マイドライブの『音楽』を探す」から選ぶ。

## 使い方（通学）

1. Wi-Fi につないだ状態で、アルバム／フォルダ／プレイリストの「保存」を押す
2. ホームの「通学セット」に保存済み曲数と残り容量が出る
3. 設定の「未保存の曲を通信で再生する」をOFFにすると、保存済みの曲だけが鳴る
4. 未保存の曲は、そのままだとストリーミング再生される（通信量に注意）

iPhone の Safari ストレージは実質 1GB 前後のことが多い。全曲（数 GB）は入らないので、
通学で聴く分を選んで保存する。既定の上限は 1.5GB（設定で変更可）。

## デプロイ

```bash
cd pwa
npm run build
npx wrangler pages deploy out --project-name vaultmusic-my
```

`out/` は完全な静的サイト。Cloudflare Pages のルート（サブパスなし）に置く。
GitHub Pages のサブパスに置く場合は `basePath` の設定が必要。

## iPhone 実機チェック（Phase 0）

実装後に必ず確認する。

- [ ] ロック中も再生が続く
- [ ] ロック中に曲が終わったとき、自動で次へ進む
- [ ] ロック画面／イヤホンの再生・停止・次へ・前へが効く
- [ ] MediaSession の artwork が表示される（無くても可）
- [ ] 機内モードで保存済みの曲が再生できる
- [ ] オフライン・未ログインで冷起動できる
- [ ] 60 分後にトークンが切れても、保存済み再生は続く

## テスト

```bash
cd pwa
npm test          # 名前解析・ライブラリ構築・キューの単体テスト
npx tsc --noEmit
npm run build
```

## 既知の制約

- opus は iPhone で再生できない可能性があるため、一覧で警告し再生対象から外している
- カバーアートは「あれば表示」。無い場合は頭文字のプレースホルダ
- 歌詞、EQ、クロスフェード、ギャップレス保証は無し
- 低ビットレート変換はしない（通信削減は事前保存で行う）
- プレイリスト等は端末内のみ（クラウド同期は未実装）

## プライバシー

- Drive は読み取りのみ。作成・更新・削除・共有はしない
- アクセストークンはメモリのみ。解析・トラッキング・外部送信はしない
- 音源は Drive 上にそのまま（暗号化しない）
