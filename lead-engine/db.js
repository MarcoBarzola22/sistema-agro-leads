require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Función para probar conexión
const probarConexion = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Conexión a Base de Datos EXITOSA:', res.rows[0].now);
    } catch (err) {
        console.error('❌ Error conectando a la Base de Datos:', err);
    }
};

// Exportamos el "pool" para usarlo en otros archivos
module.exports = { pool, probarConexion };