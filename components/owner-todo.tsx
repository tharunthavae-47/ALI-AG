"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CheckSquare, ChevronRight, ClipboardList } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Todo = { id: string; title: string; completed: boolean }

export function OwnerTodo() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [openCount, setOpenCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function loadTodos() {
      const [{ count }, { data }] = await Promise.all([
        supabase
          .from("owner_todos")
          .select("id", { count: "exact", head: true })
          .eq("completed", false),
        supabase
          .from("owner_todos")
          .select("id,title,completed")
          .eq("completed", false)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(3),
      ])

      setOpenCount(count ?? 0)
      setTodos((data ?? []) as Todo[])
    }

    loadTodos()
  }, [])

  return (
    <Link
      href="/besitzer/to-do"
      className="group block border border-border bg-card p-5 transition-colors hover:bg-secondary/60 sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-background">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">Gemeinsam</p>
            <h3 className="mt-1 font-display text-xl font-bold uppercase tracking-wide">To-do</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {openCount > 0 ? `${openCount} offene Aufgaben` : "Aufgaben verwalten"}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
      {todos.length > 0 && (
        <div className="mt-5 space-y-2 border-t border-border pt-4">
          {todos.map((todo) => (
            <div key={todo.id} className="flex items-center gap-3 text-sm">
              <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{todo.title}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
