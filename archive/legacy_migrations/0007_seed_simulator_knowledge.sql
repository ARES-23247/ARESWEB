-- Seed external knowledge sources with repositories useful for React Simulators
INSERT INTO external_knowledge_sources (id, type, url, branch, status) VALUES
  ('src-react-three-fiber', 'github', 'pmndrs/react-three-fiber', 'master', 'active'),
  ('src-drei', 'github', 'pmndrs/drei', 'master', 'active'),
  ('src-use-cannon', 'github', 'pmndrs/use-cannon', 'master', 'active'),
  ('src-matter-js', 'github', 'liabru/matter-js', 'master', 'active'),
  ('src-areslib', 'github', 'ARES-23247/ARESLIB', 'main', 'active');
