"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, CheckSquare, Pencil, Plus, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Todo = {
  id: string
  title: string
  description: string | null
  priority: "high" | "medium" | "low"
  due_date: string | null
  completed: boolean
}

type Form = { title: string; description: string; priority: Todo["priority"]; due_date: string }
const emptyForm: Form = { title: "", description: "", priority: "medium", due_date: "" }

export default function OwnerTodoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<"open" | "today" | "overdue" | "done">("open")
  const [form, setForm] = useState<Form>(emptyForm)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadTodos() {
    const { data } = await supabase.from("owner_todos").select("id,title,description,priority,due_date,completed").order("completed", { ascending: true }).order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    setTodos((data ?? []) as Todo[])
  }

  useEffect(() => { loadTodos() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const visible = todos.filter((todo) => {
    if (filter === "done") return todo.completed
    if (todo.completed) return false
    if (filter === "today") return todo.due_date === today
    if (filter === "overdue") return !!todo.due_date && todo.due_date < today
    return true
  })

  function openCreate() { setEditing(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(todo: Todo) { setEditing(todo); setForm({ title: todo.title, description: todo.description ?? "", priority: todo.priority, due_date: todo.due_date ?? "" }); setShowForm(true) }

  async function saveTodo(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const payload = { title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, due_date: form.due_date || null }
    const result = editing
      ? await supabase.from("owner_todos").update(payload).eq("id", editing.id)
      : await supabase.auth.getUser().then(({ data: { user } }) => user ? supabase.from("owner_todos").insert({ ...payload, created_by: user.id }) : { error: new Error("Nicht angemeldet") })
    setSaving(false)
    if (result.error) { alert(result.error.message); return }
    setShowForm(false)
    await loadTodos()
  }

  async function toggle(todo: Todo) {
    await supabase.from("owner_todos").update({ completed: !todo.completed, completed_at: !todo.completed ? new Date().toISOString() : null }).eq("id", todo.id)
    await loadTodos()
  }

  async function remove(todo: Todo) {
    if (!confirm(`Aufgabe „${todo.title}“ löschen?`)) return
    await supabase.from("owner_todos").delete().eq("id", todo.id)
    await loadTodos()
  }

  const openCount = todos.filter((t) => !t.completed).length
  const overdueCount = todos.filter((t) => !t.completed && t.due_date && t.due_date < today).length

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/besitzer" className="flex items-center gap-2 border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider hover:bg-secondary"><ArrowLeft className="h-4 w-4" /> Zurück</Link>
          <div className="text-right"><p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Gemeinsame Verwaltung</p><h1 className="font-display text-xl font-bold uppercase tracking-wide">To-do</h1></div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Alle Besitzer sehen dieselbe Liste</p><h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">Aufgaben</h2><p className="mt-2 text-sm text-muted-foreground">{openCount} offen{overdueCount > 0 ? ` · ${overdueCount} überfällig` : ""}</p></div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Aufgabe</button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {[['open','Offen'],['today','Heute'],['overdue','Überfällig'],['done','Erledigt']].map(([key,label]) => <button key={key} onClick={() => setFilter(key as typeof filter)} className={`border px-4 py-2 font-display text-xs uppercase tracking-widest ${filter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-secondary'}`}>{label}</button>)}
        </div>

        <div className="space-y-3">
          {visible.length === 0 ? <div className="border border-border bg-card px-6 py-14 text-center"><CheckSquare className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-4 font-display text-lg font-bold uppercase tracking-wide">Keine Aufgaben</p><p className="mt-2 text-sm text-muted-foreground">In diesem Bereich ist aktuell nichts zu erledigen.</p></div> : visible.map((todo) => {
            const overdue = !todo.completed && !!todo.due_date && todo.due_date < today
            return <div key={todo.id} className="flex gap-3 border border-border bg-card p-4 sm:items-center sm:p-5">
              <button onClick={() => toggle(todo)} aria-label={todo.completed ? "Als offen markieren" : "Als erledigt markieren"} className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center border ${todo.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary'}`}>{todo.completed && <Check className="h-4 w-4" />}</button>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`font-medium ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>{todo.title}</h3><span className="border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider">{todo.priority === 'high' ? 'Hoch' : todo.priority === 'low' ? 'Niedrig' : 'Mittel'}</span></div>{todo.description && <p className="mt-1 text-sm text-muted-foreground">{todo.description}</p>}{todo.due_date && <p className={`mt-2 text-xs uppercase tracking-wider ${overdue ? 'text-[var(--bad)]' : 'text-muted-foreground'}`}>{overdue ? 'Überfällig · ' : 'Fällig · '}{new Date(`${todo.due_date}T00:00:00`).toLocaleDateString('de-CH')}</p>}</div>
              <div className="flex shrink-0 gap-1"><button onClick={() => openEdit(todo)} className="border border-border p-2 hover:bg-secondary" aria-label="Bearbeiten"><Pencil className="h-4 w-4" /></button><button onClick={() => remove(todo)} className="border border-border p-2 hover:bg-secondary" aria-label="Löschen"><Trash2 className="h-4 w-4" /></button></div>
            </div>
          })}
        </div>

        {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}><form onSubmit={saveTodo} className="w-full max-w-lg border border-border bg-background p-6 shadow-xl sm:p-7"><div className="mb-6 flex items-center justify-between"><div><p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Gemeinsame Aufgabe</p><h2 className="mt-1 font-display text-xl font-bold uppercase">{editing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h2></div><button type="button" onClick={() => setShowForm(false)} className="border border-border p-2 hover:bg-secondary"><X className="h-4 w-4" /></button></div><div className="space-y-4"><label className="block"><span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Aufgabe *</span><input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-border bg-card px-3 py-3 outline-none focus:border-primary" placeholder="z. B. Rechnung prüfen" required /></label><label className="block"><span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Beschreibung</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-24 w-full border border-border bg-card px-3 py-3 outline-none focus:border-primary" placeholder="Notiz zur Aufgabe..." /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Priorität</span><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Todo['priority'] })} className="w-full border border-border bg-card px-3 py-3"><option value="high">Hoch</option><option value="medium">Mittel</option><option value="low">Niedrig</option></select></label><label className="block"><span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Fällig am</span><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full border border-border bg-card px-3 py-3" /></label></div></div><button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50">{saving ? 'Speichern...' : editing ? 'Änderungen speichern' : 'Aufgabe erstellen'}</button></form></div>}
      </section>
    </main>
  )
}
