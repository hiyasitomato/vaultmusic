# VaultMusic 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Drive の既存音楽フォルダを、iPhone の通学中に通信なしで聴ける PWA として実装する。

**Architecture:** Next.js 静的 export のクライアント専用 SPA。Drive API（読み取り専用）でフォルダを再帰列挙し、メタデータを IndexedDB にキャッシュ。音声は「保存済み Blob → 許可時のみ Drive ストリーミング」の順で再生し、`<audio>` 1 個と MediaSession でバックグラウンド再生する。

**Tech Stack:** Next.js 15 / React 19 / TypeScript / Tailwind CSS 4 / lucide-react / music-metadata-browser / Vitest / IndexedDB

**Spec:** `docs/superpowers/specs/2026-11-26-vaultmusic-design.md`

## Global Constraints

- Drive は読み取りのみ（作成・更新・削除・共有をしない）。
- モバイル通信は既定 OFF。未保存曲はサイズ確認なしに再生しない。
- 認証スコープは `https://www.googleapis.com/auth/drive.readonly`。
- 音源ファイルは変更しない。低ビットレート変換をしない。
- Web Audio API を使わない。`<audio>` 要素 1 個。
- カバーは無くても崩れない。プレースホルダ必須。
- 日本語 UI。曲名・ファイル名は詳細画面で必ず確認できる。

## Review Focus

1. タグが無い曲（全体の 55%）でも一覧で判別できる表示名になるか。
2. モバイル通信 OFF のとき、未保存曲で勝手に通信しないか。
3. オフライン・未ログインの冷起動で、保存済み曲が再生できるか。
4. `album` タグが 1 曲だけのノイズでアルバム一覧が埋まらないか。
5. 画面ロック中に曲が終わっても次へ進めるか（実機 Phase 0）。

---

## File Structure

```
vaultmusic/
  pwa/
    package.json
    next.config.ts
    tsconfig.json
    postcss.config.mjs
    public/manifest.webmanifest
    public/icon.svg
    public/sw.js
    src/app/layout.tsx
    src/app/page.tsx
    src/app/globals.css
    src/lib/types.ts
    src/lib/config.ts
    src/lib/auth.ts
    src/lib/drive.ts
    src/lib/parseName.ts
    src/lib/library.ts
    src/lib/db.ts
    src/lib/offline.ts
    src/lib/player.ts
    src/lib/userData.ts
    src/lib/format.ts
    src/lib/metadata.ts
    src/components/App.tsx
    src/components/SetupScreen.tsx
    src/components/HomeView.tsx
    src/components/TracksView.tsx
    src/components/LibraryView.tsx
    src/components/SearchView.tsx
    src/components/SettingsView.tsx
    src/components/TrackRow.tsx
    src/components/PlayerBar.tsx
    src/components/FullPlayer.tsx
    src/components/ConfirmDataModal.tsx
    tests/parseName.test.ts
    tests/library.test.ts
    tests/playerQueue.test.ts
```

---

### Task 1: プロジェクト雛形と PWA シェル

