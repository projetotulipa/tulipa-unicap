-- TULIPA · adiciona telefone (com link WhatsApp) ao cadastro de pessoas.

alter table public.people
  add column if not exists phone text;
