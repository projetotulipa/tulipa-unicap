// Helpers de telefone — formata pra exibir e gera link WhatsApp.

// Extrai só dígitos. Prepend "55" se não vier com DDI.
export function whatsappUrl(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  // se já começa com 55 e tem 12-13 dígitos (55 + DDD + 8/9 dígitos), assume DDI.
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55')) return `https://wa.me/${digits}`;
  }
  // se tem 10 ou 11 dígitos (DDD + número), assume Brasil e prepend 55.
  if (digits.length === 10 || digits.length === 11) {
    return `https://wa.me/55${digits}`;
  }
  // fallback — manda como veio.
  return `https://wa.me/${digits}`;
}

// Formata pra exibição visual: (81) 99999-9999 OU mantém como o user digitou se já tiver formato.
export function formatPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  // 11 dígitos: (XX) XXXXX-XXXX
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  // 10 dígitos: (XX) XXXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // 13 dígitos (com DDI 55): +55 (XX) XXXXX-XXXX
  if (digits.length === 13 && digits.startsWith('55')) {
    const rest = digits.slice(2);
    return `+55 (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
  }
  return phone;
}
