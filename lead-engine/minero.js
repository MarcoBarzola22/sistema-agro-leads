require('dotenv').config(); // Cargar el token desde el archivo .env
const { ApifyClient } = require('apify-client');
const fs = require('fs');
const path = require('path');

// 1. Configuración Inicial
const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

// CONFIGURACIÓN DE LA BÚSQUEDA
// ---------------------------------------------------------
// Si usan "LinkedIn Company Scraper" (ej: dev_fusion/linkedin-company-scraper)
const ACTOR_ID = 'dev_fusion/linkedin-company-scraper'; 
const INPUT_DEL_ACTOR = {
    keywords: ["Acopio", "Cerealera", "Agroinsumos"], // Tus términos de búsqueda
    location: "Argentina", // LinkedIn funciona mejor por país
    count: 20, // Cantidad de resultados a traer (Ojo con el crédito)
    // Otros filtros opcionales (depende del actor):
    // industry: "Farming",
};

/* // OPCIÓN B: Si vuelven a usar Google Maps, descomenta esto:
const ACTOR_ID = 'compass/google-maps-scraper';
const INPUT_DEL_ACTOR = {
    searchStringsArray: ["Veterinaria en Villa Mercedes, San Luis"],
    maxCrawledPlaces: 20,
    language: "es",
};
*/
// ---------------------------------------------------------

(async () => {
    console.log(`👷 EL MINERO: Iniciando excavación en ${ACTOR_ID}...`);
    
    try {
        // 2. Ejecutar el Actor
        const run = await client.actor(ACTOR_ID).call(INPUT_DEL_ACTOR);

        console.log(`⏳ Procesando... (Run ID: ${run.id})`);
        console.log(`   Puedes ver el progreso en vivo aquí: https://console.apify.com/actors/runs/${run.id}`);

        // 3. Obtener los resultados (Dataset)
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (items.length === 0) {
            console.log("❌ No se encontraron resultados. Revisa tus términos de búsqueda.");
            return;
        }

        console.log(`✅ ¡Éxito! Se encontraron ${items.length} empresas.`);

        // 4. Limpieza de Datos (Adaptar según lo que traiga el actor)
        // Esto normaliza los datos para que tu sistema los entienda
        const leadsLimpios = items.map(item => ({
            nombre: item.name || item.title || "Sin Nombre",
            website: item.websiteUrl || item.website || null,
            telefono: item.phone || null,
            direccion: item.address || item.location || null,
            fuente: "LinkedIn", // O "Google Maps"
            raw_data: { ...item } // Guardamos todo lo demás por si acaso
        }));

        // 5. Guardar en archivo JSON
        const nombreArchivo = `leads_linkedin_${Date.now()}.json`;
        const rutaArchivo = path.join(__dirname, 'input_data', nombreArchivo);

        // Asegurar que la carpeta exista
        if (!fs.existsSync(path.join(__dirname, 'input_data'))) {
            fs.mkdirSync(path.join(__dirname, 'input_data'));
        }

        fs.writeFileSync(rutaArchivo, JSON.stringify(leadsLimpios, null, 2));
        
        console.log(`💾 Datos guardados en: ${rutaArchivo}`);
        console.log("👉 Ahora ejecuta: node importador.js para subirlos a la base de datos.");

    } catch (error) {
        console.error("❌ Error en la minería:", error.message);
        console.error("  (Verifica tu API Token y que tengas crédito en Apify)");
    }
})();