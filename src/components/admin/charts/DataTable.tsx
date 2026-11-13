"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/admin/ui/Button";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  /** Valor usado para ordenar e exportar */
  value: (row: T) => string | number | null;
  render?: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, i: number) => string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  searchable?: boolean;
  exportName?: string;
  pageSize?: number;
  empty?: string;
}

function toCSV<T>(rows: T[], columns: Column<T>[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => esc(c.header)).join(";");
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(";")).join("\n");
  return `﻿${head}\n${body}`; // BOM: acentos corretos no Excel
}

/** Tabela com ordenação por coluna, busca, "ver mais" e exportação CSV (abre no Excel). */
export default function DataTable<T>({
  rows,
  columns,
  rowKey,
  defaultSort,
  searchable = false,
  exportName,
  pageSize = 10,
  empty = "Sem dados no período",
}: Props<T>) {
  const [sort, setSort] = useState(defaultSort);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(pageSize);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    let list = nq ? rows.filter((r) => columns.some((c) => String(c.value(r) ?? "").toLowerCase().includes(nq))) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        list = [...list].sort((a, b) => {
          const va = col.value(a);
          const vb = col.value(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1; // vazios sempre no fim
          if (vb == null) return -1;
          const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return list;
  }, [rows, columns, sort, q]);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const download = () => {
    const blob = new Blob([toCSV(filtered, columns)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName || "relatorio"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {(searchable || exportName) && (
        <div className="flex items-center gap-2 mb-3">
          {searchable && (
            <label className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setLimit(pageSize); }}
                placeholder="Filtrar…"
                className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-gray-200 bg-white"
              />
            </label>
          )}
          {exportName && (
            <Button size="sm" icon={Download} onClick={download} disabled={filtered.length === 0} className="ml-auto">
              Exportar CSV
            </Button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">{empty}</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100">
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  const Icon = !active ? ArrowUpDown : sort?.dir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th key={c.key} className={`py-2 px-2 font-medium text-gray-500 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"}`}>
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 hover:text-gray-900 transition-colors ${active ? "text-gray-900" : ""} ${c.align === "right" ? "flex-row-reverse" : ""}`}
                      >
                        {c.header}
                        <Icon size={12} className={active ? "" : "opacity-30"} />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((r, i) => (
                <tr key={rowKey(r, i)} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80 transition-colors">
                  {columns.map((c) => (
                    <td key={c.key} className={`py-2 px-2 tabular-nums ${c.align === "right" ? "text-right" : ""} ${c.className || "text-gray-700"}`}>
                      {c.render ? c.render(r) : c.value(r) ?? <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > limit && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span>Mostrando {limit} de {filtered.length}</span>
          <Button variant="ghost" size="xs" onClick={() => setLimit((l) => l + pageSize * 2)}>
            Ver mais
          </Button>
        </div>
      )}
    </div>
  );
}