**Files:** Create `pwa/package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `src/app/{layout.tsx,page.tsx,globals.css}`, `public/{manifest.webmanifest,icon.svg,sw.js}`

**Interfaces:**
- Produces: `npm run build` が `out/` を生成する静的 export 構成。

- [ ] Next.js 15 + React 19 + TS + Tailwind 4 を手動構成する（`output: "export"`、`images.unoptimized`）。
- [ ] `layout.tsx` で manifest と theme-color を設定し、`sw.js` を登録するクライアント処理を入れる。
- [ ] `sw.js` は VaultStream の `public/sw.js` を流用し、キャッシュ名だけ `vaultmusic-shell-v1` にする。
- [ ] `npm install` と `npm run build` が通ることを確認する。

### Task 2: 型・設定・認証

**Files:** Create `src/lib/types.ts`, `src/lib/config.ts`, `src/lib/auth.ts`

**Interfaces:**
- Produces:
  - `type Settings = { clientId: string; folderId: string; allowCellular: boolean; cacheLimitBytes: number }`
  - `loadSettings(): Settings` / `saveSettings(s: Settings): void`
  - `requestToken(clientId: string): Promise<{ token: string; expiresAt: number }>`
  - `getValidToken(clientId: string): Promise<string>`

- [ ] `Settings` の既定値は `allowCellular: false`, `cacheLimitBytes: 1.5 * 1024 ** 3`。
- [ ] GIS を動的ロードし、`drive.readonly` でトークンを取得。残り 5 分未満なら再取得する。
- [ ] `getValidToken` はメモリキャッシュを使い、失敗時は `AUTH_REQUIRED` を投げる。

### Task 3: Drive クライアント

**Files:** Create `src/lib/drive.ts`

**Interfaces:**
- Produces:
  - `listMusicFolder(folderId: string, token: string): Promise<DriveAudioFile[]>`（再帰 BFS）
  - `mediaUrl(fileId: string, token: string): string`
  - `fetchFileBytes(fileId: string, token: string, range?: string): Promise<Blob>`
  - `findFolderByName(name: string, token: string): Promise<{ id: string; name: string } | null>`

- [ ] `files.list` を `q: '<id>' in parents and trashed=false`、`pageSize: 1000`、必要 `fields` で呼ぶ。
- [ ] フォルダは再帰、音声は `audio/` または拡張子 mp3/m4a/aac/opus で判定。
- [ ] 401 は `AUTH_EXPIRED`、その他はメッセージ付き Error。

### Task 4: 名前解析とライブラリ構築（TDD）

**Files:** Create `src/lib/parseName.ts`, `src/lib/library.ts`, `tests/parseName.test.ts`, `tests/library.test.ts`

**Interfaces:**
- Produces:
  - `parseName(fileName: string, knownArtists: Set<string>): { title: string; artist: string; trackNo: number }`
  - `buildLibrary(files: DriveAudioFile[]): { tracks: Track[]; folders: FolderCollection[]; albums: Album[]; artists: ArtistSummary[] }`

- [ ] テスト：`01. Title.mp3` → trackNo 1 / title "Title"。
- [ ] テスト：`Artist - Title.mp3` → artist "Artist" / title "Title"（既知アーティスト一致を優先）。
- [ ] テスト：区切りが無い名前は全体を title にし、artist は空。
- [ ] テスト：album タグが 1 曲だけのものは albums に入らない。2 曲以上で入る。
- [ ] テスト：`audioMediaMetadata` が無くても 494 曲が全件 tracks に出る。
- [ ] 実装し、`npx vitest run` を通す。

### Task 5: IndexedDB とオフラインキャッシュ

**Files:** Create `src/lib/db.ts`, `src/lib/offline.ts`

**Interfaces:**
- Produces:
  - `dbGet<T>(store, key)`, `dbPut(store, key, value)`, `dbDelete(store, key)`, `dbAll(store)`
  - `cacheCatalog(catalog)`, `getCachedCatalog()`
  - `isDownloaded(trackId)`, `downloadTrack(track, token, onProgress?)`, `deleteDownload(trackId)`
  - `getAudioBlob(trackId): Promise<Blob | null>`
  - `storageUsage(): Promise<{ usage: number; quota: number }>`

- [ ] ストア：`kv`, `audio`, `covers`, `downloads`。
- [ ] ダウンロードは `fetchFileBytes` の全体取得 → Blob 保存 → `downloads` に `{ trackId, size, at }`。
- [ ] 容量超過時は最も古いダウンロードから削除する。
- [ ] `navigator.storage.persist()` を初回ダウンロード時に要求する。

### Task 6: 再生エンジンと MediaSession

**Files:** Create `src/lib/player.ts`, `tests/playerQueue.test.ts`

**Interfaces:**
- Produces:
  - `player.setQueue(tracks: Track[], startIndex: number)`
  - `player.toggle()`, `player.next()`, `player.prev()`, `player.seek(sec)`
  - `player.setShuffle(on)`, `player.setRepeat(mode)`, `player.setSleepMinutes(min)`
  - `player.subscribe(fn): () => void`, `player.getState(): PlayerState`
  - `player.setDataPolicy({ allowCellular: boolean })`

- [ ] 純粋なキュー関数 `buildOrder(length, shuffle, seed)` をテストする（同じ seed で再現可能）。
- [ ] 保存済み Blob → ストリーミング → `NEED_DATA` の順で解決する。
- [ ] `ended` で next。repeat one/all/off。
- [ ] MediaSession の metadata / handlers / positionState。
- [ ] キューと位置を保存し、起動時に復元する。

### Task 7: ユーザーデータ

**Files:** Create `src/lib/userData.ts`

**Interfaces:**
- Produces: `getUserData()`, `updateUserData(patch)`, `toggleFavorite(id)`, `addPlaylist(name)`, `addToPlaylist(id, trackId)`, `recordPlay(id)`。

- [ ] localStorage + IndexedDB に保存（キー `vaultmusic.user.v1`）。
- [ ] 再生履歴は直近 500 件に制限。

### Task 8: UI シェルと主要画面

**Files:** Create `src/components/{App,HomeView,TracksView,LibraryView,SearchView,TrackRow,PlayerBar}.tsx`

**Interfaces:**
- Consumes: `buildLibrary`, `player`, `userData`。
- Produces: タブ（ホーム / 曲 / ライブラリ / 検索）とミニプレイヤー。

- [ ] ホーム：続きから、通学セット（保存済み数 / 残り MB / 保存ボタン）、最近追加、よく聴く、全曲シャッフル。
- [ ] 曲：全曲リスト、並べ替え（名前 / 追加日 / アーティスト）、保存状態バッジ。
- [ ] ライブラリ：フォルダ / アーティスト / アルバム（2 曲以上）/ プレイリスト / お気に入り / 履歴。
- [ ] 検索：NFKC + 小文字化で即時絞り込み。
- [ ] カバーが無い場合は頭文字＋グラデーション。

### Task 9: 設定・セットアップ・通信確認

**Files:** Create `src/components/{SetupScreen,SettingsView,ConfirmDataModal,FullPlayer}.tsx`, modify `App.tsx`

- [ ] 初回：クライアント ID（env があれば prefill）→ フォルダ URL / ID → ログイン → 取得。
- [ ] 「マイドライブの『音楽』を探す」ボタン（`findFolderByName("音楽")`）。
- [ ] 設定：モバイル通信の許可（既定 OFF）、容量、使用量、キャッシュ削除、再スキャン、ログアウト。
- [ ] 未保存＋通信 OFF は `ConfirmDataModal` でサイズを出して許可を求める。
- [ ] 全画面プレイヤー：カバー、元ファイル名、シーク、前後、シャッフル、リピート、スリープタイマー、保存。

### Task 10: 仕上げと検証

- [ ] `npm run build` 成功。
- [ ] `npx vitest run` 成功。
- [ ] 初回ログイン → ライブラリ表示 → 保存 → 再生 → 再起動の手動確認。
- [ ] iPhone 実機で Phase 0 チェックリストを実施できる状態にする。
- [ ] README にセットアップ（クライアント ID、承認済みオリジン、デプロイ）を書く。
