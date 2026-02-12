const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const { dbConfig } = require('./db');

// --- 🎛️ CENTRO DE CONTROL (Configura aquí tus límites) ---
const CONFIG = {
    MAX_LEADS: 10,           // 🛑 Límite de cantidad: ¿Cuántos procesamos hoy?
    MAX_TIEMPO_MINUTOS: 10,  // ⏰ Límite de tiempo: Si tarda más de X minutos, se apaga.
    TIMEOUT_PAGINA: 15000,   // ⏳ Paciencia por web: Esperar máx 15 seg a que cargue una página.
    ESPERA_ENTRE_LEADS: 3000 // 🐢 Pausa: Esperar 3 seg entre cada uno (anti-bloqueo).
};

const pool = new Pool(dbConfig);

// Función auxiliar para limpiar teléfonos (Misma lógica anterior)
function formatearParaWhatsapp(rawPhone) {
    if (!rawPhone) return null;
    let numero = rawPhone.replace(/\D/g, '');
    if (numero.startsWith('549')) return numero;
    if (numero.startsWith('0')) numero = numero.substring(1);
    if (numero.length === 10) return `549${numero}`;
    if (numero.startsWith('54') && !numero.startsWith('549')) return `549${numero.substring(2)}`;
    return numero;
}

(async () => {
    const tiempoInicio = Date.now();
    const tiempoLimiteMs = CONFIG.MAX_TIEMPO_MINUTOS * 60 * 1000;

    console.log(`🦅 CAZADOR V3 (Con Ubicación): Iniciando...`);
    console.log(`   ⚙️ Config: Máx ${CONFIG.MAX_LEADS} leads | Máx ${CONFIG.MAX_TIEMPO_MINUTOS} mins.`);

    // 1. Buscamos los leads (Usando el LÍMITE configurado)
    // ⚠️ CORREGIDO: Usamos 'leads_agro' que es tu tabla real
    const res = await pool.query(
        `SELECT * FROM leads_agro WHERE telefono IS NOT NULL AND link_whatsapp IS NULL LIMIT ${CONFIG.MAX_LEADS}`
    );
    const leads = res.rows;

    if (leads.length === 0) {
        console.log("✅ No hay leads pendientes. A descansar.");
        await pool.end();
        return;
    }

    console.log(`🎯 Objetivo: Procesar ${leads.length} leads encontrados.`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // User Agent para parecer un humano real
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    for (let i = 0; i < leads.length; i++) {
        let lead = leads[i];
        
        // 🚨 CHEQUEO DE TIEMPO (Emergency Brake)
        if ((Date.now() - tiempoInicio) > tiempoLimiteMs) {
            console.log("🛑 ¡TIEMPO MÁXIMO AGOTADO! Cerrando proceso para evitar cuelgues...");
            break; 
        }

        // CORREGIDO: Usamos nombre_negocio
        console.log(`\n[${i + 1}/${leads.length}] Procesando: ${lead.nombre_negocio}...`);

        // --- 📍 LÓGICA DE UBICACIÓN (Nuevo) ---
        // Prioridad: Ciudad -> Provincia -> "su zona"
        let ubicacion = "su zona";
        if (lead.ciudad) {
            ubicacion = lead.ciudad; // Ej: "Villa Mercedes"
        } else if (lead.provincia) {
            ubicacion = lead.provincia; // Ej: "San Luis"
        }
        // Capitalizamos la ubicación por estética
        ubicacion = ubicacion.charAt(0).toUpperCase() + ubicacion.slice(1);

        let mensaje = "";

        // Estrategia: Investigar Web
        if (lead.website) {
            try {
                const url = lead.website.startsWith('http') ? lead.website : `http://${lead.website}`;
                
                // Usamos el TIMEOUT configurado
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.TIMEOUT_PAGINA });
                
                const text = await page.evaluate(() => document.body.innerText.toLowerCase());

                // Lógica de Ganchos (Hooks) con Ubicación
                // CORREGIDO: Usamos lead.nombre_negocio en los mensajes
                if (text.includes("veterinaria") || text.includes("acopio") || text.includes("tambo")) {
                    mensaje = `Hola ${lead.nombre_negocio}, vi que tienen planta en ${ubicacion}. Queríamos comentarles sobre una solución para bajar costos de energía en los silos. ¿Les podría enviar info?`;
                } else if (text.includes("feedlot") || text.includes("ganad") || text.includes("hacienda")) {
                    mensaje = `Hola gente de ${lead.nombre_negocio}, vi sus instalaciones en ${ubicacion}. Tenemos un sistema de bombeo solar ideal para aguadas que ahorra mucho combustible. ¿Les interesa ver un caso de éxito?`;
                } else {
                    mensaje = `Hola ${lead.nombre_negocio}, estuve viendo su web y vi que están en ${ubicacion}. Somos Hidrosolar, ayudamos a empresas del agro a reducir costos eléctricos. ¿Con quién podría hablar del tema energía?`;
                }
            } catch (e) {
                console.log(`   ⚠️ Web lenta o inaccesible (Timeout de ${CONFIG.TIMEOUT_PAGINA}ms). Usando genérico.`);
                mensaje = `Hola ${lead.nombre_negocio}, los encontré en la guía de empresas de ${ubicacion}. Somos Hidrosolar, especialistas en energía para el agro. ¿Les podría dejar una breve presentación?`;
            }
        } else {
            mensaje = `Hola ${lead.nombre_negocio}, te escribo porque trabajamos con varios campos en la zona de ${ubicacion}. Somos Hidrosolar. ¿Te podría comentar brevemente cómo bajar costos de energía en el campo?`;
        }

        // Generar Link
        const telefonoLimpio = formatearParaWhatsapp(lead.telefono);
        const linkFinal = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;

        // Guardar en DB
        // CORREGIDO: Usamos leads_agro
        await pool.query(
            "UPDATE leads_agro SET link_whatsapp = $1, notas_hook = $2 WHERE id = $3",
            [linkFinal, mensaje, lead.id]
        );
        console.log(`   ✅ Link generado.`);

        // 🐢 PAUSA RESPIRATORIA (Configurable)
        await new Promise(r => setTimeout(r, CONFIG.ESPERA_ENTRE_LEADS));
    }

    await browser.close();
    await pool.end();
    
    const tiempoTotal = ((Date.now() - tiempoInicio) / 1000).toFixed(1);
    console.log(`\n🏁 Fin del turno. Tiempo total: ${tiempoTotal} segundos.`);
})();