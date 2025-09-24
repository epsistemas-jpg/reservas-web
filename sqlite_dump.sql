BEGIN;

-- Crear tabla de usuarios
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150) UNIQUE,
    password TEXT
);

-- Insertar datos en users
INSERT INTO users (id, name, email, password) VALUES
(1, 'Luisa', 'prueba@gmail.com', '$2b$10$1vaDqTkrN30AbohFv2cwOu9Vo9ga9CHjEVTDjQ0OprGb5.pQCDeP6'),
(2, 'Luisa', 'prueba5@gmail.com', '$2b$10$auMwk6WuuSQQ4jGQyOzT7.EFj.zrwOtyFHPpfGIA.H.tXkSHY0YUW'),
(3, 'prueba', 'prueba43@gmail.com', '$2b$10$a1WJUhAYOWDizyXmBx12UeVSO5CbGd9X8XxXLEU5F5VSnxuqCYQ.W'),
(4, 'brayan', 'brayan@gmail.com', '$2b$10$rLuzAfAckLlUEicaE.EfM.8sRod/n85JnFEB0ud1TBbuxl8Yivcpu');

-- Crear tabla de reservas
CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    room VARCHAR(100),
    date DATE,
    start_time TIME,
    end_time TIME
);

-- Insertar datos en reservations
INSERT INTO reservations (id, user_id, room, date, start_time, end_time) VALUES
(7, 3, 'Bocas de ceniza', '2025-09-24', '15:42', '16:42');

COMMIT;
