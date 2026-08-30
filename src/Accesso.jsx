import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function Accesso({ onChiudi }) {
  const [modo, setModo] = useState('accedi')   // 'accedi' | 'registra'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState(null)
  const [avviso, setAvviso] = useState(null)
  const [inCorso, setInCorso] = useState(false)

  const registrazione = modo === 'registra'

  async function invia() {
    if (!email || !password) {
      setErrore('Inserisci email e password.')
      return
    }
    if (registrazione && password.length < 8) {
      setErrore('La password deve avere almeno 8 caratteri.')
      return
    }

    setInCorso(true)
    setErrore(null)
    setAvviso(null)

    const { data, error } = registrazione
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    setInCorso(false)

    if (error) {
      setErrore(traduci(error.message))
      return
    }

    // se la conferma via email è attiva, signUp riesce ma senza sessione
    if (registrazione && !data.session) {
      setAvviso('Account creato. Apri il link di conferma che trovi nella tua email, poi accedi.')
      return
    }

    onChiudi?.()
  }

  return (
    <div className="accesso">
      <h2 className="accesso-titolo">
        {registrazione ? 'Crea un account' : 'Accedi'}
      </h2>
      <p className="accesso-sotto">
        Serve per salvare i tuoi setup e condividerli. Il catalogo resta
        consultabile senza account.
      </p>

      <label className="campo">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && invia()}
        />
      </label>

      <label className="campo">
        <span>Password</span>
        <input
          type="password"
          autoComplete={registrazione ? 'new-password' : 'current-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && invia()}
        />
      </label>

      {errore && <p className="msg-errore">{errore}</p>}
      {avviso && <p className="msg-avviso">{avviso}</p>}

      <button className="bottone" onClick={invia} disabled={inCorso}>
        {inCorso ? 'Attendi…' : registrazione ? 'Crea account' : 'Accedi'}
      </button>

      <button
        className="link"
        onClick={() => {
          setModo(registrazione ? 'accedi' : 'registra')
          setErrore(null)
          setAvviso(null)
        }}
      >
        {registrazione
          ? 'Hai già un account? Accedi'
          : 'Non hai un account? Creane uno'}
      </button>
    </div>
  )
}

/* I messaggi di Supabase arrivano in inglese e sono tecnici.
   Qui diventano istruzioni su cosa fare, non diagnosi. */
function traduci(m = '') {
  const t = m.toLowerCase()
  if (t.includes('invalid login')) return 'Email o password non corretti.'
  if (t.includes('already registered')) return 'Questa email ha già un account. Prova ad accedere.'
  if (t.includes('email not confirmed')) return 'Conferma prima la tua email: trovi il link nella posta.'
  if (t.includes('rate limit') || t.includes('too many')) return 'Troppi tentativi. Riprova tra qualche minuto.'
  return m
}
