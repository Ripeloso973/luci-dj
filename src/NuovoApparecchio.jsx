import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { caricaFoto } from './lib/immagini'
import { campiPer } from './lib/specifiche'

/**
 * Creazione di un apparecchio.
 *
 * Due destinazioni possibili:
 *  - catalogo personale (setup_id null): riusabile in ogni setup
 *  - solo questo setup (setup_id valorizzato): il pezzo a nolo o su
 *    misura, che non ha senso catalogare
 *
 * `setupId` arriva solo quando il form è aperto dall'editor di un
 * setup; dal catalogo la scelta non compare.
 */
export default function NuovoApparecchio({
  utente, categorie, setupId = null, onFatto, onAnnulla,
}) {
  const [nome, setNome] = useState('')
  const [marca, setMarca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [watt, setWatt] = useState('')
  const [peso, setPeso] = useState('')
  const [largCm, setLargCm] = useState('')
  const [profCm, setProfCm] = useState('')
  const [modi, setModi] = useState([{ nome: '', canali: '' }])
  const [foto, setFoto] = useState(null)
  const [anteprima, setAnteprima] = useState(null)
  const [spec, setSpec] = useState({})
  const [soloQui, setSoloQui] = useState(!!setupId)
  const [errore, setErrore] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  const slug = categorie.find(c => c.id === categoria)?.slug
  const campi = useMemo(() => campiPer(slug), [slug])

  // cambiando categoria, le specifiche della precedente non hanno più senso
  useEffect(() => { setSpec({}) }, [categoria])

  function aggiornaModo(i, campo, valore) {
    setModi(modi.map((m, j) => (j === i ? { ...m, [campo]: valore } : m)))
  }

  async function salva() {
    if (!nome.trim()) { setErrore('Serve almeno il modello.'); return }

    const validi = modi
      .filter(m => m.canali)
      .map(m => ({
        nome: m.nome.trim() || `${m.canali} canali`,
        channel_count: Number(m.canali),
      }))

    if (validi.some(m => m.channel_count < 1 || m.channel_count > 512)) {
      setErrore('I canali di una modalità devono stare tra 1 e 512.')
      return
    }
    if (new Set(validi.map(m => m.nome)).size !== validi.length) {
      setErrore('Due modalità hanno lo stesso nome.')
      return
    }

    setInCorso(true)
    setErrore(null)

    // solo le specifiche compilate, senza chiavi vuote
    const pulite = Object.fromEntries(
      Object.entries(spec).filter(([, v]) => v !== '' && v != null)
    )

    const { data: fix, error } = await supabase
      .from('fixtures')
      .insert({
        nome: nome.trim(),
        marca: marca.trim() || null,
        modello: nome.trim(),
        category_id: categoria || null,
        watt: watt ? Number(watt) : null,
        peso_kg: peso ? Number(peso) : null,
        larghezza_cm: largCm ? Number(largCm) : null,
        profondita_cm: profCm ? Number(profCm) : null,
        specifiche: pulite,
        setup_id: soloQui ? setupId : null,
        owner_id: utente.id,       // richiesto dalla policy di inserimento
      })
      .select('id')
      .single()

    if (error) { setInCorso(false); setErrore(error.message); return }

    if (validi.length) {
      const { error: e2 } = await supabase.from('fixture_modes').insert(
        validi.map((m, i) => ({ ...m, fixture_id: fix.id, is_default: i === 0 }))
      )
      if (e2) { setInCorso(false); setErrore(e2.message); return }
    }

    // la foto si carica dopo: serve l'id dell'apparecchio per il percorso.
    // Se fallisce, l'apparecchio resta salvato senza immagine: meglio
    // perdere la foto che perdere i dati DMX appena inseriti.
    if (foto) {
      try {
        const url = await caricaFoto(foto, utente.id, fix.id)
        await supabase.from('fixtures').update({ thumbnail_url: url }).eq('id', fix.id)
      } catch (e) {
        setInCorso(false)
        setErrore(`Apparecchio salvato, ma la foto non è stata caricata: ${e.message}`)
        onFatto(fix.id)
        return
      }
    }

    setInCorso(false)
    onFatto(fix.id)
  }

  return (
    <div className="accesso accesso-largo">
      <h2 className="accesso-titolo">Aggiungi un apparecchio</h2>
      <p className="accesso-sotto">
        Resta visibile solo a te. Usalo per quello che non trovi nel
        catalogo o per i tuoi apparecchi su misura.
      </p>

      {setupId && (
        <div className="scelta-destinazione">
          <button className="opzione" aria-pressed={soloQui}
                  onClick={() => setSoloQui(true)}>
            <b>Solo per questo setup</b>
            <em>Non finisce nel catalogo. Per il pezzo a nolo o irripetibile.</em>
          </button>
          <button className="opzione" aria-pressed={!soloQui}
                  onClick={() => setSoloQui(false)}>
            <b>Aggiungi al catalogo</b>
            <em>Riusabile in tutti i tuoi setup futuri.</em>
          </button>
        </div>
      )}

      <div className="campi-riga-2">
        <label className="campo">
          <span>Marca</span>
          <input value={marca} onChange={e => setMarca(e.target.value)}
                 placeholder="Chauvet" />
        </label>
        <label className="campo">
          <span>Modello</span>
          <input value={nome} onChange={e => setNome(e.target.value)}
                 placeholder="Intimidator Spot 260" />
        </label>
      </div>

      <label className="campo">
        <span>Categoria</span>
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Nessuna</option>
          {categorie.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
      </label>

      <div className="campi-riga-2">
        <label className="campo">
          <span>Watt</span>
          <input type="number" min="0" value={watt}
                 onChange={e => setWatt(e.target.value)} />
        </label>
        <label className="campo">
          <span>Peso kg</span>
          <input type="number" min="0" step="0.1" value={peso}
                 onChange={e => setPeso(e.target.value)} />
        </label>
      </div>

      <div className="campi-riga-2">
        <label className="campo">
          <span>Larghezza cm</span>
          <input type="number" min="0" step="0.5" value={largCm}
                 onChange={e => setLargCm(e.target.value)} />
        </label>
        <label className="campo">
          <span>Profondità cm</span>
          <input type="number" min="0" step="0.5" value={profCm}
                 onChange={e => setProfCm(e.target.value)} />
        </label>
      </div>

      <p className="nota nota-fitta">
        Le misure servono a disegnare l'apparecchio in scala nella
        piantina. Se le lasci vuote viene usato un ingombro di 30 cm.
      </p>

      <label className="campo">
        <span>Foto</span>
        <div className="carica-foto">
          {anteprima
            ? <img src={anteprima} alt="" className="anteprima" />
            : <div className="anteprima vuota">nessuna</div>}
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                setFoto(f)
                setAnteprima(URL.createObjectURL(f))
              }}
            />
            <p className="nota nota-fitta">
              Viene ridotta a 700 px prima di essere caricata.
            </p>
          </div>
        </div>
      </label>

      <div className="blocco-modi">
        <span className="etichetta-blocco">Modalità DMX — facoltative</span>
        <p className="nota">
          Il numero di canali che l'apparecchio occupa. Se ne ha più di una,
          aggiungile tutte: i calcoli di indirizzamento partono da qui.
          Lascia vuoto per truss, stativi, macchine a telecomando e tutto
          ciò che non si indirizza.
        </p>

        {modi.map((m, i) => (
          <div key={i} className="riga-modo-form">
            <input
              placeholder="Nome (es. Base)"
              value={m.nome}
              onChange={e => aggiornaModo(i, 'nome', e.target.value)}
            />
            <input
              type="number" min="1" max="512"
              placeholder="canali"
              value={m.canali}
              onChange={e => aggiornaModo(i, 'canali', e.target.value)}
            />
            {modi.length > 1 && (
              <button
                className="link"
                onClick={() => setModi(modi.filter((_, j) => j !== i))}
                aria-label="Togli modalità"
              >
                ×
              </button>
            )}
          </div>
        ))}

        <button
          className="link"
          onClick={() => setModi([...modi, { nome: '', canali: '' }])}
        >
          Aggiungi modalità
        </button>
      </div>

      {campi.length > 0 && (
        <div className="blocco-modi">
          <span className="etichetta-blocco">Caratteristiche</span>
          <p className="nota">
            Facoltative e diverse per ogni categoria. Sono descrittive:
            non entrano nei calcoli, servono a riconoscere l'apparecchio
            e a scegliere in fase di progetto.
          </p>

          <div className="griglia-spec">
            {campi.map(c => (
              <label key={c.chiave} className="campo">
                <span>{c.etichetta}{c.unita ? ` (${c.unita})` : ''}</span>
                {c.tipo === 'scelta' ? (
                  <select
                    value={spec[c.chiave] ?? ''}
                    onChange={e => setSpec({ ...spec, [c.chiave]: e.target.value })}
                  >
                    <option value="">—</option>
                    {c.opzioni.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={c.tipo === 'numero' ? 'number' : 'text'}
                    min={c.tipo === 'numero' ? '0' : undefined}
                    placeholder={c.segnaposto}
                    value={spec[c.chiave] ?? ''}
                    onChange={e => setSpec({ ...spec, [c.chiave]: e.target.value })}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {!categoria && (
        <p className="nota">
          Scegli una categoria per vedere le caratteristiche specifiche:
          pan e tilt per le teste mobili, classe di sicurezza per i laser,
          portata per le macchine del fumo.
        </p>
      )}

      {errore && <p className="msg-errore">{errore}</p>}

      <button className="bottone" onClick={salva} disabled={inCorso}>
        {inCorso ? 'Attendi…' : 'Salva apparecchio'}
      </button>
      <button className="link" onClick={onAnnulla}>Annulla</button>
    </div>
  )
}
