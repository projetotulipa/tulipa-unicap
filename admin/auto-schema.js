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

    // pega todos elementos cujo edit-id começa com "<slug>." (excluindo o próprio section.X)
    // limite ao escopo desta section (descendants apenas)
    const fieldEls = Array.from(sec.querySelectorAll('[data-edit-id]'))
      .filter((el) => {
        const id = el.dataset.editId;
        return id.startsWith(`${slug}.`)
          && id !== sectionId
          && el.dataset.editType !== 'section';
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

    blocks.push({
      id: slug,
      sectionId,
      iconName: meta.iconName,
      label: meta.label,
      description: meta.description,
      summaryFields: pickSummaryFields(fields.map((f) => f.id), slug),
      fields,
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
