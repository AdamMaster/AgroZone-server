CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS categories_name_trgm 
ON categories USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ads_title_trgm 
ON ads USING GIN (title gin_trgm_ops);
