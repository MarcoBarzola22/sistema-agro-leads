const fs = require('fs');
const { pool } = require('./db'); // Importamos tu conexión

async function importarLeads() {
    try {
        // 1. Leemos el archivo que te va a pasar tu colega
        // (Por ahora usaremos uno de prueba que vas a crear en el paso 3)
        const rawData = fs.readFileSync('./input_data/leads_prueba.json', 'utf8');
        const leads = JSON.parse(rawData);

        console.log(`📂 Se encontraron ${leads.length} leads en el archivo.`);

        // 2. Recorremos y guardamos
        for (const lead of leads) {
            // El scraper de Maps a veces trae nombres de campos raros, ajustamos acá:
            const nombre = lead.title || lead.name;
            const telefono = lead.phone || lead.phoneNumber;
            const web = lead.website || lead.url;
            const direccion = lead.address;
            
            // Solo nos interesan los que tienen WEB (para buscar el mail después)
            // Opcional: Podés quitar este IF si querés guardar todos igual.
            if (!web) {
                console.log(`⚠️ Saltando ${nombre} (No tiene web)`);
                continue;
            }

            const query = `
                INSERT INTO leads_agro (nombre_negocio, telefono, website, direccion, origen)
                VALUES ($1, $2, $3, $4, 'apify_maps')
                RETURNING id;
            `;

            const values = [nombre, telefono, web, direccion];

            try {
                await pool.query(query, values);
                console.log(`✅ Guardado: ${nombre}`);
            } catch (err) {
                console.error(`❌ Error guardando ${nombre}:`, err.message);
            }
        }

        console.log('🏁 Importación terminada.');

    } catch (error) {
        console.error('Error general:', error);
    }
}

importarLeads();