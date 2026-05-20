// Toast notifications — chamadas como toast('mensagem', { kind: 'success'|'error'|'info' }).

import { icon } from './icons.js';

function ensureStack() {
  let stack = document.getElementById('toastStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}

const ICONS = {
  success: 'check-circle',
  error: 'x-circle',
  info: 'alert',
};

export function toast(message, opts = {}) {
  const { kind = 'info', duration = 3500 } = opts;
  const stack = ensureStack();

  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.innerHTML = `
    <span class="toast__icon">${icon(ICONS[kind] || 'alert', { size: 18 })}</span>
    <div class="toast__body">${escapeHtml(message)}</div>
    <button class="toast__close" aria-label="Fechar">${icon('x', { size: 14 })}</button>
  `;
  stack.appendChild(el);

  function dismiss() {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }
  el.querySelector('.toast__close').addEventListener('click', dismiss);

  if (duration > 0) setTimeout(dismiss, duration);

  return { dismiss };
}

export function toastSuccess(msg, opts) { return toast(msg, { ...(opts || {}), kind: 'success' }); }
export function toastError(msg, opts)   { return toast(msg, { ...(opts || {}), kind: 'error' }); }
export function toastInfo(msg, opts)    { return toast(msg, { ...(opts || {}), kind: 'info' }); }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
