import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'

/* ============================================================
   Proiezione
   ============================================================
   Assonometria isometrica: gli assi X e Y del pavimento vanno
   in diagonale, Z sale verticale sullo schermo.

   Il punto chiave — e il motivo per cui il trascinamento è
   vincolato al pavimento — è che questa proiezione non è
   invertibile da sola: un punto sullo schermo corrisponde a
   infiniti punti nello spazio. Fissando z, l'inversione esiste
   ed è quella scritta in `daSchermo`.
   ============================================================ */

const COS30 = Math.cos(Math.PI / 6)   // 0.866
const SIN30 = 0.5

function proietta(x, y, z, s, iso) {
  if (!iso) return { sx: x * s, sy: y * s }          // pianta dall'alto
  return {
    sx: (x - y) * COS30 * s,
    sy: (x + y) * SIN30 * s - z * s,
  }
}

function daSchermo(sx, sy, z, s, iso) {
  if (!iso) return { x: sx / s, y: sy / s }
  const diff = sx / (COS30 * s)          // x - y
  const somma = (sy + z * s) / (SIN30 * s) // x + y
  return { x: (somma + diff) / 2, y: (somma - diff) / 2 }
}

const MIN_PX = 13        // sotto questa dimensione il simbolo sparisce
const DEF_CM = 30        // ingombro presunto se non lo conosciamo

