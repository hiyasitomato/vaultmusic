"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { genreColor } from "@/lib/genres";

export function GenrePicker({
  title,
  mode,
  trackCount,
  current,
  allGenres,
  onAddCustom,
  onApply,
  onClose,
}: {
  title: string;
  mode: "single" | "bulk";
  trackCount: number;
  current: string[];
  allGenres: string[];
  onAddCustom: (name: string) => string;
  onApply: (selected: string[], action: "add" | "remove") => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(mode === "single" ? current : [])
  );
  const [action, setAction] = useState<"add" | "remove">("add");
  const [newGenre, setNewGenre] = useState("");
  const [genres, setGenres] = useState(allGenres);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const create = () => {
    const name = onAddCustom(newGenre);
    if (!name) return;
    setGenres((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSelected((prev) => new Set(prev).add(name));
    setNewGenre("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-[#17171c] pb-[calc(1rem+var(--vm-safe-bottom))]">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">ジャンル</div>
            <div className="truncate text-sm font-semibold">
              {title}
              {mode === "bulk" ? `（${trackCount}曲）` : ""}
            </div>
          </div>
          <button type="button" aria-label="閉じる" onClick={onClose} className="rounded-full p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "bulk" ? (
          <div className="mx-4 mb-2 flex rounded-lg border border-white/10 p-0.5">
            {(["add", "remove"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setAction(item)}
                className={`flex-1 rounded px-3 py-1.5 text-[11px] ${
                  action === item ? "bg-white text-black" : "text-zinc-400"
                }`}
              >
                {item === "add" ? "追加" : "削除"}
              </button>
            ))}
          </div>
        ) : null}

        <div className="max-h-[52vh] overflow-y-auto px-4">
          <div className="flex flex-wrap gap-1.5">
            {genres.map((name) => {
              const on = selected.has(name);
              const color = genreColor(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggle(name)}
                  className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px]"
                  style={{
                    borderColor: on ? color : "rgba(255,255,255,0.12)",
                    backgroundColor: on ? `${color}26` : "transparent",
                    color: on ? color : "#a1a1aa",
                  }}
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex gap-2 px-4">
          <input
            value={newGenre}
            onChange={(event) => setNewGenre(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create();
            }}
            placeholder="新しいジャンル"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#101014] px-2.5 py-2 text-[12px] outline-none focus:border-rose-500/50"
          />
          <button
            type="button"
            onClick={create}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[12px] text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" />
            作成
          </button>
        </div>

        <div className="mt-3 flex gap-2 px-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-[13px] text-zinc-300"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onApply(Array.from(selected), action)}
            className="flex-1 rounded-xl bg-white py-2.5 text-[13px] font-semibold text-black"
          >
            {mode === "single" ? "保存" : action === "add" ? "追加する" : "削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}
