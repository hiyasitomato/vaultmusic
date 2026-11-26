"use client";

import { Wifi } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { CoverArt } from "./CoverArt";

export function ConfirmDataModal({
  title,
  artist,
  sizeBytes,
  onConfirm,
  onCancel,
}: {
  title: string;
  artist: string;
  sizeBytes: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#17171c] p-5 shadow-2xl">
        <div className="flex items-center gap-3">
          <CoverArt title={title} size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">{title}</div>
            <div className="truncate text-xs text-zinc-400">{artist || "不明なアーティスト"}</div>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-zinc-300">
          この曲はまだ端末に保存されていません。モバイル通信で約{" "}
          <span className="font-semibold text-amber-300">{formatBytes(sizeBytes)}</span>{" "}
          を使います。再生しますか？
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-3 py-2.5 text-sm text-zinc-300"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white"
          >
            <Wifi className="h-4 w-4" />
            通信で再生
          </button>
        </div>
      </div>
    </div>
  );
}
