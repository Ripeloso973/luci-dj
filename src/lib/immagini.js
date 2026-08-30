import { supabase } from './supabase'

const LATO_MAX = 700
const QUALITA = 0.82

/**
 * Riduce l'immagine prima di caricarla.
 *
 * Una foto scattata col telefono pesa 3-8 MB. Caricata così com'è
 * riempie il piano gratuito in poche decine di apparecchi e, cosa
 * peggiore, rende il catalogo inusabile in sala su rete mobile.
 * Dopo questa riduzione siamo sui 30-60 KB, con una qualità più
 * che sufficiente per una scheda.
 *
 * Il ridimensionamento avviene nel browser: nessun server, nessuna
 * libreria, nessun costo.
 */
export async function riduci(file) {
  const bitmap = await createImageBitmap(file)

  const scala = Math.min(1, LATO_MAX / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scala)
  const h = Math.round(bitmap.height * scala)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise(res =>
    canvas.toBlob(res, 'image/webp', QUALITA)
  )
  if (!blob) throw new Error('Non sono riuscito a convertire l\'immagine.')
  return blob
}

/**
 * Carica la foto e restituisce l'URL pubblico.
 * Il percorso <utente>/<apparecchio>.webp è ciò su cui si appoggiano
 * le policy dello storage: cambiarlo le rompe.
 */
export async function caricaFoto(file, utenteId, fixtureId) {
  const blob = await riduci(file)
  const percorso = `${utenteId}/${fixtureId}.webp`

  const { error } = await supabase.storage
    .from('apparecchi')
    .upload(percorso, blob, { contentType: 'image/webp', upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('apparecchi').getPublicUrl(percorso)

  // marca temporale: senza, dopo una sostituzione il browser
  // continua a mostrare la vecchia foto presa dalla cache
  return `${data.publicUrl}?v=${Date.now()}`
}

export async function eliminaFoto(utenteId, fixtureId) {
  await supabase.storage
    .from('apparecchi')
    .remove([`${utenteId}/${fixtureId}.webp`])
}
