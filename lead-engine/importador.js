require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function importarLeads() {
    try {
        const carpetaInput = path.join(__dirname, 'input_data');

        // 1. Buscar TODOS los archivos JSON
        const archivos = fs.readdirSync(carpetaInput)
            .filter(file => file.endsWith('.json'));

        if (archivos.length === 0) {
            console.log("❌ No hay archivos JSON para importar en /input_data");
            return;
        }

        console.log(`📦 Se encontraron ${archivos.length} archivos para procesar.`);

        let totalGuardados = 0;
        let totalOmitidos = 0;

        // 2. Bucle Principal: Recorremos ARCHIVO por ARCHIVO
        for (const archivo of archivos) {
            const rutaCompleta = path.join(carpetaInput, archivo);
            console.log(`\nTb Leyendo archivo: ${archivo}...`);
            
            const rawData = fs.readFileSync(rutaCompleta, 'utf8');
            let leads = [];

            try {
                leads = JSON.parse(rawData);
            } catch (e) {
                console.error(`   ⚠️ Error leyendo JSON en ${archivo}. Saltando...`);
                continue;
            }

            console.log(`   📊 Contiene ${leads.length} posibles leads.`);

            let guardadosEnEsteArchivo = 0;

            // 3. Sub-Bucle: Recorremos LEAD por LEAD
            for (const lead of leads) {
                // Adaptador universal
                const nombre = lead.nombre || lead.title || lead.name || "Sin Nombre";
                const telefono = lead.telefono || lead.phone || lead.phoneNumber || null;
                const web = lead.website || lead.url || lead.websiteUrl || null;
                const direccion = lead.direccion || lead.address || null;
                const ciudad = lead.ciudad || lead.city || null; 
                // Nota: Tu SQL tiene columna 'provincia', tratamos de llenarla si existe
                const provincia = lead.provincia || null; 

                if (!nombre || nombre === "Sin Nombre") {
                    totalOmitidos++;
                    continue;
                }

                // 4. Verificar duplicados (Usando 'leads_agro' y 'nombre_negocio')
                const duplicado = await pool.query(
                    "SELECT id FROM leads_agro WHERE nombre_negocio = $1 OR (website IS NOT NULL AND website = $2)", 
                    [nombre, web]
                );

                if (duplicado.rows.length > 0) {
                    totalOmitidos++;
                    continue; 
                }

                // 5. Insertar en la Base de Datos (Corregido: leads_agro y nombre_negocio)
                const query = `
                    INSERT INTO leads_agro (nombre_negocio, telefono, website, direccion, ciudad, provincia, origen, estado)
                    VALUES ($1, $2, $3, $4, $5, $6, 'apify_maps', 'nuevo')
                `;

                try {
                    await pool.query(query, [nombre, telefono, web, direccion, ciudad, provincia]);
                    guardadosEnEsteArchivo++;
                    totalGuardados++;
                } catch (err) {
                    console.error(`   ❌ Error SQL al guardar "${nombre}":`, err.message);
                }
            }
            console.log(`   ✅ Guardados de este archivo: ${guardadosEnEsteArchivo}`);
        }

        console.log(`\n🏁 IMPORTACIÓN FINALIZADA.`);
        console.log(`   📈 Total Nuevos Insertados: ${totalGuardados}`);
        console.log(`   🗑️ Total Duplicados/Ignorados: ${totalOmitidos}`);

    } catch (error) {
        console.error('❌ Error general en el importador:', error);
    }
}

importarLeads();