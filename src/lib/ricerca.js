/* ============================================================
   Ricerca con caratteri jolly
   ============================================================
   L'utente scrive * e ?, come in una riga di comando.
   Postgres usa % e _ nell'operatore ILIKE: la traduzione avviene
   qui, in un posto solo, così catalogo e aggiunta al setup si
   comportano allo stesso modo.
   ============================================================ */

/**
 * Trasforma il testo digitato in un pattern ILIKE.
 * Restituisce null se non c'è niente da cercare.
 *
 *   "spot"      -> %spot%      contiene
 *   "*"         -> %           tutti
 *   "chauv*"    -> chauv%      inizia per
 *   "*260"      -> %260        finisce per
 *   "par ?4"    -> par _4      un carattere qualsiasi
 *   "mac*250*"  -> mac%250%    combinati
 */
export function pattern(testo) {
  const q = testo.trim()
  if (!q) return null

  // % _ e la virgola vanno tolti: i primi due sono i jolly veri di
  // SQL e passerebbero inosservati, la virgola spezzerebbe la sintassi
  // della or() di PostgREST
  const pulito = q.replace(/[%_,]/g, '')
  if (!pulito) return null

  const conJolly = /[*?]/.test(pulito)
  const tradotto = pulito.replace(/\*/g, '%').replace(/\?/g, '_')

  // senza jolly la ricerca è "contiene", che è ciò che ci si aspetta
  // digitando due parole a caso; con i jolly comanda l'utente
  return conJolly ? tradotto : `%${tradotto}%`
}

/**
 * Quando far partire la ricerca.
 * Con un jolly basta un carattere — "*" da solo deve funzionare —
 * altrimenti ne servono due, per non interrogare il database a ogni
 * lettera digitata.
 */
export function abbastanza(testo) {
  const q = testo.trim()
  return /[*?]/.test(q) ? q.length >= 1 : q.length >= 2
}
