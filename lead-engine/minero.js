require('dotenv').config(); 
const { ApifyClient } = require('apify-client');
const fs = require('fs');
const path = require('path');

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const ACTOR_ID = 'lukaskrivka/google-maps-with-contact-details';

const ZONAS = [
    "Villa Mercedes, San Luis",
    "San Luis Capital, Argentina",
    "Merlo, San Luis",
    "Santa Rosa de Conlara, San Luis",
    "Buena Esperanza, San Luis",
    "Justo Daract, San Luis",
    "Quines, San Luis"
    
];

const RUBROS = [
    "Acopio de Cereales", 
    "Veterinaria", 
    "Venta de Semillas", 
    "Feedlot", 
    "Tambo",
    "Agro",
    "Ganaderia",
    "Avicola",
    "Criadero",
    "Silo"
];

(async () => {
    console.log(`🚜 EL MINERO: Iniciando recorrido provincial rápido (2 min por zona)...`);
    
    const rutaCarpeta = path.join(__dirname, 'input_data');
    if (!fs.existsSync(rutaCarpeta)) fs.mkdirSync(rutaCarpeta);

    for (const zona of ZONAS) {
        console.log(`\n📍 Zona actual: ${zona}`);

        const INPUT_DEL_ACTOR = {
            searchStringsArray: RUBROS,
            locationQuery: zona,
            country: "Argentina",
            maxCrawledPlaces: 20, // Traerá hasta 20 por zona
            language: "es", 
            zoom: 12, 
            skipClosedPlaces: true,
            // Mejora la variedad de resultados buscando por descripciones
            searchByCaptions: true, 
            includeReviews: false
        };

        try {
            // Límite estricto de 2 minutos (120 seg) y 512MB de memoria
            const run = await client.actor(ACTOR_ID).call(INPUT_DEL_ACTOR);

            console.log(`   ⏳ Procesando zona (ID: ${run.id}) - Tiempo límite: 120s`);

            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            if (items.length > 0) {
                console.log(`   ✅ Encontrados ${items.length} leads en ${zona}.`);

                const leadsLimpios = items.map(item => ({
                    title: item.title || "Sin Nombre",
                    phone: item.phone || item.phoneNumber || null, 
                    website: item.website || null,
                    address: item.address || null,
                    city: item.city || zona,
                    url_maps: item.url || null,
                }));

                const nombreZonaSafe = zona.replace(/[^a-z0-9]/gi, '_').toLowerCase(); 
                const nombreArchivo = `leads_${nombreZonaSafe}_${Date.now()}.json`;
                const rutaArchivo = path.join(rutaCarpeta, nombreArchivo);

                fs.writeFileSync(rutaArchivo, JSON.stringify(leadsLimpios, null, 2));
                console.log(`   💾 Guardado en: ${nombreArchivo}`);
            } else {
                console.log(`   ⚠️ Sin resultados en ${zona} tras 2 minutos.`);
            }

        } catch (error) {
            console.error(`   ❌ Error o Tiempo Agotado en ${zona}:`, error.message);
        }
    }

    console.log("\n🏁 Recorrido terminado. Podés revisar /input_data");
})();