"use client";

import { useState } from "react";
import { FolderSearch, Loader2, LogIn, Music4, Play } from "lucide-react";
import { extractFolderId } from "@/lib/config";

export function SetupScreen({
  initialClientId,
  initialFolderId,
  busy,
  error,
  onLogin,
  onDetect,
  onConnect,
}: {
  initialClientId: string;
  initialFolderId: string;
  busy: boolean;
  error: string | null;
  onLogin: (clientId: string) => Promise<void>;
  onDetect: (clientId: string) => Promise<{ id: string; name: string } | null>;
  onConnect: (clientId: string, folderId: string) => Promise<void>;
}) {
  const [clientId, setClientId] = useState(initialClientId);
  const [folderInput, setFolderInput] = useState(initialFolderId);
  const [loggedIn, setLoggedIn] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedName, setDetectedName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const message = error ?? localError;

  const login = async () => {
    setLocalError(null);
    try {
      await onLogin(clientId.trim());
      setLoggedIn(true);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "ログインに失敗しました");
    }
  };

  const detect = async () => {
    setDetecting(true);
    setLocalError(null);
    try {
      const found = await onDetect(clientId.trim());
      if (found) {
        setFolderInput(found.id);
        setDetectedName(found.name);
      } else {
        setLocalError("『音楽』フォルダが見つかりませんでした。URL を貼り付けてください。");
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "フォルダを検索できませんでした");
    } finally {
      setDetecting(false);
    }
  };

  const connect = async () => {
    setLocalError(null);
    const folderId = extractFolderId(folderInput);
    if (!clientId.trim() || !folderId) {
      setLocalError("クライアント ID とフォルダを入力してください");
      return;
    }
    try {
      await onConnect(clientId.trim(), folderId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "ライブラリを読み込めませんでした");
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="vm-cover flex h-14 w-14 items-center justify-center rounded-2xl">
          <Music4 className="h-7 w-7 text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold">
            <span className="vm-gradient-text">VaultMusic</span>
          </div>
          <div className="text-[11px] text-zinc-500">Google Drive の音楽を、通信なしで。</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[12px] font-semibold text-zinc-200">1. Google に接続</div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          VaultStream と同じ OAuth クライアント ID を使えます。このアプリのオリジンを
          「承認済み JavaScript 生成元」に追加してください。
        </p>
        <input
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          placeholder="xxxxx.apps.googleusercontent.com"
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-white/10 bg-[#101014] px-2.5 py-2 text-[12px] outline-none focus:border-rose-500/50"
        />
        <button
          type="button"
          onClick={login}
          disabled={busy || !clientId.trim()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[13px] font-semibold text-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {loggedIn ? "ログイン済み（再ログイン）" : "Google にログイン"}
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[12px] font-semibold text-zinc-200">2. 音楽フォルダ</div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Drive のフォルダ URL を貼り付けるか、マイドライブ内の「音楽」を自動検索します。
        </p>
        <input
          value={folderInput}
          onChange={(event) => setFolderInput(event.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-white/10 bg-[#101014] px-2.5 py-2 text-[12px] outline-none focus:border-rose-500/50"
        />
        {detectedName ? (
          <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-300">
            見つかりました：{detectedName}
          </div>
        ) : null}
        <button
          type="button"
          onClick={detect}
          disabled={busy || detecting || !clientId.trim()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-[12px] text-zinc-200 disabled:opacity-50"
        >
          {detecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderSearch className="h-3.5 w-3.5" />
          )}
          マイドライブの「音楽」を探す
        </button>
      </div>

      {message ? (
        <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
        ライブラリを読み込む
      </button>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-zinc-600">
        読み取り専用で接続します。音源の変更・削除・共有は行いません。
      </p>
    </div>
  );
}
