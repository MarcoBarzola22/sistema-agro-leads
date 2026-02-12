require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function importarLeads() {
    try {
        const carpetaInput = path.join(__dirname, 'input_data');

        // 1. Buscar el archivo JSON más reciente
        const archivos = fs.readdirSync(carpetaInput)
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                file,
                mtime: fs.statSync(path.join(carpetaInput, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime); // Ordenar por fecha (más nuevo primero)

        if (archivos.length === 0) {
            console.log("❌ No hay archivos JSON para importar en /input_data");
            return;
        }

        const archivoMasNuevo = archivos[0].file;
        const rutaCompleta = path.join(carpetaInput, archivoMasNuevo);

        console.log(`📂 Leyendo archivo: ${archivoMasNuevo}...`);
        
        const rawData = fs.readFileSync(rutaCompleta, 'utf8');
        const leads = JSON.parse(rawData);

        console.log(`   📊 Se encontraron ${leads.length} leads para procesar.`);

        // 2. Recorremos y guardamos
        let guardados = 0;
        let omitidos = 0;

        for (const lead of leads) {
            // Adaptador universal (por si viene de LinkedIn o Maps)
            const nombre = lead.nombre || lead.title || lead.name || "Sin Nombre";
            const telefono = lead.telefono || lead.phone || lead.phoneNumber || null;
            const web = lead.website || lead.url || lead.websiteUrl || null;
            const direccion = lead.direccion || lead.address || null;
            const ciudad = lead.city || lead.ciudad || null; // Si viene la ciudad, joya

            // Validar que tenga al menos nombre
            if (!nombre || nombre === "Sin Nombre") {
                omitidos++;
                continue;
            }

            // Verificar duplicados antes de insertar (por Web o por Nombre)
            const duplicado = await pool.query(
                "SELECT id FROM leads_agro WHERE nombre_negocio = $1 OR (website IS NOT NULL AND website = $2)", 
                [nombre, web]
            );

            if (duplicado.rows.length > 0) {
                // console.log(`   ⚠️ Duplicado: ${nombre}`); // Descomentar si querés ver detalle
                omitidos++;
                continue;
            }

            const query = `
                INSERT INTO leads_agro (nombre_negocio, telefono, website, direccion, ciudad, origen, estado)
                VALUES ($1, $2, $3, $4, $5, 'apify_maps', 'nuevo')
            `;

            try {
                await pool.query(query, [nombre, telefono, web, direccion, ciudad]);
                guardados++;
            } catch (err) {
                console.error(`   ❌ Error SQL guardando ${nombre}:`, err.message);
            }
        }

        console.log(`\n🏁 Importación terminada.`);
        console.log(`   ✅ Nuevos guardados: ${guardados}`);
        console.log(`   sombras (Ya existían/Sin datos): ${omitidos}`);

    } catch (error) {
        console.error('Error general:', error);
    }
}

importarLeads();