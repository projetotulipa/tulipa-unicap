// Cálculo de status de presença num período (semestre OU mês).

export const STATUS_COLORS = {
  gray:   { label: 'sem encontros',   token: 'gray',   hex: '#756855' },
  green:  { label: 'em dia',          token: 'green',  hex: '#6B8E3D' },
  yellow: { label: 'atenção',         token: 'yellow', hex: '#C19E5A' },
  orange: { label: 'sinal de alerta', token: 'orange', hex: '#C77F3D' },
  red:    { label: 'situação crítica',token: 'red',    hex: '#C24A4A' },
};

/** Thresholds de absenteísmo em fração (0..1). Vermelho ≥ 31% (definido pelo usuário). */
export const ABSENCE_THRESHOLDS = {
  red:    0.31,  // 31%+
  orange: 0.21,  // 21–30%
  yellow: 0.11,  // 11–20%
  // < 11% → verde
};

/**
 * Calcula o status de presença de uma pessoa num grupo num período (mês OU semestre).
 *
 * Critério principal: % de faltas (sobre encontros que aconteceram).
 *  - < 11%        → verde
 *  - 11–20%       → amarelo
 *  - 21–30%       → laranja
 *  - ≥ 31%        → vermelho
 *
 * Faltas justificadas NÃO contam (nem como falta, nem como presença).
 * `maxConsecutive` continua sendo retornado como informação extra (não afeta cor).
 *
 * @returns {{ color, label, absences, absencePct, maxConsecutive, attended, totalHappened, justifiedAbsences }}
 */
export function calcStatusByPercentage(meetingsWithAttendance, personId, opts = {}) {
  const sorted = [...meetingsWithAttendance].sort((a, b) => a.date.localeCompare(b.date));
  const happened = sorted.filter((m) => m.status === 'happened');

  if (happened.length === 0) {
    return {
      color: 'gray',
      label: STATUS_COLORS.gray.label,
      absences: 0,
      absencePct: 0,
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
      consecutive = 0;
    } else {
      absences++;
      consecutive++;
      if (consecutive > maxConsecutive) maxConsecutive = consecutive;
    }
  }

  // base de cálculo: total de encontros que aconteceram menos justificadas
  // (justificadas saem da base — não viram falta nem viram presença)
  const base = Math.max(1, happened.length - justifiedAbsences);
  const absencePct = absences / base;

  let color = 'green';
  if (absencePct >= ABSENCE_THRESHOLDS.red)         color = 'red';
  else if (absencePct >= ABSENCE_THRESHOLDS.orange) color = 'orange';
  else if (absencePct >= ABSENCE_THRESHOLDS.yellow) color = 'yellow';

  return {
    color,
    label: STATUS_COLORS[color].label,
    absences,
    absencePct,
    maxConsecutive,
    attended,
    totalHappened: happened.length,
    justifiedAbsences,
  };
}

// Alias retrocompatível (era usado como calcMonthlyStatus por todo lado).
export const calcMonthlyStatus = calcStatusByPercentage;

/** Severidade numérica pra ordenar alertas (maior = pior). */
export function severityOf(color) {
  return { red: 3, orange: 2, yellow: 1, green: 0, gray: -1 }[color] ?? 0;
}

/** Helper: nome curto do range "mar–jul" a partir de start/end date. */
export function shortRangeLabel(startDate, endDate) {
  const months = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  const s = new Date(startDate + 'T00:00:00');
  const e = new Date(endDate   + 'T00:00:00');
  return `${months[s.getMonth()]}–${months[e.getMonth()]}`;
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
