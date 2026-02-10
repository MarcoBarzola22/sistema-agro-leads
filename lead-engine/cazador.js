const puppeteer = require('puppeteer');
const { pool } = require('./db');

// DICCIONARIO AMPLIADO (Más palabras para detectar el rubro)
const KEYWORDS = {
    trayectoria: ['años', 'aniversario', 'fundada', 'trayectoria', 'historia', 'somos una empresa'],
    silos: ['silo', 'acopio', 'planta', 'cereal', 'secadora', 'logística', 'granos'],
    maquinaria: ['tractor', 'cosechadora', 'sembradora', 'john deere', 'case', 'new holland', 'massey', 'repuestos', 'agrícola'],
    ganaderia: ['bovino', 'hacienda', 'feedlot', 'veterinaria', 'animales', 'nutrición animal'],
    insumos: ['semillas', 'agroquímicos', 'fertilizantes', 'fitosanitarios', 'protección de cultivos', 'bayer', 'syngenta'],
    genetica: ['genética', 'variedades', 'soja', 'maíz', 'trigo', 'rendimiento', 'biotecnología']
};

async function cazarLeads() {
    console.log("🦅 Iniciando el Cazador V2.0...");
    
    // 1. MEJORA DE MEMORIA: Solo traemos los que NO han sido procesados ni dieron error
    // Usamos el campo 'estado' para filtrar.
    // Asumimos que los nuevos vienen con estado 'nuevo' o 'apify_maps'
    const res = await pool.query(`
        SELECT id, nombre_negocio, website 
        FROM leads_agro 
        WHERE website IS NOT NULL 
        AND (estado = 'nuevo' OR estado = 'apify_maps')
        LIMIT 10
    `);
    
    const leads = res.rows;

    if (leads.length === 0) {
        console.log("✅ No hay leads nuevos para procesar. ¡Todo al día!");
        process.exit();
    }

    console.log(`🎯 Objetivo: Procesar ${leads.length} webs nuevas.`);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // User Agent móvil a veces revela botones de WhatsApp que en desktop no están
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const lead of leads) {
        console.log(`\n🔍 Visitando: ${lead.nombre_negocio} (${lead.website})...`);

        try {
            // Timeout más corto (10s) para no perder tiempo si la web está muerta
            await page.goto(lead.website, { waitUntil: 'domcontentloaded', timeout: 10000 });

            // --- A. BÚSQUEDA PROFUNDA DE CONTACTO ---
            
            // 1. Buscar enlaces "mailto:" (Es más preciso que buscar texto suelto)
            const mailtoLinks = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
                return anchors.map(a => a.href.replace('mailto:', '').split('?')[0]);
            });

            // 2. Buscar enlaces de WhatsApp (wa.me o api.whatsapp)
            const waLinks = await page.evaluate(() => {
                const anchors = Array.from(document.querySelectorAll('a[href*="whatsapp"], a[href*="wa.me"]'));
                return anchors.map(a => a.href);
            });

            // 3. Buscar texto en el cuerpo (Plan B si no hay mailto)
            const text = await page.evaluate(() => document.body.innerText);
            const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
            const emailsTexto = text.match(emailRegex) || [];

            // Unir y limpiar emails
            const todosLosEmails = [...mailtoLinks, ...emailsTexto];
            const emailsUnicos = [...new Set(todosLosEmails)]
                .filter(e => !e.includes('.png') && !e.includes('.jpg') && !e.includes('wix') && e.length < 50);

            const emailFinal = emailsUnicos.length > 0 ? emailsUnicos[0] : null;
            const tieneWhatsApp = waLinks.length > 0;

            // --- B. DETECTIVE DE DETALLES (Mejorado) ---
            let detalle = "Vi sus servicios en la web"; 
            const textoBajo = text.toLowerCase();

            // Lógica de prioridad: Preferimos un dato específico sobre uno genérico
            if (KEYWORDS.genetica.some(k => textoBajo.includes(k))) {
                detalle = "Me interesa su propuesta en genética y semillas";
            } else if (KEYWORDS.silos.some(k => textoBajo.includes(k))) {
                detalle = "Vi que cuentan con planta de acopio propia";
            } else if (KEYWORDS.insumos.some(k => textoBajo.includes(k))) {
                detalle = "Vi que distribuyen insumos de primeras marcas";
            } else if (KEYWORDS.maquinaria.some(k => textoBajo.includes(k))) {
                detalle = "Vi que trabajan con maquinaria agrícola especializada";
            } else if (KEYWORDS.ganaderia.some(k => textoBajo.includes(k))) {
                detalle = "Vi que ofrecen servicios ganaderos completos";
            } else if (KEYWORDS.trayectoria.some(k => textoBajo.includes(k))) {
                detalle = "Impresionante la trayectoria que tienen en el rubro";
            }

            // --- RESULTADOS EN CONSOLA ---
            if (emailFinal) console.log(`   ✅ Email: ${emailFinal}`);
            else console.log(`   ⚠️ Email: No encontrado`);
            
            if (tieneWhatsApp) console.log(`   📱 WhatsApp detectado: SÍ`);
            
            console.log(`   💡 Detalle: "${detalle}"`);

            // --- C. GUARDAR Y CAMBIAR ESTADO ---
            // Si encontramos mail O whatsapp, lo consideramos "enriquecido". Si no, "visitado_sin_datos".
            const nuevoEstado = (emailFinal || tieneWhatsApp) ? 'enriquecido' : 'visitado_sin_datos';
            
            // Si encontramos WhatsApp pero no teléfono en la DB, podríamos actualizarlo acá también (opcional)
            
            await pool.query(`
                UPDATE leads_agro 
                SET email = $1, detalle_personalizado = $2, estado = $3
                WHERE id = $4
            `, [emailFinal, detalle, nuevoEstado, lead.id]);

        } catch (err) {
            console.log(`   ❌ Error: ${err.message}`);
            // ACÁ ESTÁ EL ARREGLO: Si falla, marcamos como 'error_web' para no volver a intentar mañana
            await pool.query(`UPDATE leads_agro SET estado = 'error_web' WHERE id = $1`, [lead.id]);
        }

        // Pausa de cortesía
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("\n🏁 Proceso terminado.");
    await browser.close();
}

cazarLeads();