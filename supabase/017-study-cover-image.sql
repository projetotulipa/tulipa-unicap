-- TULIPA · Imagem de capa nas folhas de grupos de estudo
-- Adiciona cover_image_url (URL externa, opcional). Se setada, substitui o símbolo
-- SVG nos cards e no hero da LP filha.
--
-- Roda no SQL Editor depois de 016.

alter table public.study_group_pages
  add column if not exists cover_image_url text not null default '';

-- recria a view incluindo a coluna nova
drop view if exists public.study_groups_public;

create or replace view public.study_groups_public as
  select
    p.id                as page_id,
    p.group_id          as group_id,
    p.slug              as slug,
    g.name              as group_name,
    g.description       as group_description,
    g.is_archived       as is_archived,
    g.schedule_kind     as schedule_kind,
    g.weekday           as weekday,
    g.start_time        as start_time,
    g.semester_id       as semester_id,
    p.hero_eyebrow      as hero_eyebrow,
    p.hero_subtitle     as hero_subtitle,
    p.lede              as lede,
    p.about_md          as about_md,
    p.method_md         as method_md,
    p.is_published      as is_published,
    p.show_on_index     as show_on_index,
    p.sort_order        as sort_order,
    p.accent_color      as accent_color,
    p.cover_emoji       as cover_emoji,
    p.cover_image_url   as cover_image_url,
    p.created_at        as created_at,
    p.updated_at        as updated_at
  from public.study_group_pages p
  join public.attendance_groups g on g.id = p.group_id;

grant select on public.study_groups_public to anon, authenticated;
