// Editor markdown leve com toolbar tipo blog. Wrappa um <textarea> existente.
// Botões: B I H1 H2 H3 quote list link · preview.

import { icon } from './icons.js';

export function attachMarkdownEditor(textarea, opts = {}) {
  if (!textarea || textarea.dataset.mdAttached === '1') return;
  textarea.dataset.mdAttached = '1';

  const wrap = document.createElement('div');
  wrap.className = 'md-editor';
  textarea.classList.add('md-editor__ta');

  const toolbar = document.createElement('div');
  toolbar.className = 'md-editor__toolbar';
  toolbar.innerHTML = `
    <div class="md-editor__group">
      <button type="button" class="md-editor__btn" data-cmd="bold" title="Negrito (Ctrl+B)"><strong>B</strong></button>
      <button type="button" class="md-editor__btn" data-cmd="italic" title="Itálico (Ctrl+I)"><em>I</em></button>
    </div>
    <span class="md-editor__sep"></span>
    <div class="md-editor__group">
      <button type="button" class="md-editor__btn" data-cmd="h1" title="Título 1">H1</button>
      <button type="button" class="md-editor__btn" data-cmd="h2" title="Título 2">H2</button>
      <button type="button" class="md-editor__btn" data-cmd="h3" title="Subtítulo">H3</button>
    </div>
    <span class="md-editor__sep"></span>
    <div class="md-editor__group">
      <button type="button" class="md-editor__btn" data-cmd="quote" title="Citação">${icon('manifesto', { size: 14 })}</button>
      <button type="button" class="md-editor__btn" data-cmd="ul" title="Lista">${icon('marquee', { size: 14 })}</button>
      <button type="button" class="md-editor__btn" data-cmd="link" title="Link">${icon('external', { size: 14 })}</button>
      <button type="button" class="md-editor__btn" data-cmd="hr" title="Linha separadora">—</button>
    </div>
    <span class="spacer"></span>
    <button type="button" class="md-editor__btn md-editor__btn--toggle" data-cmd="preview" title="Visualizar">
      ${icon('eye', { size: 14 })}<span style="margin-left:6px;">preview</span>
    </button>
  `;
  wrap.appendChild(toolbar);

  // Insere wrap antes do textarea, depois move textarea pra dentro
  textarea.parentNode.insertBefore(wrap, textarea);
  wrap.appendChild(textarea);

  const preview = document.createElement('div');
  preview.className = 'md-editor__preview';
  preview.hidden = true;
  wrap.appendChild(preview);

  // ---------- comandos ----------
  function getSelection() {
    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
      value: textarea.value,
    };
  }

  function setSelection(start, end) {
    textarea.focus();
    textarea.setSelectionRange(start, end ?? start);
  }

  function wrapSelection(prefix, suffix = prefix, placeholder = '') {
    const { start, end, value } = getSelection();
    const selected = value.slice(start, end);
    const text = selected || placeholder;
    const before = value.slice(0, start);
    const after  = value.slice(end);
    textarea.value = before + prefix + text + suffix + after;
    if (selected) {
      setSelection(start + prefix.length, start + prefix.length + text.length);
    } else {
      setSelection(start + prefix.length, start + prefix.length + placeholder.length);
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function prefixLines(prefix, placeholder = '') {
    const { start, end, value } = getSelection();
    // expande até início de linha e fim de linha
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const safeEnd = lineEnd === -1 ? value.length : lineEnd;
    const block = value.slice(lineStart, safeEnd);
    const empty = !block.trim();
    const newBlock = empty
      ? prefix + (placeholder || '')
      : block.split('\n').map((l) => prefix + l).join('\n');
    textarea.value = value.slice(0, lineStart) + newBlock + value.slice(safeEnd);
    const newPos = lineStart + newBlock.length;
    setSelection(newPos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertText(text) {
    const { start, end, value } = getSelection();
    textarea.value = value.slice(0, start) + text + value.slice(end);
    setSelection(start + text.length);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function execCommand(cmd) {
    switch (cmd) {
      case 'bold':    return wrapSelection('**', '**', 'negrito');
      case 'italic':  return wrapSelection('*', '*', 'itálico');
      case 'h1':      return prefixLines('# ',  'Título 1');
      case 'h2':      return prefixLines('## ', 'Título 2');
      case 'h3':      return prefixLines('### ','Subtítulo');
      case 'quote':   return prefixLines('> ',  'citação');
      case 'ul':      return prefixLines('- ',  'item');
      case 'hr':      return insertText('\n\n---\n\n');
      case 'link': {
        const url = prompt('URL do link:', 'https://');
        if (!url || url === 'https://') return;
        const { start, end, value } = getSelection();
        const text = value.slice(start, end) || 'texto';
        textarea.value = value.slice(0, start) + `[${text}](${url})` + value.slice(end);
        setSelection(start + 1, start + 1 + text.length);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      case 'preview':
        togglePreview();
        return;
    }
  }

  function togglePreview() {
    const showing = !preview.hidden;
    if (showing) {
      preview.hidden = true;
      textarea.hidden = false;
      toolbar.querySelector('[data-cmd="preview"]').classList.remove('is-active');
    } else {
      preview.innerHTML = mdToHtml(textarea.value);
      preview.hidden = false;
      textarea.hidden = true;
      toolbar.querySelector('[data-cmd="preview"]').classList.add('is-active');
    }
  }

  toolbar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-cmd]');
    if (!btn) return;
    ev.preventDefault();
    execCommand(btn.dataset.cmd);
  });

  // atalhos
  textarea.addEventListener('keydown', (ev) => {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    if (k === 'b') { ev.preventDefault(); execCommand('bold'); }
    if (k === 'i') { ev.preventDefault(); execCommand('italic'); }
  });

  return {
    destroy() {
      delete textarea.dataset.mdAttached;
      wrap.replaceWith(textarea);
    },
  };
}

// ---------- renderer markdown completo (pra preview) ----------
export function mdToHtml(src) {
  if (!src) return '<p class="muted" style="font-style:italic;">vazio.</p>';
  // 1. escapa HTML
  let s = String(src).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 2. blocos
  const lines = s.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // heading
    let m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inlineMd(m[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // hr
    if (/^-{3,}\s*$/.test(line)) {
      out.push('<hr/>');
      i++;
      continue;
    }

    // blockquote (1+ linhas começando com >)
    if (/^>\s?/.test(line)) {
      const block = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        block.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inlineMd(block.join('<br/>'))}</blockquote>`);
      continue;
    }

    // unordered list
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^-\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i].replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // paragraph (junta linhas até próxima quebra dupla)
    if (line.trim() === '') {
      i++;
      continue;
    }

    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}|>|-|\d+\.|---)/.test(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    out.push(`<p>${inlineMd(paraLines.join('<br/>'))}</p>`);
  }

  return out.join('\n');
}

function inlineMd(text) {
  let s = text;
  // links [texto](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // bold
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // italic *
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // italic _
  s = s.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}
