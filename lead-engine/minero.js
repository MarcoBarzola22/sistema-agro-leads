require('dotenv').config(); 
const { ApifyClient } = require('apify-client');
const fs = require('fs');
const path = require('path');

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const ACTOR_ID = 'lukaskrivka/google-maps-with-contact-details';

// 🗺️ ESTRATEGIA DE BARRIDO PROVINCIAL
// Dividimos la provincia en puntos estratégicos para no dejar nada afuera.
const ZONAS = [
    "Villa Mercedes, San Luis",      // Zona Este / Centro
    "San Luis Capital, Argentina",   // Zona Oeste
    "Merlo, San Luis",               // Zona Norte (Turismo/Agro)
    "Santa Rosa de Conlara, San Luis", // Zona Norte (Fuerte en Agro/Maíz)
    "Buena Esperanza, San Luis",     // Zona Sur (Ganadería pura)
    "Justo Daract, San Luis",        // Zona Límite Cba
    "Quines, San Luis"               // Zona Norte/Oeste (Papa/Riego)
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
    "Criadero"
];

(async () => {
    console.log(`🚜 EL MINERO: Iniciando recorrido por toda la provincia de SAN LUIS...`);
    
    // Carpeta de guardado
    const rutaCarpeta = path.join(__dirname, 'input_data');
    if (!fs.existsSync(rutaCarpeta)) fs.mkdirSync(rutaCarpeta);

    // BUCLE: Recorremos cada zona una por una
    for (const zona of ZONAS) {
        console.log(`\n📍 Viajando a: ${zona}...`);

        const INPUT_DEL_ACTOR = {
            searchStringsArray: RUBROS,
            locationQuery: zona, // Acá va cambiando la ciudad automáticamente
            country: "Argentina",
            maxCrawledPlaces: 10, // 10 por rubro en CADA zona (Total: 7 zonas * 9 rubros * 10 = ~600 leads)
            language: "es", 
            zoom: 12, // Zoom medio para ver ciudad + campos aledaños
            skipClosedPlaces: true,
        };

        try {
            // Ejecutamos el actor para esta zona
            const run = await client.actor(ACTOR_ID).call(INPUT_DEL_ACTOR);
            console.log(`   ⏳ Procesando zona (Run ID: ${run.id})...`);

            const { items } = await client.dataset(run.defaultDatasetId).listItems();

            if (items.length > 0) {
                console.log(`   ✅ Encontrados ${items.length} leads en ${zona}.`);

                // Limpieza
                const leadsLimpios = items.map(item => ({
                    title: item.title || "Sin Nombre",
                    phone: item.phone || item.phoneNumber || null, 
                    website: item.website || null,
                    address: item.address || null,
                    city: item.city || zona, // Si no trae ciudad, ponemos la zona que buscamos
                    url_maps: item.url || null,
                }));

                // Guardamos UN archivo por zona para tener orden
                // Reemplazamos espacios y comas para el nombre del archivo
                const nombreZonaSafe = zona.replace(/[^a-z0-9]/gi, '_').toLowerCase(); 
                const nombreArchivo = `leads_${nombreZonaSafe}_${Date.now()}.json`;
                const rutaArchivo = path.join(rutaCarpeta, nombreArchivo);

                fs.writeFileSync(rutaArchivo, JSON.stringify(leadsLimpios, null, 2));
                console.log(`   💾 Guardado en: ${nombreArchivo}`);
            } else {
                console.log(`   ⚠️ No se encontró nada en ${zona} (o Apify saturado).`);
            }

        } catch (error) {
            console.error(`   ❌ Error en ${zona}:`, error.message);
        }
    }

    console.log("\n🏁 ¡Recorrido provincial terminado!");
})();