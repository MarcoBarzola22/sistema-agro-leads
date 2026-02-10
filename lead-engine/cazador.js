const puppeteer = require('puppeteer');
const { pool } = require('./db'); // Usamos tu conexión a la DB

// Palabras clave para el "Detalle Personalizado"
const KEYWORDS = {
    trayectoria: ['años', 'aniversario', 'fundada', 'trayectoria', 'historia'],
    silos: ['silo', 'acopio', 'planta', 'cereal', 'secadora'],
    maquinaria: ['tractor', 'cosechadora', 'sembradora', 'john deere', 'case', 'new holland', 'massey'],
    ganaderia: ['bovino', 'hacienda', 'feedlot', 'veterinaria', 'animales']
};

async function cazarLeads() {
    console.log("🦅 Iniciando el Cazador...");
    
    // 1. Buscamos en la DB los leads que tienen WEB pero que no hemos procesado (o no tienen mail)
    // El "LIMIT 5" es para probar de a poco. Cuando ande bien, cambialo a 50 o sacalo.
    const res = await pool.query(`
        SELECT id, nombre_negocio, website 
        FROM leads_agro 
        WHERE website IS NOT NULL 
        AND email IS NULL 
        LIMIT 5
    `);
    
    const leads = res.rows;

    if (leads.length === 0) {
        console.log("✅ No hay leads pendientes para procesar.");
        process.exit();
    }

    console.log(`🎯 Objetivo: Procesar ${leads.length} webs.`);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Nos disfrazamos de usuario normal para que no nos bloqueen
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const lead of leads) {
        console.log(`\n🔍 Visitando: ${lead.nombre_negocio} (${lead.website})...`);

        try {
            // Ir a la web (máximo 15 segundos de espera)
            await page.goto(lead.website, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Extraer todo el texto de la página
            const text = await page.evaluate(() => document.body.innerText);
            const html = await page.content(); // También el HTML por si el mail está en un link
            
            // --- A. BUSCAR EMAILS ---
            // Esta magia (Regex) busca cualquier cosa que parezca un email
            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
            const emailsEncontrados = text.match(emailRegex) || html.match(emailRegex);
            
            // Filtramos emails basura (ej: wix, png, jpg) y nos quedamos con el primero
            let emailFinal = null;
            if (emailsEncontrados) {
                const emailsLimpios = [...new Set(emailsEncontrados)] // Eliminar duplicados
                    .filter(e => !e.includes('.png') && !e.includes('.jpg') && !e.includes('wix') && !e.includes('sentry'));
                
                if (emailsLimpios.length > 0) emailFinal = emailsLimpios[0];
            }

            // --- B. BUSCAR DETALLE (MARKETING) ---
            let detalle = "Vi sus servicios en la web"; // Default
            const textoBajo = text.toLowerCase();

            if (KEYWORDS.silos.some(k => textoBajo.includes(k))) {
                detalle = "Vi que cuentan con planta de acopio/silos";
            } else if (KEYWORDS.maquinaria.some(k => textoBajo.includes(k))) {
                detalle = "Vi que trabajan con maquinaria agrícola especializada";
            } else if (KEYWORDS.ganaderia.some(k => textoBajo.includes(k))) {
                detalle = "Vi que ofrecen servicios veterinarios/ganaderos completos";
            } else if (textoBajo.includes('años') || textoBajo.includes('aniversario')) {
                // Intentar sacar el número de años (esto es un extra)
                detalle = "Impresionante la trayectoria que tienen en el rubro";
            }

            console.log(`   📧 Email: ${emailFinal || "No encontrado"}`);
            console.log(`   💡 Detalle: "${detalle}"`);

            // --- C. GUARDAR EN DB ---
            await pool.query(`
                UPDATE leads_agro 
                SET email = $1, detalle_personalizado = $2, estado = 'enriquecido'
                WHERE id = $3
            `, [emailFinal, detalle, lead.id]);

        } catch (err) {
            console.log(`   ❌ Error visitando web: ${err.message}`);
            // Marcamos como error para no volver a intentar infinitamente
            await pool.query(`UPDATE leads_agro SET estado = 'error_web' WHERE id = $1`, [lead.id]);
        }

        // ESPERA DE CORTESÍA (3 segundos) para no saturar tu red ni la del cliente
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log("\n🏁 Proceso terminado.");
    await browser.close();
    // process.exit(); // Descomentar para cerrar script al final
}

cazarLeads();