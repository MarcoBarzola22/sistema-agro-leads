require('dotenv').config();
const { ApifyClient } = require('apify-client');
const fs = require('fs');
const path = require('path');

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// EL ID QUE VIMOS EN TU ERROR (No lo pierdas)
const RUN_ID = 'MiifFaxcRCURv7JxG'; 

(async () => {
    console.log(`🚑 RESCATISTA: Conectando con la nube para recuperar Run ${RUN_ID}...`);
    
    try {
        // 1. Buscamos la info del Run
        const run = await client.run(RUN_ID).get();
        console.log(`   Estado del Robot en la nube: ${run.status}`);

        // 2. Descargamos los datos
        console.log("   ⬇️ Bajando datos...");
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        
        console.log(`   📦 ¡Recuperados ${items.length} leads!`);

        // 3. Limpieza (Igual que en el minero)
        const leadsLimpios = items.map(item => ({
            title: item.title || "Sin Nombre",
            phone: item.phone || item.phoneNumber || null, 
            website: item.website || null,
            address: item.address || null,
            city: item.city || "San Luis (Recuperado)",
            url_maps: item.url || null,
        }));

        // 4. Guardar archivo
        const nombreArchivo = `leads_RESCATADOS_${Date.now()}.json`;
        const rutaCarpeta = path.join(__dirname, 'input_data');
        if (!fs.existsSync(rutaCarpeta)) fs.mkdirSync(rutaCarpeta);
        
        const rutaArchivo = path.join(rutaCarpeta, nombreArchivo);
        fs.writeFileSync(rutaArchivo, JSON.stringify(leadsLimpios, null, 2));
        
        console.log(`   💾 ¡Salvados! Archivo guardado en: ${nombreArchivo}`);
        console.log(`   👉 Ahora podés correr 'node importador.js'`);

    } catch (error) {
        console.error("   ❌ Falló el rescate:", error.message);
    }
})();