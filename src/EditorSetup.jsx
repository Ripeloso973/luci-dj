import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { esportaPdf } from './lib/export-pdf'
import NuovoApparecchio from './NuovoApparecchio'
import Piantina from './Piantina'
import { pattern, abbastanza } from './lib/ricerca'
import {
  canaliDi, prossimoIndirizzo, conflitti, perUniverso, perCircuito, totali,
  CANALI_UNIVERSO, AMPERE_LINEA,
} from './lib/calcoli'

const SELECT_ITEM = `
  id, etichetta, dmx_universe, dmx_address, circuito, pos_x, pos_y, pos_z,
  fixtures ( id, nome, marca, watt, peso_kg, larghezza_cm, profondita_cm,
             categories ( slug ) ),
  fixture_modes ( id, nome, channel_count )
`

export default function EditorSetup({ setup, utente, onIndietro }) {
  const [items, setItems] = useState([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState(null)
  const [aggiungi, setAggiungi] = useState(false)
  const [scheda, setScheda] = useState('elenco')   // 'elenco' | 'piantina'

  async function carica() {
    setCaricando(true)
    const { data, error } = await supabase
      .from('setup_items')
      .select(SELECT_ITEM)
      .eq('setup_id', setup.id)
      .order('dmx_universe')
      .order('dmx_address')

    if (error) setErrore(error.message)
    else setItems(data)
    setCaricando(false)
  }

  useEffect(() => { carica() }, [setup.id])

  const t = useMemo(() => totali(items), [items])
  const universi = useMemo(() => perUniverso(items), [items])
  const circuiti = useMemo(() => perCircuito(items), [items])
  const inConflitto = useMemo(() => conflitti(items), [items])

  /**
   * `salva` a false aggiorna solo lo stato locale: serve durante il
   * trascinamento nella piantina, dove scrivere a ogni movimento del
   * dito significherebbe centinaia di chiamate. La scrittura avviene
   * quando si rilascia.
   */
  async function aggiorna(id, campi, salva = true) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...campi } : i)))
    if (!salva) return
    const { error } = await supabase.from('setup_items').update(campi).eq('id', id)
    if (error) { setErrore(error.message); carica() }
  }

  async function rimuovi(id) {
    await supabase.from('setup_items').delete().eq('id', id)
    carica()
  }

  return (
    <>
      <div className="barra-azioni">
        <button className="link" onClick={onIndietro}>← Tutti i setup</button>
        <h2 className="titolo-setup">{setup.nome}</h2>
        <div className="azioni-destra">
          <button className="bottone-piccolo" onClick={() => setAggiungi(true)}>
            Aggiungi apparecchi
          </button>
          <button
            className="bottone-fantasma"
            onClick={() => esportaPdf(setup, items)}
            disabled={!items.length}
          >
            Esporta PDF
          </button>
        </div>
      </div>

      {errore && (
        <div className="errore">
          <h2>Qualcosa non ha funzionato</h2>
          <p>Supabase ha restituito: <code>{errore}</code></p>
        </div>
      )}

      {/* riepiloghi */}
      <div className="pannelli">
        <div className="pannello">
          <span className="etichetta-blocco">Totali</span>
          <div className="numeroni">
            <div><b>{t.pezzi}</b><span>apparecchi</span></div>
            <div><b>{t.canali}</b><span>canali</span></div>
            <div><b>{Math.round(t.watt)}</b><span>watt</span></div>
            <div><b>{t.peso.toFixed(1)}</b><span>kg</span></div>
          </div>
        </div>

        <div className="pannello">
          <span className="etichetta-blocco">Universi DMX</span>
          {universi.length === 0 && <p className="nota">Nessun apparecchio.</p>}
          {universi.map(u => (
            <div key={u.universo} className="riga-misura">
              <span className="misura-nome">Universo {u.universo}</span>
              <div className="barra">
                <div
                  className={`barra-piena${u.saturo ? ' allarme' : ''}`}
                  style={{ width: `${Math.min(100, (u.canali / CANALI_UNIVERSO) * 100)}%` }}
                />
              </div>
              <span className={`misura-val${u.saturo ? ' allarme-testo' : ''}`}>
                {u.canali}/{CANALI_UNIVERSO}
              </span>
            </div>
          ))}
        </div>

        <div className="pannello">
          <span className="etichetta-blocco">Carico per circuito</span>
          {circuiti.length === 0 && <p className="nota">Nessun apparecchio.</p>}
          {circuiti.map(c => (
            <div key={c.circuito} className="riga-misura">
              <span className="misura-nome">{c.circuito}</span>
              <div className="barra">
                <div
                  className={`barra-piena${c.sopra ? ' allarme' : ''}`}
                  style={{ width: `${Math.min(100, (c.ampere / AMPERE_LINEA) * 100)}%` }}
                />
              </div>
              <span className={`misura-val${c.sopra ? ' allarme-testo' : ''}`}>
                {c.ampere.toFixed(1)} A
              </span>
            </div>
          ))}
          <p className="nota nota-fitta">
            Stima su 230 V. Non sostituisce il dimensionamento dell'impianto.
          </p>
        </div>
      </div>

      <div className="viste" style={{ marginTop: 18 }}>
        <button className="vista" aria-selected={scheda === 'elenco'}
                onClick={() => setScheda('elenco')}>Elenco</button>
        <button className="vista" aria-selected={scheda === 'piantina'}
                onClick={() => setScheda('piantina')}>Piantina</button>
      </div>

      {scheda === 'piantina' && !caricando && (
        <Piantina setup={setup} items={items} onAggiornato={aggiorna} />
      )}

      {/* elenco apparecchi */}
      {caricando && <div className="stato"><p>Carico gli apparecchi…</p></div>}

      {!caricando && items.length === 0 && scheda === 'elenco' && (
        <div className="stato">
          <h2>Setup vuoto</h2>
          <p>Aggiungi il primo apparecchio: l'indirizzo DMX viene assegnato da solo.</p>
        </div>
      )}

      {!caricando && items.length > 0 && scheda === 'elenco' && (
        <div className="tabella">
          <div className="tabella-testa">
            <span>Apparecchio</span>
            <span>Etichetta</span>
            <span>Univ.</span>
            <span>Indirizzo</span>
            <span>Ch</span>
            <span>Circuito</span>
            <span />
          </div>

          {items.map(i => {
            const n = canaliDi(i)
            const fine = i.dmx_address ? i.dmx_address + n - 1 : null
            const rotto = inConflitto.get(i.id) || (fine && fine > CANALI_UNIVERSO)

            return (
              <div key={i.id} className={`tabella-riga${rotto ? ' riga-allarme' : ''}`}>
                <span className="cella-nome">
                  <b>{i.fixtures?.nome}</b>
                  <em>
                    {i.fixtures?.marca}
                    {i.fixture_modes?.nome && ` · ${i.fixture_modes.nome}`}
                  </em>
                </span>

                <input
                  className="cella-input"
                  value={i.etichetta ?? ''}
                  placeholder="—"
                  onChange={e => aggiorna(i.id, { etichetta: e.target.value })}
                />

                {n > 0 ? (
                  <>
                    <input
                      className="cella-input stretta"
                      type="number" min="1"
                      value={i.dmx_universe ?? 1}
                      onChange={e => aggiorna(i.id, { dmx_universe: Number(e.target.value) })}
                    />
                    <input
                      className="cella-input stretta"
                      type="number" min="1" max={CANALI_UNIVERSO}
                      value={i.dmx_address ?? ''}
                      onChange={e => aggiorna(i.id, {
                        dmx_address: e.target.value ? Number(e.target.value) : null,
                      })}
                    />
                    <span className="cella-ch">
                      {n}
                      {fine && n > 1 && <em>→{fine}</em>}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="cella-vuota">—</span>
                    <span className="cella-vuota">no DMX</span>
                    <span className="cella-vuota">—</span>
                  </>
                )}

                <input
                  className="cella-input"
                  value={i.circuito ?? ''}
                  placeholder="L1"
                  onChange={e => aggiorna(i.id, { circuito: e.target.value })}
                />

                <button
                  className="link link-fine"
                  onClick={() => rimuovi(i.id)}
                  aria-label="Togli dal setup"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      {aggiungi && (
        <div
          className="velo"
          onClick={e => e.target === e.currentTarget && setAggiungi(false)}
        >
          <Aggiungi
            setup={setup}
            utente={utente}
            esistenti={items}
            onFatto={() => { setAggiungi(false); carica() }}
            onAnnulla={() => setAggiungi(false)}
          />
        </div>
      )}
    </>
  )
}

/* ============================================================
   Pannello di aggiunta
   ============================================================ */
function Aggiungi({ setup, utente, esistenti, onFatto, onAnnulla }) {
  const [creo, setCreo] = useState(false)
  const [categorie, setCategorie] = useState([])

  useEffect(() => {
    supabase.from('categories').select('id, nome, slug').order('nome')
      .then(({ data }) => setCategorie(data ?? []))
  }, [])

  const [testo, setTesto] = useState('')
  const [risultati, setRisultati] = useState([])
  const [cercando, setCercando] = useState(false)
  const [scelto, setScelto] = useState(null)
  const [modo, setModo] = useState(null)
  const [quantita, setQuantita] = useState(1)
  const [circuito, setCircuito] = useState('')
  const [universo, setUniverso] = useState(1)
  const [errore, setErrore] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  useEffect(() => {
    if (!abbastanza(testo)) { setRisultati([]); return }

    const p = pattern(testo)
    if (!p) { setRisultati([]); return }

    const t = setTimeout(async () => {
      setCercando(true)
      const { data } = await supabase
        .from('fixtures')
        .select('id, nome, marca, watt, fixture_modes ( id, nome, channel_count, is_default )')
        .is('deleted_at', null)
        .or(`setup_id.is.null,setup_id.eq.${setup.id}`)
        .or(`nome.ilike.${p},marca.ilike.${p},modello.ilike.${p}`)
        .order('marca')
        .order('nome')
        .limit(40)
      setRisultati(data ?? [])
      setCercando(false)
    }, 250)

    return () => clearTimeout(t)
  }, [testo])

  function seleziona(f) {
    const modi = [...(f.fixture_modes ?? [])].sort((a, b) => a.channel_count - b.channel_count)
    setScelto(f)
    setModo(modi.find(m => m.is_default) ?? modi[0] ?? null)
  }

  async function salva() {
    if (!scelto) { setErrore('Scegli un apparecchio.'); return }

    setInCorso(true)
    setErrore(null)

    // ogni unità è una riga con il suo indirizzo: si simula la lista
    // mentre si costruisce, così le assegnazioni non si sovrappongono
    const simulati = [...esistenti]
    const nuovi = []

    for (let k = 0; k < quantita; k++) {
      let addr = null

      // senza modalità non c'è niente da indirizzare: l'apparecchio
      // entra nel setup con universo e indirizzo vuoti
      if (modo) {
        const finto = {
          id: `tmp-${k}`,
          dmx_universe: universo,
          fixture_modes: { channel_count: modo.channel_count },
        }
        addr = prossimoIndirizzo(simulati, universo, modo.channel_count)
        finto.dmx_address = addr
        simulati.push(finto)
      }

      nuovi.push({
        setup_id: setup.id,
        fixture_id: scelto.id,
        mode_id: modo?.id ?? null,
        etichetta: quantita > 1 ? `${scelto.nome} ${k + 1}` : scelto.nome,
        dmx_universe: modo ? universo : null,
        dmx_address: addr,
        circuito: circuito.trim() || null,
        pos_x: 0, pos_y: 0, pos_z: 0,
      })
    }

    const senzaPosto = modo ? nuovi.filter(n => !n.dmx_address).length : 0

    const { error } = await supabase.from('setup_items').insert(nuovi)
    setInCorso(false)

    if (error) setErrore(error.message)
    else if (senzaPosto) {
      setErrore(
        `Aggiunti, ma ${senzaPosto} senza indirizzo: l'universo ${universo} è pieno. ` +
        `Spostali su un altro universo dalla tabella.`
      )
      onFatto()
    } else onFatto()
  }

  const modi = [...(scelto?.fixture_modes ?? [])].sort((a, b) => a.channel_count - b.channel_count)

  // creazione al volo: appena salvato, l'apparecchio viene selezionato
  // qui, così non devi ricercarlo a mano
  if (creo) {
    return (
      <NuovoApparecchio
        utente={utente}
        categorie={categorie}
        setupId={setup.id}
        onAnnulla={() => setCreo(false)}
        onFatto={async id => {
          setCreo(false)
          const { data } = await supabase
            .from('fixtures')
            .select('id, nome, marca, watt, fixture_modes ( id, nome, channel_count, is_default )')
            .eq('id', id)
            .single()
          if (data) { setTesto(data.nome); seleziona(data) }
        }}
      />
    )
  }

  return (
    <div className="accesso accesso-largo">
      <h2 className="accesso-titolo">Aggiungi apparecchi</h2>
      <p className="accesso-sotto">
        Ogni unità diventa una riga con il suo indirizzo, assegnato
        automaticamente nel primo spazio libero.
      </p>

      <label className="campo">
        <span>Cerca nel catalogo</span>
        <input
          value={testo}
          onChange={e => { setTesto(e.target.value); setScelto(null) }}
          placeholder="Marca o modello — usa * per i jolly"
          autoFocus
        />
        <p className="nota nota-fitta">
          <code>*</code> sostituisce un pezzo qualsiasi, <code>?</code> un
          solo carattere. Da solo, <code>*</code> mostra tutto il catalogo.
        </p>
      </label>

      {!scelto && cercando && risultati.length === 0 && (
        <p className="nota">Cerco…</p>
      )}

      {!scelto && !cercando && abbastanza(testo) && risultati.length === 0 && (
        <p className="nota">Nessun apparecchio corrisponde.</p>
      )}

      {!scelto && risultati.length > 0 && (
        <div className="risultati">
          {risultati.map(f => (
            <button key={f.id} className="risultato" onClick={() => seleziona(f)}>
              <b>{f.nome}</b>
              <em>{f.marca} · {f.fixture_modes?.length ?? 0} modalità</em>
            </button>
          ))}
          {risultati.length === 40 && (
            <p className="nota nota-tagliata">
              Primi 40 — restringi la ricerca per vedere il resto.
            </p>
          )}
        </div>
      )}

      {!scelto && (
        <p className="nota nota-crea">
          Non lo trovi?{' '}
          <button className="link" onClick={() => setCreo(true)}>
            Crea un apparecchio nuovo
          </button>
        </p>
      )}

      {scelto && (
        <>
          <div className="scelto">
            <div>
              <b>{scelto.nome}</b>
              <em>{scelto.marca}</em>
            </div>
            <button className="link" onClick={() => { setScelto(null); setModo(null) }}>
              cambia
            </button>
          </div>

          {modi.length > 0 ? (
            <label className="campo">
              <span>Modalità DMX</span>
              <select
                value={modo?.id ?? ''}
                onChange={e => setModo(modi.find(m => m.id === e.target.value))}
              >
                {modi.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.nome} — {m.channel_count} canali
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="msg-avviso">
              Questo apparecchio non ha modalità DMX. Entra comunque nel
              setup — senza indirizzo, e fuori dai conteggi dei canali.
              Continua a pesare sui carichi elettrici.
            </p>
          )}

          <div className={modi.length > 0 ? 'campi-riga' : 'campi-riga-2'}>
            <label className="campo">
              <span>Quantità</span>
              <input
                type="number" min="1" max="48"
                value={quantita}
                onChange={e => setQuantita(Math.max(1, Number(e.target.value)))}
              />
            </label>
            {modi.length > 0 && (
              <label className="campo">
                <span>Universo</span>
                <input
                  type="number" min="1"
                  value={universo}
                  onChange={e => setUniverso(Math.max(1, Number(e.target.value)))}
                />
              </label>
            )}
            <label className="campo">
              <span>Circuito</span>
              <input
                value={circuito}
                onChange={e => setCircuito(e.target.value)}
                placeholder="L1"
              />
            </label>
          </div>

          {modo && (
            <p className="nota">
              Occuperanno <b>{modo.channel_count * quantita}</b> canali
              nell'universo {universo}.
            </p>
          )}
        </>
      )}

      {errore && <p className="msg-errore">{errore}</p>}

      <button className="bottone" onClick={salva} disabled={inCorso || !scelto}>
        {inCorso ? 'Attendi…' : `Aggiungi ${quantita > 1 ? `${quantita} unità` : ''}`}
      </button>
      <button className="link" onClick={onAnnulla}>Annulla</button>
    </div>
  )
}
