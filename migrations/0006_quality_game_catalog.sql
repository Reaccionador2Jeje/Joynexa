-- Quality-first catalog: simulation, racing and creative sandbox experiences.
-- Joynexa stores metadata and outbound links only.
ALTER TABLE games ADD COLUMN catalog_tier TEXT NOT NULL DEFAULT 'classic'
 CHECK (catalog_tier IN ('classic','featured'));
CREATE INDEX IF NOT EXISTS games_tier_status_idx
 ON games(catalog_tier,status,created_at DESC);
INSERT OR IGNORE INTO games
 (id,slug,title,description,category,launch_url,developer_name,status,catalog_tier)
VALUES
 ('jx-hexgl','hexgl','HexGL','Carreras futuristas 3D en WebGL: circuitos, vueltas y control de alta velocidad.','racing','https://hexgl.bkcore.com/play/','Thibaut Despoulain · MIT','approved','featured'),
 ('jx-openracer','openracer','OpenRacer','Simulador de conducción con física de neumáticos, rivales IA y editores de coches y circuitos.','racing','https://openracer.eu/','OpenRacer · GPL-3.0','approved','featured'),
 ('jx-trigger-rally','trigger-rally-online-edition','Trigger Rally Online Edition','Rally 3D en navegador con pistas, cronómetros y carreras guardadas localmente.','racing','https://triggerrally.com/','Code Artemis · ver licencia upstream','approved','featured'),
 ('jx-3dcity','3d-city','3D.city','Construye y administra una ciudad en un entorno 3D interactivo.','simulation','https://lo-th.github.io/3d.city/index.html','lo-th · MIT','approved','featured'),
 ('jx-1255','1255-burgomaster','1255 Burgomaster','Construye una ciudad medieval, gestiona recursos y amplía tu población.','simulation','https://1255.areso.pro/','Anton Gladyshev · GPL-3.0','approved','featured'),
 ('jx-isocity','isocity','IsoCity','Diseña una ciudad isométrica y conecta barrios mediante carreteras, trenes y aeropuertos.','simulation','https://iso-city.com/','IsoCity · proyecto open source','approved','featured'),
 ('jx-shapez','shapez','shapez','Construye fábricas automatizadas: corta, gira, combina y colorea formas mediante cintas transportadoras.','simulation','https://shapez.io/','shapez · proyecto open source','approved','featured'),
 ('jx-townies','townies','Townies','Un mundo social compartido: crea tu hogar, encuentra un oficio y desarrolla un vecindario con otras personas.','simulation','https://townies.town/','Townies · proyecto open source','approved','featured'),
 ('jx-little-flock','little-flock','Little Flock','Administra una pequeña granja de ovejas en un mundo compartido con otros jugadores.','simulation','https://sharpherd.song.work/','Little Flock · proyecto open source','approved','featured'),
 ('jx-celadon','celadon','Celadon','Modela cerámica, mezcla esmaltes y prueba tus creaciones en el horno.','simulation','https://winchxyz.github.io/','Celadon · proyecto open source','approved','featured'),
 ('jx-cezanne-city','cezanne-city','Cézanne City','Dibuja calles y barrios; observa cómo tus trazos se convierten en una ciudad.','simulation','https://cezanne-city.netlify.app/','Cézanne City · proyecto open source','approved','featured'),
 ('jx-paradise-isle','paradise-isle','Paradise Isle','Explora una isla, cultiva, pesca y decora tu propio espacio.','adventure','https://appleweiping.github.io/','Paradise Isle · proyecto open source','approved','featured'),
 ('jx-business-tycoon','business-tycoon','Business Tycoon','Desarrolla una empresa desde una pequeña oficina hasta un negocio más grande.','strategy','https://tycoon.teamday.ai/','Business Tycoon · proyecto open source','approved','featured'),
 ('jx-hypervox','hypervox','HyperVox','Sandbox voxel creativo en navegador, con mundos modificables y herramientas para construir.','sandbox','https://capercube.com/hypervox/','CaperCube · MIT','approved','featured');
