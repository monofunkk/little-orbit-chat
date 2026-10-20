import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ClipboardCheck,
  FileText,
  Home,
  Inbox,
  FileDown,
  Leaf,
  LogOut,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { Button } from '@/components/arc/button/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useSnapshot } from '@/lib/audit-query';
export const useRol = () => ({ rol: useSnapshot().rol });

const navAdmin = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/instalaciones", label: "Instalaciones", icon: Building2 },
  { to: "/rca", label: "RCA y checklist", icon: FileText },
  { to: "/auditorias", label: "Auditorías", icon: ClipboardCheck },
  { to: "/revision", label: "Revisión", icon: Inbox },
  { to: "/reportes", label: "Reportes", icon: FileDown },
  { to: "/usuarios", label: "Equipo", icon: Users },
] as const;

const navSupervisor = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/auditorias", label: "Mis auditorías", icon: ClipboardCheck },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { rol } = useSnapshot();
  const [open, setOpen] = useState(true);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = rol === "admin" ? navAdmin : navSupervisor;

  return (
    <>
      <div className="flex min-h-screen bg-background text-foreground">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border-subtle px-3 py-4 transition-[width] duration-300 md:flex ${open ? "w-60" : "w-16"}`}
        >
          <div className="mb-6 flex items-center justify-between px-2">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-muted">
                <Leaf className="size-4" />
              </span>
              {open && <span className="text-sm font-semibold tracking-tight">Invermar Audit</span>}
            </Link>
            {open && (
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Contraer menú">
                <PanelLeftClose className="size-4" />
              </Button>
            )}
          </div>
          {!open && (
            <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="mb-4 grid place-items-center text-muted-foreground hover:text-foreground" aria-label="Expandir menú">
              <PanelLeftOpen className="size-4" />
            </Button>
          )}
          <nav className="flex flex-1 flex-col gap-0.5">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = to === "/" ? path === "/" : path.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  title={label}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors ${active ? "bg-muted text-foreground" : "text-secondary-foreground hover:bg-muted/60 hover:text-foreground"}`}
                >
                  <Icon className="size-4 shrink-0" />
                  {open && label}
                </Link>
              );
            })}
          </nav>
          <RolSwitch compact={!open} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border-subtle px-4 py-3 md:hidden">
            <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
              <Leaf className="size-4" /> Invermar Audit
            </Link>
            <RolSwitch compact />
          </header>
          <main className="flex-1">{children}</main>
          <nav className="sticky bottom-0 flex justify-around border-t border-border-subtle bg-background/90 py-2 backdrop-blur md:hidden">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} aria-label={label} className="p-2 text-muted-foreground" activeProps={{ className: "p-2 text-foreground" }} activeOptions={{ exact: to === "/" }}>
                <Icon className="size-5" />
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

function RolSwitch({ compact }: { compact?: boolean }) {
  const { nombre,rol } = useSnapshot();
  const client=useQueryClient(); const navigate=useNavigate();
  return <div className="flex items-center justify-between gap-2 px-2">{!compact&&<div className="min-w-0"><p className="truncate text-sm">{nombre}</p><p className="text-xs text-muted-foreground">{rol==='admin'?'Administrador':'Supervisor'}</p></div>}<Button variant="ghost" size="sm" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={async()=>{await client.cancelQueries();client.clear();await supabase.auth.signOut();await navigate({to:'/auth',replace:true});}}><LogOut className="size-4"/></Button></div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-12">{children}</div>;
}
