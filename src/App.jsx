import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

export default function App() {
  const [cat, setCat] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.from('categories').select('*').order('nome')
      .then(({ data, error }) => error ? setErr(error.message) : setCat(data))
  }, [])

  if (err) return <pre>ERRORE: {err}</pre>
  return (
    <div>
      <h1>Categorie: {cat.length}</h1>
      <ul>{cat.map(c => <li key={c.id}>{c.nome}</li>)}</ul>
    </div>
  )
}