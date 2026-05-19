// Markdown leve ↔ HTML (preserva roundtrip pra edição amigável).
// Suporta apenas:
//   **negrito**       <-> <strong>negrito</strong>
//   *itálico*         <-> <em>itálico</em>
//   _itálico_         <-> <em>itálico</em>
//   --quebra de linha-- (linhas em branco / <br/>)
//
// Tags HTML extras no input HTML (ex.: <span class="dropcap">) são removidas
// silenciosamente — o admin trabalha com o texto editorial limpo.

export function htmlToMd(html) {
  if (html == null) return '';
  let s = String(html);

  // remove tags decorativas comuns mantendo o texto
  s = s.replace(/<span class="dropcap">(.*?)<\/span>/gi, '$1');
  s = s.replace(/<span class="rule"><\/span>/gi, '');

  // strong / b → **x**
  s = s.replace(/<(strong|b)\s*[^>]*>(.*?)<\/\1>/gis, (_, _t, c) => `**${c.trim()}**`);
  // em / i → *x*
  s = s.replace(/<(em|i)\s*[^>]*>(.*?)<\/\1>/gis, (_, _t, c) => `*${c.trim()}*`);
  // <br/> → newline
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // <p> → newline duplo (parágrafo)
  s = s.replace(/<\/?p[^>]*>/gi, '\n\n');

  // remove qualquer outra tag silenciosamente, preservando conteúdo
  s = s.replace(/<[^>]+>/g, '');

  // decode entidades comuns
  s = s.replace(/&nbsp;/g, ' ')
       .replace(/&amp;/g, '&')
       .replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>')
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'");

  // colapsa espaços horizontais excessivos mantendo newlines
  s = s.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n');
  // colapsa 3+ newlines em 2
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}

export function mdToHtml(md) {
  if (md == null) return '';
  let s = String(md);

  // escapa < > & primeiro (sem mexer no que vai virar tag)
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // **negrito**
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  // *itálico* (não pisar no ** já convertido)
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  // _itálico_
  s = s.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, '$1<em>$2</em>');

  // newlines → <br/>; linhas duplas geram um espaço a mais
  s = s.replace(/\n\n+/g, '<br/><br/>');
  s = s.replace(/\n/g, '<br/>');

  return s;
}
