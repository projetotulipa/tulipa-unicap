// Gera um schema dinâmico a partir do DOM da LP no iframe.
// Funciona pra qualquer página marcada com data-edit-id — sem precisar criar
// schema individual por LP. Pra Home usamos um schema explícito (rico),
// pras outras geramos automaticamente.

import { sectionMeta } from './section-meta.js';
import { labelFor } from './label-dictionary.js';

const TYPE_BY_TAG = {
  P: 'rich',
  BLOCKQUOTE: 'rich',
  H2: 'rich',
  H3: 'rich',
  H4: 'rich',
  STRONG: 'rich',
  SPAN: 'text',
  A: 'link-label',
};

// Decide tipo de field baseado no tagName + data-edit-type.
function fieldType(el) {
  const dataType = el.dataset.editType;
  if (dataType === 'link') return 'link-label';
  if (dataType === 'section') return null; // sections são containers, não viram fields
  return TYPE_BY_TAG[el.tagName] || 'text';
}

// Heurística: pega 1-2 fields curtos pra mostrar como preview do bloco
function pickSummaryFields(fieldIds, slug) {
  const prefer = [
    `${slug}.title`,
    `${slug}.p1`,
    `${slug}.intro`,
    `${slug}.eyebrow`,
  ];
  return prefer.filter((id) => fieldIds.includes(id)).slice(0, 2);
}

export function autoSchemaFromDoc(doc, { scope, label }) {
  // Pega blocos: elementos com data-edit-id começando com "section."
  const sectionEls = Array.from(doc.querySelectorAll('[data-edit-id^="section."]'));

  const blocks = [];
  for (const sec of sectionEls) {
    const sectionId = sec.dataset.editId;          // "section.hero"
    const slug = sectionId.replace(/^section\./, ''); // "hero"
    const meta = sectionMeta(slug);

    // descobre containers DESTA section pra excluir os fields filhos deles
    // dos fields top-level do bloco (eles ficam editáveis via UI de items).
    const containerEls = Array.from(sec.querySelectorAll('[data-edit-container]'));
    const idsInsideContainers = new Set();
    for (const c of containerEls) {
      for (const el of c.querySelectorAll('[data-edit-id]')) {
        idsInsideContainers.add(el.dataset.editId);
      }
    }

    // pega todos elementos cujo edit-id começa com "<slug>." (excluindo o próprio section.X)
    // e que NÃO estejam dentro de algum container detectado.
    const fieldEls = Array.from(sec.querySelectorAll('[data-edit-id]'))
      .filter((el) => {
        const id = el.dataset.editId;
        if (id === sectionId) return false;
        if (!id.startsWith(`${slug}.`)) return false;
        if (el.dataset.editType === 'section') return false;
        if (idsInsideContainers.has(id)) return false;
        return true;
      });

    // garante unicidade por edit-id (DOM duplicado seria bug)
    const seen = new Set();
    const fields = [];
    for (const el of fieldEls) {
      const id = el.dataset.editId;
      if (seen.has(id)) continue;
      seen.add(id);
      const type = fieldType(el);
      if (type === null) continue;
      fields.push({ id, label: labelFor(id), type });
    }

    // monta containers detectados (auto)
    const containers = containerEls.map((c) => buildAutoContainer(c)).filter(Boolean);

    blocks.push({
      id: slug,
      sectionId,
      iconName: meta.iconName,
      label: meta.label,
      description: meta.description,
      summaryFields: pickSummaryFields(fields.map((f) => f.id), slug),
      fields,
      containers,
    });
  }

  return {
    scope,
    label,
    iconName: 'page',
    blocks,
    isAuto: true,
  };
}

// Constrói metadata de um container a partir do seu DOM.
// Detecta: itens originais (filhos com data-edit-id), prefixo comum, sufixos
// de campos editáveis, se o template é <a> (suportsHref).
function buildAutoContainer(containerEl) {
  const key = containerEl.dataset.editContainer;
  if (!key) return null;
  const children = Array.from(containerEl.children).filter((el) => el.dataset?.editId);
  if (children.length === 0) return null;

  const first = children[0];
  const firstId = first.dataset.editId;

  // detecta sufixos a partir do primeiro filho
  const suffixes = [];
  const seen = new Set();
  for (const el of first.querySelectorAll('[data-edit-id]')) {
    const id = el.dataset.editId;
    if (!id.startsWith(`${firstId}.`)) continue;
    const suffix = id.slice(firstId.length); // ".title" etc
    if (seen.has(suffix)) continue;
    seen.add(suffix);
    const t = fieldType(el) || 'text';
    suffixes.push({ suffix, label: humanizeSuffix(suffix), type: t });
  }

  // se não tem sub-fields, tenta usar o próprio elemento (ex.: <li><a>label</a>)
  if (suffixes.length === 0 && first.querySelector('[data-edit-type="link"]')) {
    const link = first.querySelector('[data-edit-type="link"]');
    const linkId = link.dataset.editId;
    if (linkId.startsWith(`${firstId}.`)) {
      suffixes.push({ suffix: linkId.slice(firstId.length), label: 'Rótulo', type: 'link-label' });
    }
  }

  // descobre o "noun" entre <prefix>.<noun>.<slug>
  const itemNoun = inferItemNoun(firstId);

  return {
    key,
    label: `${capitalize(itemNoun)}s`,
    itemNoun,
    itemNounPlural: `${itemNoun}s`,
    supportsHref: first.tagName === 'A' || !!first.querySelector('a[href]'),
    defaultBasedOn: firstId,
    itemFieldSuffixes: suffixes,
    isAuto: true,
  };
}

function inferItemNoun(id) {
  // ex.: "atividades.card.grupos" → "card"; "contato.link.instagram" → "link"
  const parts = id.split('.');
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[1];
  return 'item';
}

function humanizeSuffix(suffix) {
  const map = {
    '.title': 'Título',
    '.body':  'Descrição',
    '.sub':   'Linha secundária',
    '.label': 'Rótulo',
    '.desc':  'Descrição',
  };
  return map[suffix] || suffix.replace(/^\./, '').replace(/-/g, ' ');
}

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
