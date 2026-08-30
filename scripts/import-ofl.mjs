// ============================================================
// Import catalogo Open Fixture Library -> Supabase
// ============================================================
//
// PREREQUISITI
//   1. alter table fixtures add column ofl_key text unique;
//   2. clona OFL accanto al progetto (non dentro!):
//        git clone --depth 1 https://github.com/OpenLightingProject/open-fixture-library.git
//   3. crea .env.import nella root del progetto:
//        SUPABASE_URL=https://xxxx.supabase.co
//        SUPABASE_SECRET_KEY=sb_secret_...
//        OFL_PATH=../open-fixture-library
//
// ATTENZIONE ALLA CHIAVE
//   Qui serve la SECRET key, non la publishable: deve scrivere nel
//   catalogo di sistema (owner_id NULL) scavalcando le policy RLS.
//   Gira solo in locale, mai nel browser. Aggiungi .env.import al
//   .gitignore PRIMA di eseguire (le righe .env* che hai messo
//   la coprono già).
//
// ESECUZIONE
//   node --env-file=.env.import scripts/import-ofl.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const OFL = process.env.OFL_PATH ?? '../open-fixture-library';

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

// ------------------------------------------------------------
// Filtro produttori.
// Lascia l'array vuoto per importare tutto (circa 1500 apparecchi).
// Meglio partire dai marchi che usi davvero: un catalogo grande
// rende la ricerca peggiore, non migliore.
// I nomi sono le cartelle dentro fixtures/ (tutte minuscole).
// ------------------------------------------------------------
const PRODUTTORI = [
  // 'chauvet-dj', 'adj', 'eurolite', 'martin', 'robe', 'showtec', 'cameo',
];

// ------------------------------------------------------------
// Mappa categorie OFL -> slug delle tue categorie.
// Le categorie OFL sono un elenco chiuso; la prima che combacia vince.
//
// NOTA: OFL non distingue Beam / Spot / Wash, che per lui sono
// tutti "Moving Head". Quelle tre categorie resteranno vuote e le
// assegnerai a mano dall'app: è una distinzione che conta per chi
// monta, non per chi cataloga i canali DMX.
// ------------------------------------------------------------
const MAPPA = {
  'Moving Head':    'teste-mobili',
  'Color Changer':  'par-led',
  'Blinder':        'blinder',
  'Strobe':         'strobo',
  'Laser':          'laser',
  'Smoke':          'macchine-fumo',
  'Hazer':          'macchine-fumo',
  'Fan':            'macchine-fumo',
  'Pixel Bar':      'barre-led',
  'Matrix':         'barre-led',
  'Dimmer':         'controller',
  'Effect':         'effetti',
  'Flower':         'effetti',
  'Scanner':        'effetti',
  'Barrel Scanner': 'effetti',
  'Stand':          'strutture',
};

// ------------------------------------------------------------
// Conteggio canali di una modalità.
//
// Di norma è la lunghezza dell'array channels. Ma OFL permette
// blocchi { insert: 'matrixChannels' } che si espandono in N canali
// a seconda della matrice di pixel: risolverli richiederebbe
// reimplementare mezzo OFL. In quei casi ripiego sullo shortName
// ("14ch" -> 14), che è quasi sempre presente e affidabile.
// Se nemmeno quello c'è, la modalità viene saltata: meglio un buco
// che un indirizzamento DMX sbagliato.
// ------------------------------------------------------------
function contaCanali(mode) {
  const ch = mode.channels ?? [];
  if (ch.every(c => typeof c === 'string' || c === null)) return ch.length;

  const m = (mode.shortName ?? '').match(/(\d+)\s*ch/i);
  return m ? Number(m[1]) : null;
}

async function elencaProduttori() {
  const dir = path.join(OFL, 'fixtures');
  const voci = await readdir(dir, { withFileTypes: true });
  const tutti = voci.filter(v => v.isDirectory()).map(v => v.name);
  return PRODUTTORI.length ? tutti.filter(p => PRODUTTORI.includes(p)) : tutti;
}

async function main() {
  // nomi commerciali dei produttori
  const marche = JSON.parse(
    await readFile(path.join(OFL, 'fixtures', 'manufacturers.json'), 'utf8')
  );

  // slug categoria -> id
  const { data: cats, error: errCat } = await db
    .from('categories').select('id, slug').is('owner_id', null);
  if (errCat) throw errCat;
  const catId = Object.fromEntries(cats.map(c => [c.slug, c.id]));

  const produttori = await elencaProduttori();
  console.log(`Produttori da importare: ${produttori.length}`);

  let nFix = 0, nModi = 0, saltate = 0;

  for (const prod of produttori) {
    const dir = path.join(OFL, 'fixtures', prod);
    const files = (await readdir(dir)).filter(f => f.endsWith('.json'));

    const righe = [];
    const modiPerKey = new Map();

    for (const file of files) {
      const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8'));

      // i file di redirect non sono apparecchi
      if (raw.redirectTo || !raw.name) continue;

      const key = `${prod}/${path.basename(file, '.json')}`;
      const slug = (raw.categories ?? []).map(c => MAPPA[c]).find(Boolean);

      righe.push({
        ofl_key:     key,
        nome:        raw.name,
        marca:       marche[prod]?.name ?? prod,
        modello:     raw.name,
        category_id: slug ? catId[slug] ?? null : null,
        watt:        raw.physical?.power ?? null,
        peso_kg:     raw.physical?.weight ?? null,
        owner_id:    null,               // catalogo di sistema
      });

      const modi = [];
      for (const [i, mode] of (raw.modes ?? []).entries()) {
        const n = contaCanali(mode);
        if (!n) { saltate++; continue; }
        modi.push({
          nome:          mode.name ?? mode.shortName ?? `Modo ${i + 1}`,
          channel_count: n,
          is_default:    i === 0,
        });
      }
      if (modi.length) modiPerKey.set(key, modi);
    }

    if (!righe.length) continue;

    // upsert su ofl_key: rieseguire lo script aggiorna, non duplica
    const { data: inserite, error } = await db
      .from('fixtures')
      .upsert(righe, { onConflict: 'ofl_key' })
      .select('id, ofl_key');
    if (error) { console.error(`${prod}:`, error.message); continue; }

    const modiRighe = inserite.flatMap(f =>
      (modiPerKey.get(f.ofl_key) ?? []).map(m => ({ ...m, fixture_id: f.id }))
    );

    if (modiRighe.length) {
      const { error: e2 } = await db
        .from('fixture_modes')
        .upsert(modiRighe, { onConflict: 'fixture_id,nome' });
      if (e2) console.error(`${prod} (modi):`, e2.message);
      else nModi += modiRighe.length;
    }

    nFix += inserite.length;
    console.log(`  ${prod}: ${inserite.length} apparecchi`);
  }

  console.log(`\nFatto: ${nFix} apparecchi, ${nModi} modalità.`);
  if (saltate) console.log(`Modalità saltate (canali non deducibili): ${saltate}`);
}

main().catch(e => { console.error(e); process.exit(1); });
