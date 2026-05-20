// Avatar: gera iniciais e cor consistente a partir do nome da pessoa.
// Cor escolhida de uma paleta limitada que combina com o tema TULIPA.

const PALETTE = [
  // [bg-start, bg-end]  — gradientes warm
  ['#7A3A4A', '#3D1820'],   // vinho
  ['#6F4A5A', '#3D2A38'],   // amora
  ['#5A6F35', '#2F3D22'],   // musgo
  ['#8A6B43', '#5A4528'],   // âmbar
  ['#9F5A6B', '#5C2230'],   // rosa
  ['#456D5A', '#1F3C2E'],   // pinho
  ['#7E5B82', '#3D2A48'],   // ametista
  ['#A07654', '#604028'],   // canela
];

export function initials(fullName) {
  if (!fullName) return '?';
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function colorFor(fullName) {
  if (!fullName) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < fullName.length; i++) {
    hash = (hash * 31 + fullName.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function avatarHtml(fullName, opts = {}) {
  const { size = 'md' } = opts;
  const sizeClass = size === 'sm' ? ' avatar--sm' : size === 'lg' ? ' avatar--lg' : size === 'xl' ? ' avatar--xl' : '';
  const [a, b] = colorFor(fullName);
  const style = `background: linear-gradient(135deg, ${a}, ${b});`;
  const text = initials(fullName);
  return `<span class="avatar${sizeClass}" style="${style}" aria-hidden="true">${text}</span>`;
}
