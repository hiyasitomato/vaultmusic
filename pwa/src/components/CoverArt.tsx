"use client";

import { useEffect, useState } from "react";
import { initials } from "@/lib/format";

const SIZES = {
  sm: "h-11 w-11 text-sm rounded-lg",
  md: "h-14 w-14 text-base rounded-xl",
  lg: "h-24 w-24 text-2xl rounded-2xl",
  xl: "h-64 w-64 text-5xl rounded-3xl",
  card: "h-28 w-28 text-base rounded-2xl",
  fill: "h-auto w-full aspect-square text-2xl rounded-2xl",
  hero: "h-auto w-full aspect-square text-5xl rounded-3xl",
};

export function CoverArt({
  title,
  url,
  size = "sm",
  className = "",
}: {
  title: string;
  url?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-zinc-800 ${SIZES[size]} ${className}`}
    >
      <div className="vm-cover absolute inset-0 flex items-center justify-center font-semibold text-white/80">
        {initials(title)}
      </div>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}
