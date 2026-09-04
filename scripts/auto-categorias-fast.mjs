import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GROUPS_DICT = [
  // Herramientas Eléctricas
  { keys: ["amoladora", "esmeril"], group: "Amoladoras" },
  { keys: ["taladro", "agujereadora"], group: "Taladros" },
  { keys: ["rotomartillo"], group: "Rotomartillos" },
  { keys: ["demoledor"], group: "Demoledores" },
  { keys: ["sierra", "caladora", "ingletadora", "sensitiva", "serrucho electrico"], group: "Sierras e Ingletadoras" },
  { keys: ["soldadora", "inverter", "soldador"], group: "Soldadoras" },
  { keys: ["compresor"], group: "Compresores" },
  { keys: ["cepillo"], group: "Cepillos Eléctricos" },
  { keys: ["lijadora"], group: "Lijadoras" },
  { keys: ["fresadora", "router"], group: "Fresadoras" },
  { keys: ["pistola de calor", "pistola de pintar"], group: "Pistolas" },
  { keys: ["atornillador"], group: "Atornilladores" },
  { keys: ["minitorno"], group: "Minitornos" },
  { keys: ["lustradora", "pulidora"], group: "Pulidoras" },

  // Jardín y Bosque
  { keys: ["motosierra"], group: "Motosierras" },
  { keys: ["desmalezadora", "bordeadora", "motoguadaña"], group: "Desmalezadoras y Bordeadora" },
  { keys: ["cortadora", "cesped", "rapicort"], group: "Cortadoras de Césped" },
  { keys: ["sopladora", "aspirador"], group: "Sopladoras y Aspiradoras" },
  { keys: ["hidrolavadora"], group: "Hidrolavadoras" },
  { keys: ["manguera"], group: "Mangueras" },
  { keys: ["pulverizador", "fumigador"], group: "Pulverizadores" },
  { keys: ["ahoyadora"], group: "Ahoyadoras" },
  { keys: ["pala", "pico", "rastrillo", "hacha", "machete", "tijera de podar", "podadora"], group: "Herramientas de Jardín" },
  { keys: ["maceta"], group: "Macetas" },
  { keys: ["aspersor", "riego"], group: "Riego" },

  // Automotor
  { keys: ["bateria auto", "bateria"], group: "Baterías" },
  { keys: ["crique", "gato"], group: "Criques" },
  { keys: ["llave cruz"], group: "Llaves Cruz" },
  { keys: ["aceite", "lubricante", "wd40", "wd-40"], group: "Aceites y Lubricantes" },
  { keys: ["bujia"], group: "Bujías" },
  { keys: ["filtro"], group: "Filtros" },
  { keys: ["semimascara", "mascara", "protector auditivo", "antiparra", "guantes"], group: "Protección Personal" },
  { keys: ["correa"], group: "Correas" },
  { keys: ["eje"], group: "Ejes" },
  { keys: ["inflador", "arrancador"], group: "Infladores y Arrancadores" },

  // Sanitarios e instalaciones
  { keys: ["griferia", "canilla", "mezcladora", "ducha"], group: "Griferías" },
  { keys: ["bomba", "motobomba", "sumergible", "centrifuga"], group: "Bombas de Agua" },
  { keys: ["valvula"], group: "Válvulas" },
  { keys: ["tubo", "caño", "flexible"], group: "Caños y Flexibles" },
  { keys: ["codo", "te ", "cupla", "buje", "niple", "union", "acople", "conector", "reduccion", "tapon", "tapa"], group: "Conexiones" },
  { keys: ["sifon", "sopapa", "rejilla"], group: "Desagües" },
  { keys: ["termofusora", "termofusion"], group: "Termofusión" },
  { keys: ["oring", "o-ring", "junta", "reten"], group: "O-Rings y Juntas" },
  { keys: ["tanque"], group: "Tanques de Agua" },
  { keys: ["sanitario", "inodoro", "bidet", "bacha"], group: "Sanitarios" },

  // Materiales de construcción / Pinturería
  { keys: ["cemento", "cal ", "arena", "yeso"], group: "Áridos y Cementos" },
  { keys: ["ladrillo", "bloque"], group: "Ladrillos" },
  { keys: ["pegamento", "adhesivo", "silicona", "sellador", "masilla", "poxi", "fastix", "suprabond", "tecbond"], group: "Pegamentos y Selladores" },
  { keys: ["membrana"], group: "Membranas" },
  { keys: ["pintura", "esmalte", "barniz", "latex", "sintetico", "acrilico", "aerosol", "impregnante"], group: "Pinturas" },
  { keys: ["thinner", "aguarras", "solvente"], group: "Solventes" },
  { keys: ["rodillo", "pincel", "bandeja", "pincileta"], group: "Accesorios para Pintar" },
  { keys: ["chapa"], group: "Chapas" },
  { keys: ["hierro", "malla", "perfil", "angulo"], group: "Hierros y Perfiles" },
  { keys: ["alambre"], group: "Alambres" },
  { keys: ["soga", "cuerda"], group: "Sogas y Cuerdas" },
  { keys: ["cadena"], group: "Cadenas" },
  { keys: ["escalera"], group: "Escaleras" },
  { keys: ["carretilla"], group: "Carretillas" },

  // Materiales Eléctricos
  { keys: ["cable", "canal"], group: "Cables y Canaletas" },
  { keys: ["lampara", "foco", "led", "tubo led", "iluminacion", "reflector", "farol", "liston"], group: "Iluminación" },
  { keys: ["interruptor", "llave de luz", "punto", "tecla"], group: "Llaves y Puntos" },
  { keys: ["toma", "enchufe"], group: "Tomas y Enchufes" },
  { keys: ["termica", "disyuntor", "llave termomagnetica", "diferencial"], group: "Térmicas y Disyuntores" },
  { keys: ["caja", "gabinete", "tablero"], group: "Cajas Eléctricas" },
  { keys: ["prolongador", "zapatilla", "alargue"], group: "Prolongadores" },
  { keys: ["bastidor", "modulo", "tapa"], group: "Módulos y Bastidores" },
  { keys: ["cinta aisladora", "aislante"], group: "Cintas Aisladoras" },
  { keys: ["ficha"], group: "Fichas Eléctricas" },
  { keys: ["bornera", "terminal", "ojal"], group: "Terminales" },
  { keys: ["tester", "multimetro", "busca polo"], group: "Instrumentos de Medición" },
  { keys: ["kalop"], group: "Kalop" },

  // Herramientas Manuales y Accesorios
  { keys: ["destornillador", "phillips", "plano", "torx"], group: "Destornilladores" },
  { keys: ["pinza", "alicate", "tenaza"], group: "Pinzas y Alicates" },
  { keys: ["llave inglesa", "llave francesa", "llave combinada", "llave estria", "llave allen", "llaves"], group: "Llaves Manuales" },
  { keys: ["martillo", "maza"], group: "Martillos y Mazas" },
  { keys: ["bocallave", "boc.", "tubo", "criquet", "crique manual", "manija de fuerza"], group: "Tubos y Bocallaves" },
  { keys: ["mecha", "broca", "copa", "cincel"], group: "Mechas y Cinceles" },
  { keys: ["disco", "diamantado", "corte", "desbaste", "flap"], group: "Discos" },
  { keys: ["punta", "adaptador"], group: "Puntas y Adaptadores" },
  { keys: ["cinta metrica", "ruleta", "metro", "escuadra", "nivel", "medidor", "calibre"], group: "Medición y Trazado" },
  { keys: ["serrucho", "arco de sierra", "hoja"], group: "Corte Manual" },
  { keys: ["cutter", "trincheta", "cuchilla"], group: "Cutters" },
  { keys: ["remachadora"], group: "Remachadoras" },
  { keys: ["espatula", "llana", "fratacho"], group: "Albañilería" },
  { keys: ["formon", "gubia", "cepillo de mano"], group: "Carpintería" },
  { keys: ["morsa", "prensa", "sargento", "mordaza"], group: "Sujeción" },
  { keys: ["soldador", "cautin", "estaño"], group: "Soldadura" },
  { keys: ["electrodo", "alambre mig"], group: "Electrodos y Consumibles" },
  { keys: ["piedra"], group: "Piedras" },
  { keys: ["tijera", "cortaperno"], group: "Tijeras y Cortapernos" },
  { keys: ["sacabocado", "sacabujia"], group: "Saca Bocados/Bujías" },

  // Fijaciones y Bulonería
  { keys: ["tornillo", "autoperforante", "fix", "drywall", "tirafondo"], group: "Tornillos" },
  { keys: ["clavo", "grampa"], group: "Clavos y Grampas" },
  { keys: ["bulon"], group: "Bulones" },
  { keys: ["tuerca", "arandela", "tarugo"], group: "Tuercas y Arandelas" },
  { keys: ["remache"], group: "Remaches" },
  { keys: ["bisagra"], group: "Bisagras" },
  { keys: ["cerradura", "candado", "picaporte", "pasador", "cerrojo", "llave "], group: "Cerrajería" },
  { keys: ["resorte"], group: "Resortes" },
  { keys: ["rueda", "rodamiento"], group: "Ruedas" },
  { keys: ["soporte", "anclaje"], group: "Soportes y Anclajes" },

  // Genéricos / Limpieza
  { keys: ["limpia mano", "limpiador", "detergente", "crema", "gel"], group: "Limpieza" },
  { keys: ["rep.", "repuesto", "engranaje", "inducido", "carbones", "rotor", "estator"], group: "Repuestos" },
  { keys: ["jgo.", "juego", "kit ", "set "], group: "Juegos y Kits" }
];

