import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import EditorSetup from './EditorSetup'

const TIPI = ['Matrimonio', 'Club', 'Live', 'Corporate', 'Festa privata', 'Sagra', 'Altro']

export default function Setup({ utente, onChiediAccesso }) {
  const [setups, setSetups] = useState([])
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState(null)
  const [nuovo, setNuovo] = useState(false)
  const [cestino, setCestino] = useState(false)
  const [aperto, setAperto] = useState(null)

  async function carica() {
    setCaricando(true)
    const { data, error } = await supabase
      .from('setups')
      .select(`id, nome, tipo_evento, sala_larghezza, sala_profondita,
               visibility, created_at, deleted_at,
               setup_items ( count )`)
      .order('created_at', { ascending: false })

    if (error) setErrore(error.message)
    else setSetups(data)
    setCaricando(false)
  }

  useEffect(() => { if (utente) carica() }, [utente])

  if (aperto) {
    return (
      <EditorSetup
        setup={aperto}
        utente={utente}
        onIndietro={() => { setAperto(null); carica() }}
      />
    )
  }

  if (!utente) {
    return (
      <div className="stato">
        <h2>I setup sono legati al tuo account</h2>
        <p>
          Accedi per crearli, salvarli e condividerli.{' '}
          <button className="link" onClick={onChiediAccesso}>Accedi ora</button>
        </p>
      </div>
    )
  }

  const visibili = setups.filter(s => (cestino ? s.deleted_at : !s.deleted_at))
  const nCestino = setups.filter(s => s.deleted_at).length

  return (
    <>
      <div className="barra-azioni">
        <button className="bottone-piccolo" onClick={() => setNuovo(true)}>
          Nuovo setup
        </button>
        {nCestino > 0 && (
          <button className="link" onClick={() => setCestino(!cestino)}>
            {cestino ? 'Torna ai setup attivi' : `Cestino (${nCestino})`}
          </button>
        )}
      </div>

      {errore && (
        <div className="errore">
          <h2>I setup non si caricano</h2>
          <p>Supabase ha restituito: <code>{errore}</code></p>
        </div>
      )}

      {caricando && (
        <div className="griglia">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="fantasma" />)}
        </div>
      )}

      {!caricando && visibili.length === 0 && (
        <div className="stato">
          <h2>{cestino ? 'Il cestino è vuoto' : 'Nessun setup'}</h2>
          <p>
            {cestino
              ? 'Qui finiscono i setup che elimini, finché non li ripristini.'
              : 'Crea il primo: dagli un nome e le misure della sala, gli apparecchi si aggiungono dopo.'}
          </p>
        </div>
      )}

      {!caricando && visibili.length > 0 && (
        <div className="griglia">
          {visibili.map(s => (
            <SchedaSetup key={s.id} s={s} onCambiato={carica} onApri={() => setAperto(s)} />
          ))}
        </div>
      )}

      {nuovo && (
        <div
          className="velo"
          onClick={e => e.target === e.currentTarget && setNuovo(false)}
        >
          <NuovoSetup
            utente={utente}
            onFatto={() => { setNuovo(false); carica() }}
            onAnnulla={() => setNuovo(false)}
          />
        </div>
      )}
    </>
  )
}

function SchedaSetup({ s, onCambiato, onApri }) {
  const nPezzi = s.setup_items?.[0]?.count ?? 0
  const sala = s.sala_larghezza && s.sala_profondita
    ? `${s.sala_larghezza} × ${s.sala_profondita} m`
    : null

  async function cestina() {
    await supabase.from('setups')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', s.id)
    onCambiato()
  }

  async function ripristina() {
    await supabase.from('setups').update({ deleted_at: null }).eq('id', s.id)
    onCambiato()
  }

  return (
    <article className="scheda scheda-setup">
      <div className="marca">
        {s.tipo_evento ?? 'Setup'}
        {s.visibility !== 'private' && ' · condiviso'}
      </div>
      <h2 className="nome">
        {s.deleted_at
          ? s.nome
          : <button className="titolo-link" onClick={onApri}>{s.nome}</button>}
      </h2>

      <div className="dati">
        <span><b>{nPezzi}</b> {nPezzi === 1 ? 'apparecchio' : 'apparecchi'}</span>
        {sala && <span>{sala}</span>}
      </div>

      <div className="riga-modo">
        <span>{new Date(s.created_at).toLocaleDateString('it-IT')}</span>
        {s.deleted_at ? (
          <button className="link" onClick={ripristina}>Ripristina</button>
        ) : (
          <button className="link" onClick={cestina}>Elimina</button>
        )}
      </div>
    </article>
  )
}

function NuovoSetup({ utente, onFatto, onAnnulla }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('')
  const [largh, setLargh] = useState('')
  const [prof, setProf] = useState('')
  const [alt, setAlt] = useState('')
  const [errore, setErrore] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  async function salva() {
    if (!nome.trim()) { setErrore('Dai un nome al setup.'); return }
    setInCorso(true)
    setErrore(null)

    const { error } = await supabase.from('setups').insert({
      nome: nome.trim(),
      tipo_evento: tipo || null,
      sala_larghezza: largh ? Number(largh) : null,
      sala_profondita: prof ? Number(prof) : null,
      sala_altezza: alt ? Number(alt) : null,
      author_id: utente.id,          // richiesto dalla policy di inserimento
    })

    setInCorso(false)
    if (error) setErrore(error.message)
    else onFatto()
  }

  return (
    <div className="accesso">
      <h2 className="accesso-titolo">Nuovo setup</h2>
      <p className="accesso-sotto">
        Le misure della sala servono ai calcoli e alla piantina. Puoi
        lasciarle vuote e compilarle più avanti.
      </p>

      <label className="campo">
        <span>Nome</span>
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Sagra di Rosà — piazza"
          onKeyDown={e => e.key === 'Enter' && salva()}
        />
      </label>

      <label className="campo">
        <span>Tipo di evento</span>
        <select value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="">Non specificato</option>
          {TIPI.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <div className="campi-riga">
        <label className="campo">
          <span>Largh. m</span>
          <input type="number" min="0" step="0.5" value={largh}
                 onChange={e => setLargh(e.target.value)} />
        </label>
        <label className="campo">
          <span>Prof. m</span>
          <input type="number" min="0" step="0.5" value={prof}
                 onChange={e => setProf(e.target.value)} />
        </label>
        <label className="campo">
          <span>Alt. m</span>
          <input type="number" min="0" step="0.5" value={alt}
                 onChange={e => setAlt(e.target.value)} />
        </label>
      </div>

      {errore && <p className="msg-errore">{errore}</p>}

      <button className="bottone" onClick={salva} disabled={inCorso}>
        {inCorso ? 'Attendi…' : 'Crea setup'}
      </button>
      <button className="link" onClick={onAnnulla}>Annulla</button>
    </div>
  )
}
