import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

/**
 * Sessione corrente, sincronizzata con Supabase.
 *
 * `pronta` distingue "sto ancora controllando" da "non c'è nessuno
 * loggato": senza quella distinzione l'app mostra per un istante la
 * schermata di accesso a chi è già autenticato, a ogni ricaricamento.
 */
export function useSessione() {
  const [sessione, setSessione] = useState(null)
  const [pronta, setPronta] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessione(data.session)
      setPronta(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_evento, s) => setSessione(s)
    )

    return () => subscription.unsubscribe()
  }, [])

  return { sessione, utente: sessione?.user ?? null, pronta }
}
