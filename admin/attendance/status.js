// Cálculo de status mensal de presença.

export const STATUS_COLORS = {
  gray:   { label: 'sem encontros',   token: 'gray',   hex: '#756855' },
  green:  { label: 'em dia',          token: 'green',  hex: '#6B8E3D' },
  yellow: { label: 'atenção',         token: 'yellow', hex: '#C19E5A' },
  orange: { label: 'sinal de alerta', token: 'orange', hex: '#C77F3D' },
  red:    { label: 'situação crítica',token: 'red',    hex: '#C24A4A' },
};

/**
 * Calcula o status mensal de uma pessoa em um grupo.
 *
 * @param {Array<{id, date, status, attendance: {person_id, is_present, justified}}>} meetingsWithAttendance
 *        Lista de encontros do mês com suas presenças. Encontros podem ter status 'happened',
 *        'cancelled' ou 'scheduled'. Apenas 'happened' entra no cálculo.
 * @param {string} personId
 * @param {object} [opts]
 * @param {boolean} [opts.isWeekly=true]   — grupo de frequência semanal (afeta limiares)
 * @returns {{ color, label, absences, maxConsecutive, attended, totalHappened, justifiedAbsences }}
 */
export function calcMonthlyStatus(meetingsWithAttendance, personId, opts = {}) {
  const { isWeekly = true } = opts;

  // ordena por data ascendente
  const sorted = [...meetingsWithAttendance].sort((a, b) => a.date.localeCompare(b.date));
  const happened = sorted.filter((m) => m.status === 'happened');

  if (happened.length === 0) {
    return {
      color: 'gray',
      label: STATUS_COLORS.gray.label,
      absences: 0,
      maxConsecutive: 0,
      attended: 0,
      totalHappened: 0,
      justifiedAbsences: 0,
    };
  }

  let absences = 0;
  let justifiedAbsences = 0;
  let attended = 0;
  let consecutive = 0;
  let maxConsecutive = 0;

  for (const m of happened) {
    const att = (m.attendance || []).find((a) => a.person_id === personId);
    const isPresent = !!att?.is_present;
    const isJustified = !!att?.justified;

    if (isPresent) {
      attended++;
      consecutive = 0;
    } else if (isJustified) {
      justifiedAbsences++;
      consecutive = 0;  // falta justificada não conta como consecutiva
    } else {
      absences++;
      consecutive++;
      if (consecutive > maxConsecutive) maxConsecutive = consecutive;
    }
  }

  let color = 'green';
  if (isWeekly && maxConsecutive >= 3) color = 'red';
  else if (isWeekly && maxConsecutive >= 2) color = 'orange';
  else if (absences >= 2) color = 'yellow';
  else color = 'green'; // 0 ou 1 falta

  return {
    color,
    label: STATUS_COLORS[color].label,
    absences,
    maxConsecutive,
    attended,
    totalHappened: happened.length,
    justifiedAbsences,
  };
}

/** Severidade numérica pra ordenar alertas (maior = pior). */
export function severityOf(color) {
  return { red: 3, orange: 2, yellow: 1, green: 0, gray: -1 }[color] ?? 0;
}

/** Limites do mês corrente como YYYY-MM-DD. */
export function currentMonthRange(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = new Date(y, m + 1, 0); // último dia do mês
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { year: y, month: m + 1, from, to };
}

export function monthLabel(year, month) {
  const names = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${names[month - 1]} de ${year}`;
}
