/* ============================================================
   Specifiche tecniche per categoria.
   ============================================================
   Quello che entra nei calcoli (watt, peso, canali DMX) sono
   colonne vere della tabella. Qui c'è solo ciò che è descrittivo:
   si legge in scheda, non si somma.

   Ogni campo: chiave, etichetta, tipo, e per i numeri l'unità.
   Aggiungere un campo a una categoria significa aggiungere una
   riga qui: l'interfaccia si adegua da sola.
   ============================================================ */

const SORGENTE = {
  chiave: 'sorgente', etichetta: 'Sorgente', tipo: 'scelta',
  opzioni: ['LED', 'Scarica', 'Alogena', 'Laser'],
}

const LUMEN = { chiave: 'lumen', etichetta: 'Flusso', tipo: 'numero', unita: 'lm' }
const ANGOLO = { chiave: 'angolo', etichetta: 'Angolo fascio', tipo: 'numero', unita: '°' }
const ZOOM = { chiave: 'zoom', etichetta: 'Zoom', tipo: 'testo', segnaposto: '10–45°' }

const COLORI = {
  chiave: 'colori', etichetta: 'Miscelazione', tipo: 'scelta',
  opzioni: ['RGB', 'RGBW', 'RGBWA', 'RGBAW+UV', 'CMY', 'Bianco variabile', 'Bianco fisso'],
}

const PAN_TILT = [
  { chiave: 'pan', etichetta: 'Pan', tipo: 'numero', unita: '°' },
  { chiave: 'tilt', etichetta: 'Tilt', tipo: 'numero', unita: '°' },
]

const GOBO = [
  { chiave: 'gobo_fissi', etichetta: 'Gobo fissi', tipo: 'numero' },
  { chiave: 'gobo_rotanti', etichetta: 'Gobo rotanti', tipo: 'numero' },
  { chiave: 'prisma', etichetta: 'Prisma', tipo: 'scelta', opzioni: ['No', '3 facce', '5 facce', '8 facce', 'Multiplo'] },
]

const ATTACCO = {
  chiave: 'attacco', etichetta: 'Aggancio', tipo: 'scelta',
  opzioni: ['Gancio truss', 'Base a terra', 'Stativo', 'Incasso', 'Appeso'],
}

const IP = {
  chiave: 'ip', etichetta: 'Protezione', tipo: 'scelta',
  opzioni: ['Interno (IP20)', 'IP54', 'IP65', 'IP66'],
}

/* ------------------------------------------------------------
   Campi per slug di categoria.
   ------------------------------------------------------------ */
export const SPECIFICHE = {
  'teste-mobili': [...PAN_TILT, SORGENTE, LUMEN, ANGOLO, ZOOM, COLORI, ...GOBO, IP],
  'beam':         [...PAN_TILT, SORGENTE, LUMEN, ANGOLO, ...GOBO, IP],
  'spot':         [...PAN_TILT, SORGENTE, LUMEN, ANGOLO, ZOOM, ...GOBO, IP],
  'wash':         [...PAN_TILT, SORGENTE, LUMEN, ANGOLO, ZOOM, COLORI, IP],

  'par-led':      [SORGENTE, LUMEN, ANGOLO, COLORI, ATTACCO, IP],
  'barre-led':    [
    LUMEN, ANGOLO, COLORI,
    { chiave: 'pixel', etichetta: 'Pixel', tipo: 'numero' },
    { chiave: 'lunghezza', etichetta: 'Lunghezza', tipo: 'numero', unita: 'cm' },
    ATTACCO, IP,
  ],

  'strobo': [
    LUMEN,
    { chiave: 'frequenza_max', etichetta: 'Frequenza max', tipo: 'numero', unita: 'Hz' },
    { chiave: 'led_zone', etichetta: 'Zone indipendenti', tipo: 'numero' },
    IP,
  ],

  'blinder': [
    LUMEN,
    { chiave: 'lampade', etichetta: 'Numero lampade', tipo: 'numero' },
    { chiave: 'temperatura', etichetta: 'Temperatura colore', tipo: 'numero', unita: 'K' },
    IP,
  ],

  'laser': [
    { chiave: 'potenza_ottica', etichetta: 'Potenza ottica', tipo: 'numero', unita: 'mW' },
    { chiave: 'classe', etichetta: 'Classe di sicurezza', tipo: 'scelta',
      opzioni: ['1', '2', '3R', '3B', '4'] },
    { chiave: 'colori_laser', etichetta: 'Colori', tipo: 'scelta',
      opzioni: ['Rosso', 'Verde', 'RGB', 'RGBY'] },
    { chiave: 'ilda', etichetta: 'Ingresso ILDA', tipo: 'scelta', opzioni: ['Sì', 'No'] },
    { chiave: 'angolo_scansione', etichetta: 'Angolo scansione', tipo: 'numero', unita: '°' },
  ],

  'macchine-fumo': [
    { chiave: 'tipo_macchina', etichetta: 'Tipo', tipo: 'scelta',
      opzioni: ['Fumo', 'Haze', 'Fumo pesante', 'Bolle', 'Neve', 'Coriandoli', 'Ventilatore'] },
    { chiave: 'portata', etichetta: 'Portata', tipo: 'numero', unita: 'm³/min' },
    { chiave: 'serbatoio', etichetta: 'Serbatoio', tipo: 'numero', unita: 'l' },
    { chiave: 'riscaldamento', etichetta: 'Tempo riscaldamento', tipo: 'numero', unita: 'min' },
    { chiave: 'liquido', etichetta: 'Liquido', tipo: 'testo', segnaposto: 'A base acqua' },
  ],

  'effetti': [
    SORGENTE, LUMEN, COLORI,
    { chiave: 'effetto', etichetta: 'Tipo di effetto', tipo: 'testo', segnaposto: 'Derby, flower, moonflower…' },
    ATTACCO, IP,
  ],

  'controller': [
    { chiave: 'universi', etichetta: 'Universi gestiti', tipo: 'numero' },
    { chiave: 'canali', etichetta: 'Canali totali', tipo: 'numero' },
    { chiave: 'uscite', etichetta: 'Uscite', tipo: 'testo', segnaposto: 'XLR 3+5 poli, Art-Net' },
    { chiave: 'fader', etichetta: 'Fader', tipo: 'numero' },
  ],

  'strutture': [
    { chiave: 'tipo_struttura', etichetta: 'Tipo', tipo: 'scelta',
      opzioni: ['Truss dritto', 'Angolo', 'Torre', 'Base', 'Stativo', 'Barra a T'] },
    { chiave: 'lunghezza_str', etichetta: 'Lunghezza', tipo: 'numero', unita: 'cm' },
    { chiave: 'portata', etichetta: 'Portata massima', tipo: 'numero', unita: 'kg' },
    { chiave: 'altezza_max', etichetta: 'Altezza massima', tipo: 'numero', unita: 'm' },
    { chiave: 'sezione', etichetta: 'Sezione', tipo: 'testo', segnaposto: 'Quadro 290 mm' },
  ],
}

/** Campi da mostrare per una categoria. Vuoto se non la conosciamo. */
export function campiPer(slug) {
  return SPECIFICHE[slug] ?? []
}

/** Specifiche valorizzate, per la visualizzazione in scheda. */
export function specificheLeggibili(slug, valori = {}) {
  return campiPer(slug)
    .filter(c => valori[c.chiave] !== undefined && valori[c.chiave] !== '')
    .map(c => ({
      etichetta: c.etichetta,
      valore: c.unita ? `${valori[c.chiave]} ${c.unita}` : String(valori[c.chiave]),
    }))
}
