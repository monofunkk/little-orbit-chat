CREATE FUNCTION public.buscar_en_documento(consulta text, doc uuid, limite int DEFAULT 4) RETURNS TABLE(pagina int, contenido text, rango real) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE palabras text; q tsquery;
BEGIN
  -- Cualquiera de los términos; el ranking favorece los fragmentos que juntan más de ellos.
  SELECT string_agg(quote_literal(lexeme) || ':*', ' | ') INTO palabras FROM unnest(to_tsvector('spanish'::regconfig, public.f_unaccent(consulta)));
  IF palabras IS NULL THEN RETURN; END IF;
  q := to_tsquery('spanish'::regconfig, palabras);
  RETURN QUERY SELECT f.pagina, f.contenido, ts_rank_cd(f.tsv, q, 1) FROM public.documento_fragmentos f WHERE f.documento_id = doc AND f.tsv @@ q ORDER BY 3 DESC, f.pagina LIMIT least(greatest(limite,1),10);
END $$;
REVOKE ALL ON FUNCTION public.buscar_en_documento(text,uuid,int) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.buscar_en_documento(text,uuid,int) TO authenticated, service_role;
