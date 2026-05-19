// Registry de schemas por scope. Retorna o schema explícito quando existe
// (caso da Home), ou auto-gera do DOM pras demais LPs.

import { HOME_SCHEMA } from './home.js';
import { autoSchemaFromDoc } from '../auto-schema.js';
import { PAGES } from '../pages-meta.js';

// scopes com schema explícito
const EXPLICIT = {
  global: HOME_SCHEMA,
};

// Recebe um doc (do iframe) e o scope. Retorna o schema.
// Pra Home (scope='global') retorna HOME_SCHEMA mesmo.
// Pras LPs, auto-gera com base no DOM marcado.
export function getSchema(scope, doc) {
  if (EXPLICIT[scope]) return EXPLICIT[scope];

  const page = PAGES.find((p) => p.scope === scope);
  return autoSchemaFromDoc(doc, {
    scope,
    label: page?.label || scope,
  });
}

export function hasExplicitSchema(scope) {
  return Object.prototype.hasOwnProperty.call(EXPLICIT, scope);
}
