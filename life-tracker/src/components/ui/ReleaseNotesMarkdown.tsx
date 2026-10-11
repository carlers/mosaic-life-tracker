import React from 'react';

// Public release notes use a bounded Markdown subset; no HTML is ever interpreted.
function inline(source: string, keyPrefix: string): React.ReactNode[] {
  const tokens = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|\x60[^\x60]+\x60)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of source.matchAll(tokens)) {
    const start = match.index ?? cursor;
    if (start > cursor) nodes.push(source.slice(cursor, start));
    const token = match[0];
    const key = keyPrefix + ':' + start;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{inline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('*')) {
      nodes.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith('\x60')) {
      nodes.push(<code key={key} className="rounded bg-surfaceHighlight px-1 font-mono text-xs">{token.slice(1, -1)}</code>);
    } else {
      const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const destination = parts?.[2] ?? '';
      let safe = false;
      try {
        const url = new URL(destination);
        safe = url.protocol === 'https:' || url.protocol === 'http:';
      } catch { /* Relative, malformed, and non-web links are not opened. */ }
      nodes.push(safe
        ? <a key={key} href={destination} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--mosaic-accent-text)' }} className="underline break-all">{parts?.[1]}</a>
        : <React.Fragment key={key}>{parts?.[1] ?? token}</React.Fragment>);
    }
    cursor = start + token.length;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

export function ReleaseNotesMarkdown({ text }: { text: string }) {
  const lines = text.slice(0, 16000).replace(/\r\n?/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const fence = /^ *\x60{3}/.test(line);
    if (fence) {
      const body: string[] = [];
      index++;
      while (index < lines.length && !/^ *\x60{3}/.test(lines[index])) body.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre key={blocks.length} className="overflow-x-auto rounded-md bg-surfaceHighlight p-2 text-xs"><code>{body.join('\n')}</code></pre>);
      continue;
    }
    const heading = /^ *(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(<p key={blocks.length} className="font-semibold text-[var(--mosaic-text)]">
        {inline(heading[2], 'h' + index)}
      </p>);
      index++;
      continue;
    }
    const bullet = /^ *([-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (bullet) {
      const ordered = /^\d/.test(bullet[1]);
      const items: React.ReactNode[] = [];
      while (index < lines.length) {
        const item = /^ *([-*+]|\d+\.)\s+(.+)$/.exec(lines[index]);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        items.push(<li key={index}>{inline(item[2], 'l' + index)}</li>);
        index++;
      }
      blocks.push(ordered
        ? <ol key={blocks.length} className="list-decimal space-y-1 pl-5">{items}</ol>
        : <ul key={blocks.length} className="list-disc space-y-1 pl-5">{items}</ul>);
      continue;
    }
    if (/^ *(-{3,}|\*{3,}) *$/.test(line)) {
      blocks.push(<hr key={blocks.length} className="border-[var(--mosaic-border)]" />);
      index++;
      continue;
    }
    if (/^ *>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^ *>\s?/.test(lines[index])) {
        quote.push(lines[index++].replace(/^ *>\s?/, ''));
      }
      blocks.push(<blockquote key={blocks.length} className="border-l-2 border-[var(--mosaic-border-strong)] pl-3">
        {quote.map((part, i) => <p key={i}>{inline(part, 'q' + index + i)}</p>)}
      </blockquote>);
      continue;
    }
    const paragraph = [line.trim()];
    index++;
    while (index < lines.length && lines[index].trim() &&
      !/^\s*(?:#{1,4}\s|[-*+]\s|\d+\.\s|>|-{3,}\s*$|\x60{3})/.test(lines[index])) {
      paragraph.push(lines[index++].trim());
    }
    blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '), 'p' + index)}</p>);
  }
  return <div className="space-y-2 break-words text-sm leading-relaxed text-[var(--mosaic-text-secondary)]">{blocks}</div>;
}