export default function Piantina({ setup, items, onAggiornato }) {
  const [iso, setIso] = useState(true)
  const [selId, setSelId] = useState(null)
  const [trascino, setTrascino] = useState(null)
  const svgRef = useRef(null)

  const L = Number(setup.sala_larghezza) || 12
  const P = Number(setup.sala_profondita) || 8
  const H = Number(setup.sala_altezza) || 4
  const misureMancanti = !setup.sala_larghezza || !setup.sala_profondita

  /* scala: quanti pixel per metro, perché la sala stia nel riquadro */
  const { scala, vb } = useMemo(() => {
    const larghezzaUtile = 860, altezzaUtile = 480, margine = 46

    const angoli = [[0,0,0],[L,0,0],[0,P,0],[L,P,0],[0,0,H],[L,0,H],[0,P,H],[L,P,H]]
    const proiettati = s => angoli.map(([x,y,z]) => proietta(x, y, z, s, iso))

    const p1 = proiettati(1)
    const larg = Math.max(...p1.map(p => p.sx)) - Math.min(...p1.map(p => p.sx))
    const alt  = Math.max(...p1.map(p => p.sy)) - Math.min(...p1.map(p => p.sy))

    const s = Math.min(
      (larghezzaUtile - margine * 2) / (larg || 1),
      (altezzaUtile - margine * 2) / (alt || 1)
    )

    const p = proiettati(s)
    const minX = Math.min(...p.map(q => q.sx)) - margine
    const minY = Math.min(...p.map(q => q.sy)) - margine

    return {
      scala: s,
      vb: `${minX} ${minY} ${larg * s + margine * 2} ${alt * s + margine * 2}`,
    }
  }, [L, P, H, iso])

  /* ordine di disegno: chi è più lontano si disegna prima, altrimenti
     gli apparecchi davanti finiscono coperti da quelli dietro */
  const ordinati = useMemo(
    () => [...items].sort((a, b) =>
      ((a.pos_x ?? 0) + (a.pos_y ?? 0)) - ((b.pos_x ?? 0) + (b.pos_y ?? 0))
    ),
    [items]
  )

  const selezionato = items.find(i => i.id === selId) ?? null

  /* ---- trascinamento ---- */
  function puntoSvg(e) {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }

  function iniziaTrascino(e, item) {
    e.stopPropagation()
    setSelId(item.id)
    const p = puntoSvg(e)
    const attuale = proietta(item.pos_x ?? 0, item.pos_y ?? 0, item.pos_z ?? 0, scala, iso)
    setTrascino({ id: item.id, dx: p.x - attuale.sx, dy: p.y - attuale.sy, z: item.pos_z ?? 0 })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function muovi(e) {
    if (!trascino) return
    const p = puntoSvg(e)
    const { x, y } = daSchermo(p.x - trascino.dx, p.y - trascino.dy, trascino.z, scala, iso)

    onAggiornato(trascino.id, {
      pos_x: Math.round(Math.max(0, Math.min(L, x)) * 20) / 20,   // passo 5 cm
      pos_y: Math.round(Math.max(0, Math.min(P, y)) * 20) / 20,
    }, false)
  }

  async function fineTrascino() {
    if (!trascino) return
    const it = items.find(i => i.id === trascino.id)
    setTrascino(null)
    if (it) {
      await supabase.from('setup_items')
        .update({ pos_x: it.pos_x, pos_y: it.pos_y })
        .eq('id', it.id)
    }
  }

  useEffect(() => {
    function esc(e) { if (e.key === 'Escape') setSelId(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  return (
    <div className="piantina">
      <div className="piantina-barra">
        <div className="viste-piccole">
          <button className="vista-mini" aria-selected={iso} onClick={() => setIso(true)}>
            Assonometria
          </button>
          <button className="vista-mini" aria-selected={!iso} onClick={() => setIso(false)}>
            Pianta
          </button>
        </div>
        <span className="conteggio">
          {L} × {P} × {H} m{misureMancanti && ' (misure non indicate: valori di comodo)'}
        </span>
      </div>

      <svg
        ref={svgRef}
        className="tela"
        viewBox={vb}
        onPointerMove={muovi}
        onPointerUp={fineTrascino}
        onPointerLeave={fineTrascino}
        onClick={() => setSelId(null)}
      >
        <Sala L={L} P={P} H={H} scala={scala} iso={iso} />

        {ordinati.map(i => (
          <Apparecchio
            key={i.id}
            item={i}
            scala={scala}
            iso={iso}
            scelto={i.id === selId}
            onGiu={e => iniziaTrascino(e, i)}
          />
        ))}
      </svg>

      {selezionato ? (
        <PannelloPosizione
          item={selezionato}
          L={L} P={P} H={H}
          onAggiornato={onAggiornato}
        />
      ) : (
        <p className="nota nota-fitta">
          Trascina un apparecchio per spostarlo sul pavimento. L'altezza si
          imposta selezionandolo, perché in assonometria trascinare in alto e
          spostare indietro sono lo stesso movimento.
        </p>
      )}
    </div>
  )
}

/* ============================================================
   La scatola della sala
   ============================================================ */
function Sala({ L, P, H, scala, iso }) {
  const p = (x, y, z) => {
    const q = proietta(x, y, z, scala, iso)
    return `${q.sx},${q.sy}`
  }

  const pavimento = [p(0,0,0), p(L,0,0), p(L,P,0), p(0,P,0)].join(' ')

  // griglia a passo di 1 m: dà la scala senza bisogno di quotare
  const linee = []
  for (let x = 1; x < L; x++) linee.push([p(x,0,0), p(x,P,0)])
  for (let y = 1; y < P; y++) linee.push([p(0,y,0), p(L,y,0)])

  return (
    <g>
      <polygon points={pavimento} className="pavimento" />

      {linee.map(([a, b], i) => (
        <line key={i}
          x1={a.split(',')[0]} y1={a.split(',')[1]}
          x2={b.split(',')[0]} y2={b.split(',')[1]}
          className="griglia-linea" />
      ))}

      <polygon points={pavimento} className="bordo-sala" />

      {/* montanti verticali e bordo alto: la "scatola" */}
      {iso && (
        <g className="montanti">
          {[[0,0],[L,0],[L,P],[0,P]].map(([x,y], i) => {
            const a = proietta(x, y, 0, scala, iso)
            const b = proietta(x, y, H, scala, iso)
            return <line key={i} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} />
          })}
          <polygon points={[p(0,0,H), p(L,0,H), p(L,P,H), p(0,P,H)].join(' ')} />
        </g>
      )}
    </g>
  )
}

/* ============================================================
   Un apparecchio
   ============================================================ */
function Apparecchio({ item, scala, iso, scelto, onGiu }) {
  const x = item.pos_x ?? 0
  const y = item.pos_y ?? 0
  const z = item.pos_z ?? 0

  const slug = item.fixtures?.categories?.slug
  const tinta = slug ? `var(--c-${slug}, var(--c-nessuna))` : 'var(--c-nessuna)'

  // ingombro reale, con una dimensione minima perché resti cliccabile
  const lm = (Number(item.fixtures?.larghezza_cm) || DEF_CM) / 100
  const pm = (Number(item.fixtures?.profondita_cm) || DEF_CM) / 100
  const w = Math.max(lm * scala, MIN_PX)
  const d = Math.max(pm * scala, MIN_PX)

  const c = proietta(x, y, z, scala, iso)
  const terra = proietta(x, y, 0, scala, iso)

  return (
    <g
      className={`apparecchio${scelto ? ' scelto' : ''}`}
      onPointerDown={onGiu}
      onClick={e => e.stopPropagation()}
      style={{ '--tinta': tinta }}
    >
      {/* filo verticale: senza, un apparecchio appeso sembra appoggiato */}
      {iso && z > 0.05 && (
        <>
          <line x1={terra.sx} y1={terra.sy} x2={c.sx} y2={c.sy} className="filo" />
          <ellipse cx={terra.sx} cy={terra.sy} rx={w / 3} ry={w / 6} className="ombra" />
        </>
      )}

      {iso ? (
        <g transform={`translate(${c.sx} ${c.sy})`}>
          {/* scatoletta: faccia superiore a rombo e due fianchi */}
          <polygon className="faccia-alta" points={[
            `0,${-(w + d) * SIN30 / 2}`,
            `${w * COS30},0`,
            `0,${(w + d) * SIN30 / 2}`,
            `${-d * COS30},0`,
          ].join(' ')} />
          <polygon className="faccia-sx" points={[
            `${-d * COS30},0`,
            `0,${(w + d) * SIN30 / 2}`,
            `0,${(w + d) * SIN30 / 2 + 9}`,
            `${-d * COS30},9`,
          ].join(' ')} />
          <polygon className="faccia-dx" points={[
            `0,${(w + d) * SIN30 / 2}`,
            `${w * COS30},0`,
            `${w * COS30},9`,
            `0,${(w + d) * SIN30 / 2 + 9}`,
          ].join(' ')} />
        </g>
      ) : (
        <rect
          x={c.sx - w / 2} y={c.sy - d / 2}
          width={w} height={d}
          rx={2}
          className="faccia-alta"
        />
      )}

      {scelto && (
        <text x={c.sx} y={c.sy - 20} className="etichetta-piantina">
          {item.etichetta || item.fixtures?.nome}
        </text>
      )}
    </g>
  )
}

/* ============================================================
   Pannello della selezione
   ============================================================ */
function PannelloPosizione({ item, L, P, H, onAggiornato }) {
  const z = item.pos_z ?? 0

  function set(campo, valore) {
    onAggiornato(item.id, { [campo]: valore }, true)
  }

  return (
    <div className="pannello-sel">
      <div className="sel-nome">
        <b>{item.etichetta || item.fixtures?.nome}</b>
        <em>{item.fixtures?.marca}</em>
      </div>

      <label className="campo-mini">
        <span>X (m)</span>
        <input type="number" step="0.1" min="0" max={L}
               value={item.pos_x ?? 0}
               onChange={e => set('pos_x', Number(e.target.value))} />
      </label>

      <label className="campo-mini">
        <span>Y (m)</span>
        <input type="number" step="0.1" min="0" max={P}
               value={item.pos_y ?? 0}
               onChange={e => set('pos_y', Number(e.target.value))} />
      </label>

      <label className="campo-mini larga">
        <span>Altezza {z.toFixed(1)} m</span>
        <input type="range" min="0" max={H} step="0.1"
               value={z}
               onChange={e => set('pos_z', Number(e.target.value))} />
      </label>
    </div>
  )
}
