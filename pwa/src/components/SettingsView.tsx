"use client";

import { useState } from "react";
import { ArrowLeft, Database, LogOut, RefreshCw, Trash2, Wifi } from "lucide-react";
import type { Settings } from "@/lib/types";
import { formatBytes } from "@/lib/format";
import { extractFolderId } from "@/lib/config";

const CACHE_OPTIONS = [512, 1024, 1536, 2048, 4096, 8192];

export function SettingsView({
  settings,
  onChange,
  onClose,
  onRescan,
  onClearDownloads,
  onLogout,
  savedBytes,
  savedCount,
  usage,
  quota,
  busy,
  authState,
}: {
  settings: Settings;
  onChange: (next: Settings) => void;
  onClose: () => void;
  onRescan: () => void;
  onClearDownloads: () => void;
  onLogout: () => void;
  savedBytes: number;
  savedCount: number;
  usage: number;
  quota: number;
  busy: boolean;
  authState: "online" | "cached" | "offline";
}) {
  const [clientId, setClientId] = useState(settings.clientId);
  const [folderId, setFolderId] = useState(settings.folderId);

  const commit = (patch: Partial<Settings>) =>
    onChange({
      ...settings,
      clientId: clientId.trim(),
      folderId: extractFolderId(folderId),
      ...patch,
    });

  const persistFields = () => {
    commit({});
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#0b0b0e]">
      <div className="mx-auto max-w-2xl px-4 pb-[calc(2rem+var(--vm-safe-bottom))]">
        <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 bg-[#0b0b0e]/95 px-4 py-3 backdrop-blur">
          <button type="button" aria-label="戻る" onClick={onClose} className="rounded-full p-1.5">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">設定</h1>
          <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
            {authState === "online" ? "接続中" : authState === "cached" ? "キャッシュ" : "オフライン"}
          </span>
        </div>

        <section className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-[13px] font-semibold text-zinc-200">ストレージ</h2>
          <p className="mt-1 text-[11px] text-zinc-500">
            保存済み {savedCount} 曲 · {formatBytes(savedBytes)} / {formatBytes(settings.cacheLimitBytes)}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300"
              style={{
                width: `${Math.min(100, (savedBytes / Math.max(1, settings.cacheLimitBytes)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">
            端末の使用量 {formatBytes(usage)}
            {quota > 0 ? ` / 上限目安 ${formatBytes(quota)}` : ""}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <label className="text-[12px] text-zinc-300">保存の上限</label>
            <select
              value={settings.cacheLimitBytes}
              onChange={(event) => commit({ cacheLimitBytes: Number(event.target.value) })}
              className="rounded-lg border border-white/10 bg-[#17171c] px-2 py-1.5 text-[12px]"
            >
              {CACHE_OPTIONS.map((mb) => (
                <option key={mb} value={mb * 1024 * 1024}>
                  {mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)}GB` : `${mb}MB`}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={onClearDownloads}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 px-3 py-2 text-[12px] text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            保存した曲をすべて削除
          </button>
        </section>

        <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-amber-400" />
            <h2 className="text-[13px] font-semibold text-zinc-200">モバイル通信</h2>
          </div>
          <label className="mt-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] text-zinc-200">未保存の曲を通信で再生する</div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                OFF のときは保存済みの曲だけ再生します
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.allowCellular}
              onClick={() => commit({ allowCellular: !settings.allowCellular })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                settings.allowCellular ? "bg-rose-600" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  settings.allowCellular ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </section>

        <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-violet-400" />
            <h2 className="text-[13px] font-semibold text-zinc-200">Google Drive</h2>
          </div>
          <label className="mt-3 block text-[11px] text-zinc-500">クライアント ID</label>
          <input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            onBlur={persistFields}
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#101014] px-2.5 py-2 text-[12px] outline-none focus:border-rose-500/50"
          />
          <label className="mt-3 block text-[11px] text-zinc-500">音楽フォルダの URL / ID</label>
          <input
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            onBlur={persistFields}
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#101014] px-2.5 py-2 text-[12px] outline-none focus:border-rose-500/50"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={persistFields}
              className="flex-1 rounded-xl bg-white py-2 text-[12px] font-semibold text-black"
            >
              設定を保存
            </button>
            <button
              type="button"
              onClick={onRescan}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-[12px] text-zinc-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              再スキャン
            </button>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-[12px] text-zinc-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            Google からログアウト
          </button>
        </section>

        <p className="mt-4 px-1 text-[10px] leading-relaxed text-zinc-600">
          VaultMusic は指定フォルダの読み取りだけを行います。ファイルの作成・変更・削除・共有はしません。
          音源は Google Drive 上にそのまま保存されます。
        </p>
      </div>
    </div>
  );
}
