-- TULIPA · Justificativas estendidas
-- Adiciona category à tabela attendance. Reutiliza coluna `notes` pra motivo livre.

alter table public.attendance
  add column if not exists justification_category text;

-- categorias sugeridas (sem constraint pra deixar flexível):
-- 'saude'      — atestado médico, mal-estar
-- 'trabalho'   — compromisso profissional
-- 'familia'    — emergência ou compromisso familiar
-- 'academico'  — prova, atividade obrigatória da faculdade
-- 'outro'      — texto livre em notes
