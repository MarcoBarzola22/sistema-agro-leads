-- Archivo: database/init_db.sql completo
CREATE TABLE IF NOT EXISTS leads_agro (
    id SERIAL PRIMARY KEY,
    nombre_negocio VARCHAR(255),
    rubro VARCHAR(100),       -- Ej: Veterinaria, Acopio, Maquinaria
    telefono VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    direccion TEXT,
    ciudad VARCHAR(100),
    provincia VARCHAR(100),
    
    -- Datos de enriquecimiento
    detalle_personalizado TEXT, 
    link_whatsapp TEXT, -- Nueva columna agregada
    
    origen VARCHAR(50) DEFAULT 'apify_maps',
    estado VARCHAR(50) DEFAULT 'nuevo', -- nuevo, enriquecido, error_web, etc.
    fecha_captura TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