function determineGroup(name) {
  let lowerName = name.toLowerCase().trim();
  
  // 1. Intentar hacer match por diccionario (la forma más precisa)
  for (const dict of GROUPS_DICT) {
    for (const key of dict.keys) {
      if (lowerName.includes(key)) {
        return dict.group;
      }
    }
  }

  // 2. Si no lo encuentra en el diccionario, aplicamos el método rudimentario "fall-back" mejorado
  let firstWord = lowerName.split(/[\s-]/)[0].replace(/[^a-zñáéíóú]/g, "");
  if (firstWord.length < 3 && lowerName.split(" ").length > 1) {
    firstWord = lowerName.split(" ")[1].replace(/[^a-zñáéíóú]/g, "");
  }
  
  if (firstWord.length < 3) return "Varios";
  
  let grupo = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  if (grupo.endsWith("a") || grupo.endsWith("e") || grupo.endsWith("o") || grupo.endsWith("i") || grupo.endsWith("u")) {
    grupo += "s";
  } else if (grupo.endsWith("r") || grupo.endsWith("l") || grupo.endsWith("n") || grupo.endsWith("d") || grupo.endsWith("j")) {
    grupo += "es";
  } else if (grupo.endsWith("z")) {
    grupo = grupo.slice(0, -1) + "ces";
  } else if (!grupo.endsWith("s")) {
    grupo += "s";
  }
  
  return grupo;
}

