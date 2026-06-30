-- Colonne image_url sur messages (photos dans le chat)
alter table public.messages add column if not exists image_url text;

-- text_orig et lang_orig peuvent être null pour les messages photo-seulement
alter table public.messages alter column text_orig drop not null;
alter table public.messages alter column lang_orig drop not null;

-- Bucket Storage : chat-photos (public, 1 Mo max, images uniquement)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-photos',
  'chat-photos',
  true,
  1048576,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
) on conflict (id) do nothing;

-- Policy : autoriser les utilisateurs anon à uploader dans ce bucket
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'chat-photos anon insert'
  ) then
    execute 'create policy "chat-photos anon insert" on storage.objects
             for insert to anon
             with check (bucket_id = ''chat-photos'')';
  end if;
end $$;
