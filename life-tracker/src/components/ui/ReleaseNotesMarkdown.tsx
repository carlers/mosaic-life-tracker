import React from 'react';

// React escapes raw text; only ordinary HTTP(S) destinations become clickable.
function inline(value: string): React.ReactNode[] {
  return value.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|\x60[^\x60]+\x60)/g)
    .filter(Boolean).map((part, i) => {
      if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
      if (part.charCodeAt(0) === 96) return <code key={i} className="font-mono">{part.slice(1, -1)}</code>;
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (!link) return part;
      try {
        const url = new URL(link[2]);
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--mosaic-accent-text)' }} className="underline break-all">{link[1]}</a>;
        }
      } catch { /* Non-web links remain plain text. */ }
      return link[1];
    });
}

export function ReleaseNotesMarkdown({ text }: { text: string }) {
  const lines = text.slice(0, 16000).replace(/\r/g, '').split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const special = /^(?:#{1,4}\s|[-*+]\s|\d+\.\s|>|\x60{3}|-{3}$)/;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (/^\x60{3}/.test(line)) {
      const code: string[] = [];
      while (++i < lines.length && !/^\x60{3}/.test(lines[i].trim())) code.push(lines[i]);
      i++;
      nodes.push(<pre key={i} className="overflow-x-auto rounded bg-surfaceHighlight p-2 text-xs"><code>{code.join('\n')}</code></pre>);
      continue;
    }
    const heading = /^#{1,4}\s+(.+)/.exec(line);
    if (heading) {
      nodes.push(<p key={i} className="font-semibold text-white">{inline(heading[1])}</p>);
      i++;
      continue;
    }
    const item = /^([-*+]|\d+\.)\s+(.+)/.exec(line);
    if (item) {
      const ordered = /^\d/.test(item[1]);
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const next = /^([-*+]|\d+\.)\s+(.+)/.exec(lines[i].trim());
        if (!next || /^\d/.test(next[1]) !== ordered) break;
        items.push(<li key={i}>{inline(next[2])}</li>);
        i++;
      }
      nodes.push(ordered
        ? <ol key={i} className="list-decimal space-y-1 pl-5">{items}</ol>
        : <ul key={i} className="list-disc space-y-1 pl-5">{items}</ul>);
      continue;
    }
    if (/^>/.test(line)) {
      nodes.push(<blockquote key={i} className="border-l-2 border-[#444444] pl-2">{inline(line.replace(/^>\s?/, ''))}</blockquote>);
      i++;
      continue;
    }
    if (/^-{3,}$/.test(line)) { nodes.push(<hr key={i} className="border-[#333333]" />); i++; continue; }
    const paragraph = [line];
    while (++i < lines.length && lines[i].trim() && !special.test(lines[i].trim())) paragraph.push(lines[i].trim());
    nodes.push(<p key={i}>{inline(paragraph.join(' '))}</p>);
  }
  return <div className="space-y-2 break-words text-sm leading-relaxed text-gray-300">{nodes}</div>;
}
