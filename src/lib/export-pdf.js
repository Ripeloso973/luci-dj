import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  canaliDi, perUniverso, perCircuito, totali,
  CANALI_UNIVERSO, AMPERE_LINEA,
} from './calcoli'

/**
 * Scheda tecnica del setup, pronta da stampare e portare in sala.
 *
 * Il documento è pensato per essere letto su carta con poca luce:
 * niente colori di sfondo tenui, corpo generoso, patch DMX ordinato
 * per universo e indirizzo — che è l'ordine in cui si lavora quando
 * si indirizzano gli apparecchi uno dopo l'altro.
 */
export function esportaPdf(setup, items) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const larghezza = doc.internal.pageSize.getWidth()
  const t = totali(items)

  // ---- intestazione ----
  doc.setFont('helvetica', 'bold').setFontSize(17)
  doc.text(setup.nome, 14, 18)

  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(110)
  const sala = setup.sala_larghezza && setup.sala_profondita
    ? `Sala ${setup.sala_larghezza} × ${setup.sala_profondita} m`
    : null
  const info = [setup.tipo_evento, sala, new Date().toLocaleDateString('it-IT')]
    .filter(Boolean).join('   ·   ')
  doc.text(info, 14, 24)

  doc.setDrawColor(210).line(14, 27, larghezza - 14, 27)

  // ---- totali ----
  doc.setTextColor(30).setFontSize(10)
  doc.text(
    `${t.pezzi} apparecchi   ·   ${t.canali} canali DMX` +
    (t.senzaDmx ? ` (${t.senzaDmx} senza DMX)` : '') +
    `   ·   ${Math.round(t.watt)} W   ·   ${t.peso.toFixed(1)} kg`,
    14, 34
  )

  // ---- patch DMX ----
  const righe = [...items]
    .sort((a, b) =>
      (a.dmx_universe ?? 1) - (b.dmx_universe ?? 1) ||
      (a.dmx_address ?? 999) - (b.dmx_address ?? 999)
    )
    .map(i => {
      const n = canaliDi(i)
      const da = i.dmx_address

      // "senza DMX" e "da assegnare" sono due cose diverse: la prima
      // è normale, la seconda è lavoro rimasto da fare
      const indirizzo = n === 0
        ? 'senza DMX'
        : da ? (n > 1 ? `${da}–${da + n - 1}` : String(da)) : 'DA ASSEGNARE'

      return [
        i.etichetta || '—',
        [i.fixtures?.marca, i.fixtures?.nome].filter(Boolean).join(' '),
        i.fixture_modes?.nome ?? '—',
        n === 0 ? '—' : String(i.dmx_universe ?? 1),
        indirizzo,
        n ? String(n) : '—',
        i.circuito || '—',
        i.fixtures?.watt ? `${i.fixtures.watt}` : '—',
      ]
    })

  autoTable(doc, {
    startY: 40,
    head: [['Etichetta', 'Apparecchio', 'Modalità', 'Univ.', 'Indirizzo', 'Ch', 'Circuito', 'W']],
    body: righe,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.9, lineColor: 215 },
    headStyles: { fillColor: [38, 38, 46], textColor: 255, fontSize: 8.5 },
    columnStyles: {
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 11 },
      7: { halign: 'right',  cellWidth: 13 },
    },
  })

  // ---- riepilogo universi ----
  let y = doc.lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30)
  doc.text('Occupazione DMX', 14, y)

  autoTable(doc, {
    startY: y + 3,
    head: [['Universo', 'Canali usati', 'Liberi', 'Apparecchi', '']],
    body: perUniverso(items).map(u => [
      String(u.universo),
      `${u.canali} / ${CANALI_UNIVERSO}`,
      String(Math.max(0, u.liberi)),
      String(u.pezzi),
      u.saturo ? 'OLTRE IL LIMITE' : '',
    ]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.9, lineColor: 215 },
    headStyles: { fillColor: [38, 38, 46], textColor: 255, fontSize: 8.5 },
    columnStyles: { 4: { textColor: [190, 40, 40], fontStyle: 'bold' } },
    tableWidth: 120,
  })

  // ---- riepilogo circuiti ----
  y = doc.lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30)
  doc.text('Carico per circuito', 14, y)

  autoTable(doc, {
    startY: y + 3,
    head: [['Circuito', 'Apparecchi', 'Watt', 'Ampere', '']],
    body: perCircuito(items).map(c => [
      c.circuito,
      String(c.pezzi),
      String(Math.round(c.watt)),
      c.ampere.toFixed(1),
      c.sopra ? `OLTRE ${AMPERE_LINEA} A` : '',
    ]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.9, lineColor: 215 },
    headStyles: { fillColor: [38, 38, 46], textColor: 255, fontSize: 8.5 },
    columnStyles: { 4: { textColor: [190, 40, 40], fontStyle: 'bold' } },
    tableWidth: 120,
  })

  // ---- avvertenza ----
  y = doc.lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'italic').setFontSize(7.5).setTextColor(130)
  doc.text(
    'Gli ampere sono una stima indicativa (watt / 230 V). Non tengono conto del fattore di potenza\n' +
    'né delle correnti di spunto e non sostituiscono il dimensionamento di un impianto elettrico.',
    14, y
  )

  const nomeFile = setup.nome.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  doc.save(`${nomeFile || 'setup'}.pdf`)
}
