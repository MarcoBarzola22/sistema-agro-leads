const { pool } = require('./db');

(async () => {
    try {
        console.log("📲 DESPACHADOR DE WHATSAPP - HIDROSOLAR");
        
        // Traemos 10 leads que tengan link de whatsapp y no hayan sido contactados
        const res = await pool.query(`
            SELECT nombre_negocio, link_whatsapp 
            FROM leads_agro 
            WHERE link_whatsapp IS NOT NULL 
            AND estado = 'enriquecido'
            LIMIT 10
        `);

        if (res.rows.length === 0) {
            console.log("✅ No hay leads listos para enviar hoy.");
            process.exit();
        }

        console.log("\nPresiona CTRL + Click en los links para abrir WhatsApp Web:\n");
        
        res.rows.forEach((lead, index) => {
            console.log(`${index + 1}. 🏢 ${lead.nombre_negocio}`);
            console.log(`   🔗 Link: ${lead.link_whatsapp}\n`);
        });

    } catch (err) {
        console.error("❌ Error al obtener los links:", err.message);
    }
})();