async function main() {
  console.log("🚀 Iniciando perfección de GRUPOS mediante súper-diccionario ferretero...");
  
  let offset = 0;
  let limit = 1000;
  let allProducts = [];
  
  while (true) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, categoria, grupo")
      .range(offset, offset + limit - 1);
      
    if (error) {
       console.error("Error fetching:", error);
       process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    allProducts.push(...data);
    offset += limit;
  }
  
  console.log(`✅ Reprocesando la totalidad de los ${allProducts.length} productos del catálogo.`);
  
  let updates = [];
  
  for (const p of allProducts) {
    if (!p.nombre) continue;
    // Solo determinamos el grupo nuevo, no tocamos la categoría (p.categoria)
    const nuevoGrupo = determineGroup(p.nombre);
    
    // Solo lo agregamos al lote si cambió para ahorrar escritura a la DB, 
    // o lo forzamos a actualizar para que sobreescriba todos. Lo forzamos.
    updates.push({ id: p.id, grupo: nuevoGrupo });
  }

  // Hacer el update masivo en lotes de 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    // Imprimir un par de ejemplos para que veamos la magia del diccionario
    if (i === 0 || i === 100) {
      console.log(`\nEjemplos del lote ${i/BATCH_SIZE + 1}:`);
      batch.slice(0, 3).forEach(b => {
        const prod = allProducts.find(p => p.id === b.id);
        console.log(`🔸 "${prod.nombre.substring(0, 35)}" -> Grupo asignado: "${b.grupo}"`);
      });
    }

    // Actualizamos SOLO el campo grupo
    const updatePromises = batch.map(b => 
      supabase.from("productos").update({ grupo: b.grupo }).eq("id", b.id)
    );
    await Promise.all(updatePromises);
    process.stdout.write(`✅ Lote ${Math.floor(i/BATCH_SIZE)+1} listo... `);
  }
  
  console.log("\n🎉 ¡Proceso finalizado! Los grupos ahora son increíblemente precisos.");
}

main();
