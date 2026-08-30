import { useState } from 'react'
import { supabase } from './lib/supabase'
import { useSessione } from './useSessione'
import Accesso from './Accesso'
import Catalogo from './Catalogo'
import Setup from './Setup'

export default function App() {
  const { utente, pronta } = useSessione()
  const [mostraAccesso, setMostraAccesso] = useState(false)
  const [vista, setVista] = useState('catalogo')   // 'catalogo' | 'setup'

  return (
    <div className="guscio">
      <header className="testata">
        <h1 className="marchio">Visual<span>DJ</span> Setup</h1>

        <div className="utente">
          {!pronta ? null : utente ? (
            <>
              <span className="utente-email">{utente.email}</span>
              <button className="link" onClick={() => supabase.auth.signOut()}>
                Esci
              </button>
            </>
          ) : (
            <button className="link" onClick={() => setMostraAccesso(true)}>
              Accedi
            </button>
          )}
        </div>
      </header>

      <nav className="viste" role="tablist">
        <button
          role="tab"
          className="vista"
          aria-selected={vista === 'catalogo'}
          onClick={() => setVista('catalogo')}
        >
          Catalogo
        </button>
        <button
          role="tab"
          className="vista"
          aria-selected={vista === 'setup'}
          onClick={() => setVista('setup')}
        >
          I miei setup
        </button>
      </nav>

      {vista === 'catalogo' ? (
        <Catalogo utente={utente} onChiediAccesso={() => setMostraAccesso(true)} />
      ) : (
        <Setup utente={utente} onChiediAccesso={() => setMostraAccesso(true)} />
      )}

      {mostraAccesso && !utente && (
        <div
          className="velo"
          onClick={e => e.target === e.currentTarget && setMostraAccesso(false)}
        >
          <Accesso onChiudi={() => setMostraAccesso(false)} />
        </div>
      )}
    </div>
  )
}
