import type { ReactNode } from "react";

const LINK_PATTERN = /\[([^\]]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|((?:https?:\/\/|www\.)[^\s<]+)/gi;

function safeHref(value: string): string | null {
  const candidate = /^www\./i.test(value) ? `https://${value}` : value;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Render plain-text instructions with automatically detected, safe external links. */
export function InstructionContent({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));

    const label = match[1];
    const rawUrl = match[2] ?? match[3];
    const trimmedUrl = rawUrl.replace(/[.,!?;:]+$/, "");
    const trailing = rawUrl.slice(trimmedUrl.length);
    const href = safeHref(trimmedUrl);

    if (!href) {
      parts.push(match[0]);
    } else {
      parts.push(
        <a key={`link-${match.index}`} href={href} target="_blank" rel="noopener noreferrer">
          {label ?? trimmedUrl}
        </a>,
        trailing,
      );
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return (
    <div className="iw-instruction-content">
      {parts.map((part, index) => <span key={index}>{part}</span>)}
    </div>
  );
}
