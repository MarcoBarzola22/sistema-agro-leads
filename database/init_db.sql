CREATE TABLE leads_agro (
    id SERIAL PRIMARY KEY,
    nombre_negocio VARCHAR(255),
    rubro VARCHAR(100),       -- Ej: Veterinaria, Acopio, Maquinaria
    telefono VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    direccion TEXT,
    ciudad VARCHAR(100),
    provincia VARCHAR(100),
    
    -- EL DATO DE ORO (Acá guardamos lo que encuentre tu script en la web)
    detalle_personalizado TEXT, 
    
    origen VARCHAR(50) DEFAULT 'apify_maps',
    estado VARCHAR(50) DEFAULT 'nuevo', -- nuevo, contactado, interesado, descartado
    fecha_captura TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);