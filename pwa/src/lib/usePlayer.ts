"use client";

import { useEffect, useState } from "react";
import { player } from "./player";
import type { PlayerSnapshot } from "./types";

/** 再生位置まで含めた完全な状態。プレイヤーUI専用。 */
export function usePlayerLive(): PlayerSnapshot {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(() => player.getState());
  useEffect(() => player.subscribe(setSnapshot), []);
  return snapshot;
}

function sameUi(a: PlayerSnapshot, b: PlayerSnapshot): boolean {
  return (
    a.trackId === b.trackId &&
    a.isPlaying === b.isPlaying &&
    a.loading === b.loading &&
    a.error === b.error &&
    a.needData === b.needData &&
    a.shuffle === b.shuffle &&
    a.repeat === b.repeat &&
    a.queueIndex === b.queueIndex &&
    a.queueLength === b.queueLength &&
    a.source === b.source &&
    a.sleepUntil === b.sleepUntil
  );
}

/**
 * 画面全体用。再生位置(time)の更新では再描画しない。
 * 曲送り・再生/停止・エラーなど、レイアウトに関わる変更だけで更新する。
 */
export function usePlayerUI(): PlayerSnapshot {
  const [snapshot, setSnapshot] = useState<PlayerSnapshot>(() => player.getState());
  useEffect(
    () =>
      player.subscribe((next) => {
        setSnapshot((prev) => (sameUi(prev, next) ? prev : next));
      }),
    []
  );
  return snapshot;
}
