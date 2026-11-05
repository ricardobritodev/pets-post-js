-- ============================================================
-- flask-mock.sql — Banco do Pets Post (Flask) SIMULADO, para testar o baseline.
--
-- DDL: gerado com o próprio SQLAlchemy 2 (Flask-SQLAlchemy 3.1.1) a partir de
--      pets-post/app/models/*.py, compilado no dialeto MySQL — o mesmo que o
--      `flask create-db` + migrations Alembic criam. Por isso, como no banco real:
--        * nenhum DEFAULT no banco (defaults eram do ORM);
--        * FKs sem ON DELETE CASCADE (o cascade era do ORM);
--        * índice único do email chama `ix_users_email`;
--        * tabela `alembic_version` do Flask-Migrate.
-- Dados: fictícios. Senhas com hashes gerados pelo Werkzeug 3.1.3 real:
--        admin@petpost.com / Admin@123 (scrypt) · maria@exemplo.com / Senha@123 (scrypt)
--        legado@exemplo.com / Senha@123 (pbkdf2:sha256:260000 — conta antiga)
--
-- Carregar:  mysql -u root petpost_flask_mock < flask-mock.sql
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS photos, adoption_photos, pet_posts, adoption_posts, partners, users, alembic_version;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE partners (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(150) NOT NULL, 
	description TEXT, 
	partner_type ENUM('foster_home','petshop','vet_clinic') NOT NULL, 
	address VARCHAR(255) NOT NULL, 
	lat FLOAT, 
	lng FLOAT, 
	phone VARCHAR(20), 
	email VARCHAR(120), 
	website VARCHAR(255), 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(120) NOT NULL, 
	password_hash VARCHAR(256), 
	`role` ENUM('admin','user') NOT NULL, 
	phone VARCHAR(20), 
	avatar_url VARCHAR(256), 
	is_active BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE adoption_posts (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	title VARCHAR(150) NOT NULL, 
	description TEXT NOT NULL, 
	pet_name VARCHAR(100), 
	pet_type ENUM('dog','cat','bird','other') NOT NULL, 
	pet_breed VARCHAR(100), 
	pet_color VARCHAR(100), 
	pet_size ENUM('small','medium','large'), 
	is_neutered BOOL NOT NULL, 
	is_vaccinated BOOL NOT NULL, 
	adopter_requirements TEXT, 
	location VARCHAR(255) NOT NULL, 
	location_lat FLOAT, 
	location_lng FLOAT, 
	contact_phone VARCHAR(20) NOT NULL, 
	contact_email VARCHAR(120), 
	is_active BOOL NOT NULL, 
	is_adopted BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME, 
	user_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE pet_posts (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	title VARCHAR(150) NOT NULL, 
	description TEXT NOT NULL, 
	status ENUM('lost','found') NOT NULL, 
	pet_name VARCHAR(100), 
	pet_type ENUM('dog','cat','bird','other') NOT NULL, 
	pet_breed VARCHAR(100), 
	pet_color VARCHAR(100), 
	pet_size ENUM('small','medium','large'), 
	last_seen_location VARCHAR(255) NOT NULL, 
	last_seen_lat FLOAT, 
	last_seen_lng FLOAT, 
	contact_phone VARCHAR(20) NOT NULL, 
	contact_email VARCHAR(120), 
	reward VARCHAR(100), 
	is_active BOOL NOT NULL, 
	is_resolved BOOL NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME, 
	user_id INTEGER NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE adoption_photos (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	filename VARCHAR(256) NOT NULL, 
	url VARCHAR(512) NOT NULL, 
	is_primary BOOL NOT NULL, 
	adoption_post_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(adoption_post_id) REFERENCES adoption_posts (id)
);

CREATE TABLE photos (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	filename VARCHAR(256) NOT NULL, 
	url VARCHAR(512) NOT NULL, 
	is_primary BOOL NOT NULL, 
	post_id INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES pet_posts (id)
);

CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL,
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- ---------- Dados ----------
INSERT INTO alembic_version VALUES ('6aab70c6759b');

INSERT INTO users (id, name, email, password_hash, `role`, phone, avatar_url, is_active, created_at) VALUES
(1, 'Admin PetPost', 'admin@petpost.com', 'scrypt:32768:8:1$rMdXabKhqOEQ5e9W$afad9949851e37e530ab62fdf98f0e848a0b1f0bcab7bb7422332074bf64c4964b14d333865ddcd4fe3bd856b746d74f39743b82170d0a8db61f7c61e0579194', 'admin', '(11) 91234-5678', NULL, 1, '2025-03-01 12:00:00'),
(2, 'Maria Silva', 'maria@exemplo.com', 'scrypt:32768:8:1$gWaaXK0tHLE9WqhP$774f8e70611e0ef9a01dbfcb6d3622055c5e7435e13175d9cea5a1439160aa2fec5bff995cea9450fc6f04f73d44ae8544e0d53a82d2700520d03663ad74048c', 'user', '(11) 98765-4321', NULL, 1, '2025-03-02 09:30:00'),
(3, 'Conta Antiga', 'legado@exemplo.com', 'pbkdf2:sha256:260000$KdC5MfIkmMDVXRgU$25cd0692d8ca36c511be1045b3fdfaf69f42ea254eed11210d7349b84b23fa61', 'user', NULL, NULL, 1, '2024-01-15 18:45:00'),
(4, 'Usuário Desativado', 'desativado@exemplo.com', 'scrypt:32768:8:1$gWaaXK0tHLE9WqhP$774f8e70611e0ef9a01dbfcb6d3622055c5e7435e13175d9cea5a1439160aa2fec5bff995cea9450fc6f04f73d44ae8544e0d53a82d2700520d03663ad74048c', 'user', NULL, NULL, 0, '2025-04-10 10:00:00');

INSERT INTO pet_posts (id, title, description, status, pet_name, pet_type, pet_breed, pet_color, pet_size, last_seen_location, last_seen_lat, last_seen_lng, contact_phone, contact_email, reward, is_active, is_resolved, created_at, updated_at, user_id) VALUES
(1, 'Cachorro caramelo perdido no Parque Ibirapuera', 'Fugiu durante o passeio. Atende por "Rex".', 'lost', 'Rex', 'dog', 'Vira-lata', 'Caramelo', 'medium', 'Parque Ibirapuera, São Paulo, SP', -23.5874, -46.6576, '(11) 98765-4321', 'maria@exemplo.com', 'R$ 300,00', 1, 0, '2025-05-01 08:00:00', '2025-05-01 08:00:00', 2),
(2, 'Gato encontrado no Jardim América', 'Gato preto e branco com coleira sem identificação.', 'found', NULL, 'cat', NULL, 'Preto e branco', 'small', 'Jardim América, São Paulo, SP', NULL, NULL, '(11) 98765-4321', NULL, NULL, 1, 1, '2025-05-03 14:20:00', '2025-06-01 10:00:00', 2),
(3, 'Post oculto pelo admin', 'Exemplo de post com is_active = 0.', 'lost', 'Bob', 'other', NULL, NULL, NULL, 'Centro, Curitiba, PR', NULL, NULL, '(41) 98888-7777', NULL, NULL, 0, 0, '2025-05-05 11:00:00', NULL, 3);

INSERT INTO photos (id, filename, url, is_primary, post_id, created_at) VALUES
(1, '7f3c2a9e-1b4d-4c8e-9f0a-2d6b8e1c3a5f.jpg', '/uploads/7f3c2a9e-1b4d-4c8e-9f0a-2d6b8e1c3a5f.jpg', 1, 1, '2025-05-01 08:00:01'),
(2, 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.jpg', '/uploads/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.jpg', 0, 1, '2025-05-01 08:00:02');

INSERT INTO adoption_posts (id, title, description, pet_name, pet_type, pet_breed, pet_color, pet_size, is_neutered, is_vaccinated, adopter_requirements, location, location_lat, location_lng, contact_phone, contact_email, is_active, is_adopted, created_at, updated_at, user_id) VALUES
(1, 'Gata adulta castrada procura lar', 'Calma e acostumada com apartamento.', 'Luna', 'cat', 'SRD', 'Tricolor', 'small', 1, 1, 'Janelas teladas.', 'Pinheiros, São Paulo, SP', -23.5670, -46.6930, '(11) 98765-4321', NULL, 1, 0, '2025-06-10 16:00:00', NULL, 2);

INSERT INTO adoption_photos (id, filename, url, is_primary, adoption_post_id, created_at) VALUES
(1, 'c0ffee00-1234-4abc-8def-0123456789ab.jpg', '/uploads/c0ffee00-1234-4abc-8def-0123456789ab.jpg', 1, 1, '2025-06-10 16:00:01');

INSERT INTO partners (id, name, description, partner_type, address, lat, lng, phone, email, website, is_active, created_at) VALUES
(1, 'Petz Vila Mariana', 'Loja completa com veterinário.', 'petshop', 'Av. Dr. Ricardo Jafet, 1750 — Vila Mariana, São Paulo/SP', -23.607, -46.623, '(11) 3434-6980', NULL, 'https://www.petz.com.br', 1, '2025-07-01 12:00:00'),
(2, 'Parceiro sem coordenadas', NULL, 'foster_home', 'Endereço não geocodificado', NULL, NULL, NULL, NULL, NULL, 1, '2025-07-02 12:00:00');
