// Formatadores BR pra valores e datas.

export function brl(value) {
  if (value == null || isNaN(value)) return 'R$ 0,00';
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function brlCompact(value) {
  if (value == null || isNaN(value)) return 'R$ 0';
  const v = Number(value);
  if (Math.abs(v) >= 1000) {
    return `R$ ${(v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }
  return brl(v);
}

export function currentMonth(today = new Date()) {
  return { year: today.getFullYear(), month: today.getMonth() + 1 };
}

export function monthLabel(year, month) {
  const names = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return `${names[month - 1]} de ${year}`;
}

export function isoMonthRange(year, month) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(year, month, 0); // dia 0 do mês seguinte = último dia do mês atual
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  return { from, to };
}
