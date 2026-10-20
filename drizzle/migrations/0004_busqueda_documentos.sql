CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE FUNCTION public.f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT SET search_path = '' AS $$ SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;
CREATE TABLE public.documento_fragmentos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), instalacion_id uuid NOT NULL REFERENCES public.instalaciones(id) ON DELETE CASCADE, documento_tipo text NOT NULL CHECK (documento_tipo IN ('rca','pertinencia','evidencia')), documento_id uuid NOT NULL, nombre text NOT NULL, pagina int NOT NULL, orden int NOT NULL, contenido text NOT NULL, tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish'::regconfig, public.f_unaccent(nombre || ' ' || contenido))) STORED, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,DELETE ON public.documento_fragmentos TO authenticated; GRANT ALL ON public.documento_fragmentos TO service_role; ALTER TABLE public.documento_fragmentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX fragmentos_tsv ON public.documento_fragmentos USING GIN (tsv);
CREATE INDEX fragmentos_documento ON public.documento_fragmentos(documento_id);
CREATE INDEX fragmentos_instalacion ON public.documento_fragmentos(instalacion_id);
CREATE POLICY fragmento_read ON public.documento_fragmentos FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.auditorias a WHERE a.instalacion_id=documento_fragmentos.instalacion_id AND a.supervisor_id=auth.uid()));
CREATE POLICY fragmento_insert ON public.documento_fragmentos FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'admin') OR (documento_tipo='evidencia' AND EXISTS(SELECT 1 FROM public.evidencias e WHERE e.id=documento_id AND e.uploaded_by=auth.uid())));
CREATE POLICY fragmento_delete ON public.documento_fragmentos FOR DELETE TO authenticated USING(public.has_role(auth.uid(),'admin') OR (documento_tipo='evidencia' AND EXISTS(SELECT 1 FROM public.evidencias e WHERE e.id=documento_id AND e.uploaded_by=auth.uid())));
CREATE FUNCTION public.buscar_fragmentos(consulta text, inst uuid DEFAULT NULL, limite int DEFAULT 8) RETURNS TABLE(id uuid, instalacion_id uuid, documento_tipo text, documento_id uuid, nombre text, pagina int, contenido text, rango real) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE q tsquery; palabras text;
BEGIN
  q := websearch_to_tsquery('spanish'::regconfig, public.f_unaccent(consulta));
  RETURN QUERY SELECT f.id, f.instalacion_id, f.documento_tipo, f.documento_id, f.nombre, f.pagina, f.contenido, ts_rank_cd(f.tsv, q) FROM public.documento_fragmentos f WHERE f.tsv @@ q AND (inst IS NULL OR f.instalacion_id = inst) ORDER BY 8 DESC, f.pagina LIMIT least(greatest(limite,1),20);
  IF FOUND THEN RETURN; END IF;
  -- Sin coincidencia de todos los términos: buscar cualquiera de ellos.
  SELECT string_agg(quote_literal(lexeme) || ':*', ' | ') INTO palabras FROM unnest(to_tsvector('spanish'::regconfig, public.f_unaccent(consulta)));
  IF palabras IS NULL THEN RETURN; END IF;
  q := to_tsquery('spanish'::regconfig, palabras);
  RETURN QUERY SELECT f.id, f.instalacion_id, f.documento_tipo, f.documento_id, f.nombre, f.pagina, f.contenido, ts_rank_cd(f.tsv, q) FROM public.documento_fragmentos f WHERE f.tsv @@ q AND (inst IS NULL OR f.instalacion_id = inst) ORDER BY 8 DESC, f.pagina LIMIT least(greatest(limite,1),20);
END $$;
REVOKE ALL ON FUNCTION public.buscar_fragmentos(text,uuid,int) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.buscar_fragmentos(text,uuid,int) TO authenticated, service_role;
