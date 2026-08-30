import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import NuovoApparecchio from './NuovoApparecchio'
import { pattern } from './lib/ricerca'

const PER_PAGINA = 60

export default function Catalogo({ utente, onChiediAccesso }) {
  const [nuovo, setNuovo] = useState(false)
  const [ricarica, setRicarica] = useState(0)
  const [soloMiei, setSoloMiei] = useState(false)
  const [categorie, setCategorie] = useState([])
  const [catAttiva, setCatAttiva] = useState(null)
  const [testo, setTesto] = useState('')
  const [cercato, setCercato] = useState('')   // testo dopo il debounce

  const [apparecchi, setApparecchi] = useState([])
  const [totale, setTotale] = useState(0)
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState(null)

  // le categorie non cambiano: si caricano una volta sola
  useEffect(() => {
    supabase
      .from('categories')
      .select('id, nome, slug')
      .order('nome')
      .then(({ data, error }) => {
        if (error) setErrore(error.message)
        else setCategorie(data)
      })
  }, [])

  // debounce: evita una query per ogni tasto premuto
  useEffect(() => {
    const t = setTimeout(() => setCercato(testo.trim()), 250)
    return () => clearTimeout(t)
  }, [testo])

  useEffect(() => {
    let annullato = false
    setCaricando(true)
    setErrore(null)

    let q = supabase
      .from('fixtures')
      .select(
        `id, nome, marca, watt, peso_kg, owner_id, thumbnail_url,
         categories ( nome, slug ),
         fixture_modes ( nome, channel_count, is_default )`,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .is('setup_id', null)          // gli apparecchi locali a un setup restano lì
      .order('marca')
      .order('nome')
      .limit(PER_PAGINA)

    if (catAttiva) q = q.eq('category_id', catAttiva)
    if (soloMiei && utente) q = q.eq('owner_id', utente.id)
    if (cercato) {
      const p = pattern(cercato)
      if (p) q = q.or(`nome.ilike.${p},marca.ilike.${p},modello.ilike.${p}`)
    }

    q.then(({ data, error, count }) => {
      if (annullato) return
      if (error) setErrore(error.message)
      else {
        setApparecchi(data)
        setTotale(count ?? 0)
      }
      setCaricando(false)
    })

    return () => { annullato = true }
  }, [catAttiva, cercato, soloMiei, utente, ricarica])

  const filtrato = catAttiva || cercato || soloMiei

  return (
    <>
      <div className="barra-azioni">
        {utente ? (
          <button className="bottone-piccolo" onClick={() => setNuovo(true)}>
            Aggiungi apparecchio
          </button>
        ) : (
          <button className="link" onClick={onChiediAccesso}>
            Accedi per aggiungere i tuoi apparecchi
          </button>
        )}
        <span className="conteggio">
          {caricando ? '···' : `${totale} apparecchi`}
          {totale > PER_PAGINA && ` · primi ${PER_PAGINA}`}
        </span>
      </div>

      <div className="filtri">
        <input
          className="cerca"
          type="search"
          value={testo}
          onChange={e => setTesto(e.target.value)}
          placeholder="Cerca per marca o modello — * per i jolly"
          aria-label="Cerca apparecchi"
        />

        <div className="categorie" role="group" aria-label="Filtra per categoria">
          <button
            className="chip"
            aria-pressed={catAttiva === null}
            onClick={() => setCatAttiva(null)}
          >
            Tutte
          </button>
          {utente && (
            <button
              className="chip"
              aria-pressed={soloMiei}
              onClick={() => setSoloMiei(!soloMiei)}
            >
              Solo i miei
            </button>
          )}
          {categorie.map(c => (
            <button
              key={c.id}
              className="chip"
              aria-pressed={catAttiva === c.id}
              style={{ '--tinta': tinta(c.slug) }}
              onClick={() => setCatAttiva(catAttiva === c.id ? null : c.id)}
            >
              <span className="pallino" />
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {errore && (
        <div className="errore">
          <h2>Il catalogo non risponde</h2>
          <p>Supabase ha restituito: <code>{errore}</code></p>
        </div>
      )}

      {caricando && !errore && (
        <div className="griglia">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="fantasma" />
          ))}
        </div>
      )}

      {!caricando && !errore && apparecchi.length === 0 && (
        <div className="stato">
          <h2>Nessun apparecchio</h2>
          <p>
            {filtrato
              ? 'Prova con un altro termine o togli il filtro di categoria.'
              : 'Il catalogo è vuoto: lancia lo script di importazione.'}
          </p>
        </div>
      )}

      {!caricando && !errore && apparecchi.length > 0 && (
        <div className="griglia">
          {apparecchi.map(a => (
            <Scheda
              key={a.id}
              a={a}
              mio={!!utente && a.owner_id === utente.id}
              onCambiato={() => setRicarica(r => r + 1)}
            />
          ))}
        </div>
      )}

      {nuovo && utente && (
        <div
          className="velo"
          onClick={e => e.target === e.currentTarget && setNuovo(false)}
        >
          <NuovoApparecchio
            utente={utente}
            categorie={categorie}
            onFatto={() => { setNuovo(false); setRicarica(r => r + 1) }}
            onAnnulla={() => setNuovo(false)}
          />
        </div>
      )}
    </>
  )
}

function Scheda({ a, mio, onCambiato }) {
  const slug = a.categories?.slug
  const modi = useMemo(
    () => [...(a.fixture_modes ?? [])].sort((x, y) => x.channel_count - y.channel_count),
    [a.fixture_modes]
  )
  const principale = modi.find(m => m.is_default) ?? modi[0]
  const altri = modi.filter(m => m !== principale)

  return (
    <article className="scheda" style={{ '--tinta': tinta(slug) }}>
      {a.thumbnail_url && (
        <img className="foto" src={a.thumbnail_url} alt="" loading="lazy" />
      )}
      <div className="marca">
        {a.marca ?? '—'}
        {mio && <span className="targhetta">mio</span>}
      </div>
      <h2 className="nome">{a.nome}</h2>

      <div className="dati">
        <span>{a.watt ? <><b>{a.watt}</b> W</> : <span>— W</span>}</span>
        <span>{a.peso_kg ? <><b>{a.peso_kg}</b> kg</> : <span>— kg</span>}</span>
      </div>

      {principale ? (
        <>
          <StrisciaCanali n={principale.channel_count} />
          <div className="riga-modo">
            <span>{principale.nome}</span>
            <span><b>{principale.channel_count}</b> canali</span>
          </div>
        </>
      ) : (
        <>
          <div className="patch-vuoto" />
          <div className="riga-modo"><span>Nessuna modalità DMX</span></div>
        </>
      )}

      {(altri.length > 0 || mio) && (
        <div className="altri-modi">
          {altri.map(m => (
            <span key={m.nome} className="tag-modo">{m.channel_count} ch</span>
          ))}
          {mio && (
            <button
              className="link link-fine"
              onClick={async () => {
                await supabase.from('fixtures')
                  .update({ deleted_at: new Date().toISOString() })
                  .eq('id', a.id)
                onCambiato()
              }}
            >
              Elimina
            </button>
          )}
        </div>
      )}
    </article>
  )
}

/* Un segmento per canale, come nel patch di una console.
   Oltre i 32 canali i segmenti diventerebbero invisibili:
   sopra quella soglia la barra diventa piena e il numero
   accanto porta l'informazione. */
function StrisciaCanali({ n }) {
  if (n > 32) return <div className="patch"><span className="canale" /></div>
  return (
    <div className="patch" aria-label={`${n} canali DMX`}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="canale" />
      ))}
    </div>
  )
}

function tinta(slug) {
  return slug ? `var(--c-${slug}, var(--c-nessuna))` : 'var(--c-nessuna)'
}
