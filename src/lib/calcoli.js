/* ============================================================
   Calcoli DMX ed elettrici.
   Nessuna dipendenza da React: qui c'è solo aritmetica, ed è il
   posto dove guardare quando un indirizzo non torna.
   ============================================================ */

export const CANALI_UNIVERSO = 512
export const VOLT = 230
export const AMPERE_LINEA = 16      // presa Schuko standard

/** Canali occupati da un elemento, secondo la modalità scelta. */
export function canaliDi(item) {
  return item.fixture_modes?.channel_count ?? 0
}

/**
 * Primo indirizzo libero in un universo che ospiti `n` canali.
 *
 * Cerca un buco tra gli apparecchi già indirizzati, non semplicemente
 * "dopo l'ultimo": chi patcha lascia spazi, e riempirli è metà del
 * mestiere. Restituisce null se l'universo non ha più posto.
 */
export function prossimoIndirizzo(items, universo, n, escludiId = null) {
  if (n < 1) return null

  const occupati = items
    .filter(i => i.dmx_universe === universo && i.dmx_address && i.id !== escludiId)
    .map(i => ({ da: i.dmx_address, a: i.dmx_address + canaliDi(i) - 1 }))
    .sort((x, y) => x.da - y.da)

  let candidato = 1
  for (const o of occupati) {
    if (candidato + n - 1 < o.da) return candidato
    candidato = Math.max(candidato, o.a + 1)
  }
  return candidato + n - 1 <= CANALI_UNIVERSO ? candidato : null
}

/** Sovrapposizioni di indirizzo: due apparecchi che si calpestano. */
export function conflitti(items) {
  const esiti = new Map()

  const conIndirizzo = items.filter(i => i.dmx_address && canaliDi(i) > 0)

  for (const a of conIndirizzo) {
    for (const b of conIndirizzo) {
      if (a.id >= b.id || a.dmx_universe !== b.dmx_universe) continue
      const aFine = a.dmx_address + canaliDi(a) - 1
      const bFine = b.dmx_address + canaliDi(b) - 1
      if (a.dmx_address <= bFine && b.dmx_address <= aFine) {
        esiti.set(a.id, true)
        esiti.set(b.id, true)
      }
    }
  }
  return esiti
}

/** Riepilogo per universo DMX. */
export function perUniverso(items) {
  const mappa = new Map()

  // chi non occupa canali (truss, macchine a telecomando, apparecchi
  // con solo interruttore) non appartiene a nessun universo
  for (const i of items.filter(x => canaliDi(x) > 0)) {
    const u = i.dmx_universe ?? 1
    const r = mappa.get(u) ?? { universo: u, canali: 0, pezzi: 0, oltre: 0 }
    r.canali += canaliDi(i)
    r.pezzi += 1
    if (i.dmx_address && i.dmx_address + canaliDi(i) - 1 > CANALI_UNIVERSO) r.oltre += 1
    mappa.set(u, r)
  }

  return [...mappa.values()]
    .sort((a, b) => a.universo - b.universo)
    .map(r => ({
      ...r,
      liberi: CANALI_UNIVERSO - r.canali,
      saturo: r.canali > CANALI_UNIVERSO,
    }))
}

/**
 * Riepilogo per circuito elettrico.
 *
 * Stima d'orientamento: watt totali diviso 230 V. Non tiene conto del
 * fattore di potenza né delle correnti di spunto, che su un parco LED
 * numeroso non sono trascurabili. Serve ad accorgersi che stai per
 * saturare una linea, non a dimensionare un impianto.
 */
export function perCircuito(items) {
  const mappa = new Map()

  for (const i of items) {
    const c = i.circuito?.trim() || 'non assegnato'
    const r = mappa.get(c) ?? { circuito: c, watt: 0, pezzi: 0 }
    r.watt += Number(i.fixtures?.watt ?? 0)
    r.pezzi += 1
    mappa.set(c, r)
  }

  return [...mappa.values()]
    .sort((a, b) => b.watt - a.watt)
    .map(r => ({
      ...r,
      ampere: r.watt / VOLT,
      sopra: r.watt / VOLT > AMPERE_LINEA,
    }))
}

/** Totali del setup. */
export function totali(items) {
  return {
    pezzi: items.length,
    senzaDmx: items.filter(i => canaliDi(i) === 0).length,
    watt: items.reduce((s, i) => s + Number(i.fixtures?.watt ?? 0), 0),
    peso: items.reduce((s, i) => s + Number(i.fixtures?.peso_kg ?? 0), 0),
    canali: items.reduce((s, i) => s + canaliDi(i), 0),
  }
}
