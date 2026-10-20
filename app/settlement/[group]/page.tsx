"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { GROUPS, isGroupId, weekKey, weekLabel, type GroupId, type SettlementLead } from "@/lib/settlement"

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`
const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
const fmtPhone = (p: string) => (p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p)

/**
 * 판매처 한 곳의 주간 정산 — /settlement/ipsi · /settlement/dangwa. 두 판매처는 서로의 데이터를 보면 안 되므로
 * 페이지·데이터(/api/settlement?group=)를 판매처별로 완전히 나눈다. 규칙은 lib/settlement.ts.
 * 열람: ?key=판매처 키(그 판매처만) 또는 관리자 로그인.
 */
export default function SettlementGroupPage() {
  return (
    <Suspense fallback={<p className="p-8 text-gray-400">불러오는 중...</p>}>
      <SettlementView />
    </Suspense>
  )
}

function SettlementView() {
  const params = useParams<{ group: string }>()
  const search = useSearchParams()
  const key = search.get("key") ?? ""
  const group: GroupId | null = isGroupId(params.group) ? params.group : null

  const [cred, setCred] = useState<{ id: string; pw: string } | null>(null)
  const [keyOk, setKeyOk] = useState(false)
  const [form, setForm] = useState({ id: "", pw: "" })
  const [leads, setLeads] = useState<SettlementLead[] | null>(null)
  const [error, setError] = useState("")
  const [week, setWeek] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  /** 판매처가 제외 표시를 할 수 있는 주. null = 관리자(전체) */
  const [editableWeeks, setEditableWeeks] = useState<string[] | null>(null)
  const [marksReady, setMarksReady] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  /** 판매처 키(링크) → 관리자 순으로 시도 */
  const load = useCallback(async (id?: string, pw?: string) => {
    if (!group) return
    setError("")
    const headers: Record<string, string> = key && !id ? { "x-settlement-key": key } : { "x-admin-id": id ?? "", "x-admin-password": pw ?? "" }
    const r = await fetch(`/api/settlement?group=${group}`, { headers })
    if (r.status === 401) { setError(key && !id ? "링크가 올바르지 않습니다." : "아이디 또는 비밀번호가 틀렸습니다."); setCred(null); setKeyOk(false); return }
    if (!r.ok) { setError("불러오지 못했습니다."); return }
    const d = await r.json()
    setLeads(d.leads)
    setEditableWeeks(d.editableWeeks ?? null)
    setMarksReady(d.marksReady !== false)
    if (key && !id) setKeyOk(true)
    else if (id && pw) {
      setCred({ id, pw })
      localStorage.setItem("admin_id", id)
      localStorage.setItem("admin_pw", pw)
    }
  }, [group, key])

  const authHeaders = (): Record<string, string> =>
    cred ? { "x-admin-id": cred.id, "x-admin-password": cred.pw } : { "x-settlement-key": key }
  const reload = () => (cred ? load(cred.id, cred.pw) : load())

  /**
   * 표시 바꾸기
   *  exclude = 판매처가 "이미 가진 중복"이라고 알려 온 건을 정산에서 뺀다
   *  include = 자동 중복이지만 정산에 다시 넣는다(살리기)
   *  clear   = 표시를 지우고 원래 판정으로(되돌리기 · 다시 제외)
   */
  const act = async (l: SettlementLead, action: "exclude" | "include" | "clear") => {
    const who = `${l.name || "이름 없음"} (${fmtPhone(l.phone)})`
    let reason = ""
    if (action === "exclude" || action === "include") {
      const input = window.prompt(
        action === "exclude"
          ? `${who} 을(를) 정산에서 제외합니다.\n사유를 적어 주세요 (예: 기존 보유 DB)`
          : `${who} 은(는) 자동으로 ${l.excluded?.reason === "테스트 의심" ? "테스트 의심" : "중복"} 처리된 건입니다.\n정산에 다시 포함할까요? 사유를 적어 주세요`,
        action === "exclude" ? "기존 보유 중복" : l.excluded?.reason === "테스트 의심" ? "실제 고객" : "중복 아님(재접수 인정)",
      )
      if (input === null) return
      reason = input.trim()
    } else if (!window.confirm(l.restored ? `${who} 을(를) 다시 중복으로 제외할까요?` : `${who} 을(를) 다시 정산에 포함할까요?`)) return
    setBusy(l.id)
    const r = await fetch("/api/settlement", {
      method: "POST",
      headers: { ...authHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ group, id: l.id, action, reason }),
    })
    setBusy(null)
    if (!r.ok) { const e = await r.json().catch(() => ({})); alert(e.error ?? "처리하지 못했습니다."); return }
    await reload()
  }
  const canEdit = (l: SettlementLead) => marksReady && (editableWeeks === null || editableWeeks.includes(l.week))

  useEffect(() => {
    if (key) { load(); return }
    const id = localStorage.getItem("admin_id")
    const pw = localStorage.getItem("admin_pw")
    if (id && pw) load(id, pw)
  }, [load, key])

  const thisWeek = weekKey(new Date().toISOString())
  const lastWeek = (() => {
    const [y, m, d] = thisWeek.split("-").map(Number)
    return new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10)
  })()

  const price = GROUPS.find((g) => g.id === group)?.price ?? 0

  // 주 폴더 — 최신 주가 위. 이번 주·지난주는 접수가 없어도 폴더를 보여준다
  const weeks = useMemo(() => {
    const m = new Map<string, { valid: number; dup: number; bad: number }>()
    for (const k of [thisWeek, lastWeek]) m.set(k, { valid: 0, dup: 0, bad: 0 })
    for (const l of leads ?? []) {
      const w = m.get(l.week) ?? { valid: 0, dup: 0, bad: 0 }
      if (!l.excluded) w.valid++
      else if (l.excluded.reason === "중복") w.dup++
      else w.bad++
      m.set(l.week, w)
    }
    return [...m].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [leads, thisWeek, lastWeek])

  const selected = week ?? lastWeek
  const inWeek = (leads ?? []).filter((l) => l.week === selected)
  const valid = inWeek.filter((l) => !l.excluded)
  const excluded = inWeek.filter((l) => l.excluded)
  const q = query.replace(/\s|-/g, "")
  const hit = (l: SettlementLead) => !q || l.name.replace(/\s/g, "").includes(q) || l.phone.includes(q)
  const validShown = valid.filter(hit)
  const excludedShown = excluded.filter(hit)

  const downloadCsv = () => {
    const g = GROUPS.find((x) => x.id === group)!
    const header = ["No", "접수일시", "사이트", "이름", "연락처", "생년월일", "성별", "지역"]
    const rows = [...valid].reverse().map((l, i) => [String(i + 1), new Date(l.created_at).toLocaleString("ko-KR"), l.site, l.name, fmtPhone(l.phone), l.birthday, l.sex, l.region])
    const total = ["", "", "", "", "", "", "합계", `${valid.length}건 × ${won(g.price)} = ${won(valid.length * g.price)}`]
    const csv = [header, ...rows, total].map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }))
    a.download = `정산_${g.label.replace(/\s|·/g, "")}_${selected}.csv`
    a.click()
  }

  const copySummary = async () => {
    const g = GROUPS.find((x) => x.id === group)!
    const text = `[${g.label} 정산] ${weekLabel(selected)}\n유효 ${valid.length}건 × ${won(g.price)} = ${won(valid.length * g.price)}\n(중복 ${excluded.filter((l) => l.excluded?.reason === "중복").length}건 · 판매처 제외 ${excluded.filter((l) => l.excluded?.reason === "판매처 제외").length}건 · 테스트 ${excluded.filter((l) => l.excluded?.reason === "테스트 의심").length}건 제외)`
    await navigator.clipboard.writeText(text)
    alert("정산 요약을 복사했습니다.\n\n" + text)
  }

  if (!group) return <p className="p-8 text-gray-500">없는 페이지입니다.</p>

  if (!cred && !keyOk) {
    if (key && !error) return <p className="p-8 text-gray-400">불러오는 중...</p>
    return (
      <div className="min-h-screen flex items-center justify-center">
        <form onSubmit={(e) => { e.preventDefault(); load(form.id, form.pw) }} className="bg-white rounded-2xl shadow p-10 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-800">주간 정산 · {GROUPS.find((g) => g.id === group)!.label}</h1>
          <input placeholder="관리자 아이디" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="w-full border rounded-xl px-4 py-3 text-sm" />
          <input type="password" placeholder="비밀번호" value={form.pw} onChange={(e) => setForm({ ...form, pw: e.target.value })} className="w-full border rounded-xl px-4 py-3 text-sm" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold">로그인</button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">주간 정산 · {GROUPS.find((g) => g.id === group)!.label} <span className="text-base font-semibold text-gray-500">건당 {won(price)}</span></h1>
          <p className="text-sm text-gray-500 mt-1">매주 월요일, 지난주(월~일) 수도권(서울·경기·인천) 접수 기준. 같은 전화번호는 처음 1건만 유효하고 나머지는 중복으로 제외합니다.</p>
        </div>
        <div className="flex gap-2">
          {cred && <a href="/settlement" className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">← 정산 폴더</a>}
          <button onClick={() => (cred ? load(cred.id, cred.pw) : load())} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">새로고침</button>
        </div>
      </div>

      {!leads ? (
        <p className="text-gray-400">불러오는 중...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* 주 폴더 */}
          <div className="bg-white rounded-2xl border p-3 space-y-1 self-start">
            {weeks.map(([k, w]) => (
              <button
                key={k}
                onClick={() => setWeek(k)}
                className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 ${selected === k ? "bg-gray-100" : "hover:bg-gray-50"}`}
              >
                <span className="text-xl" aria-hidden="true">{selected === k ? "📂" : "📁"}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-800">
                    {weekLabel(k)}
                    {k === lastWeek && <span className="ml-1.5 text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded">정산 대상</span>}
                    {k === thisWeek && <span className="ml-1.5 text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">진행 중</span>}
                  </span>
                  <span className="block text-xs text-gray-500">
                    유효 {w.valid}건 · {won(w.valid * price)}{w.dup ? ` · 중복 ${w.dup}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* 선택한 주 */}
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["기간", weekLabel(selected)],
                ["유효 건수", `${valid.length}건`],
                ["정산 금액", won(valid.length * price)],
                ["제외", `${excluded.length}건`],
              ].map(([k, v]) => (
                <div key={k} className="bg-white rounded-2xl border p-4">
                  <div className="text-xs text-gray-500">{k}</div>
                  <div className={`mt-1 font-bold ${k === "정산 금액" ? "text-xl text-orange-600" : "text-lg text-gray-800"}`}>{v}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={downloadCsv} disabled={!valid.length} className="text-sm bg-gray-900 text-white px-4 py-2 rounded-xl disabled:opacity-40">명단 CSV 다운로드</button>
              <button onClick={copySummary} className="text-sm bg-white border px-4 py-2 rounded-xl hover:bg-gray-50">정산 요약 복사</button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 또는 번호로 찾기"
                className="ml-auto w-56 text-sm border rounded-xl px-3 py-2"
              />
            </div>
            <p className="text-xs text-gray-500">
              이미 가지고 있는 중복 DB 는 해당 줄의 <b>중복 제외</b> 를 누르면 정산에서 빠집니다(되돌리기 가능). 자동으로 중복 처리된 건은 아래 제외 목록에서 <b>살리기</b> 로 다시 포함할 수 있습니다.
              {editableWeeks && " 지난주·이번 주 접수만 바꿀 수 있습니다."}
              {!marksReady && <span className="text-red-500"> 제외 표시 기능 준비 중(DB 설정 필요).</span>}
            </p>

            <div className="bg-white rounded-2xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-600">
                    <th className="px-4 py-3">No</th>
                    <th className="px-4 py-3">접수일시</th>
                    <th className="px-4 py-3">사이트</th>
                    <th className="px-4 py-3">이름</th>
                    <th className="px-4 py-3">연락처</th>
                    <th className="px-4 py-3">생년월일</th>
                    <th className="px-4 py-3">지역</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {validShown.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">{q ? "찾는 접수가 없습니다." : "이 주에는 유효 접수가 없습니다."}</td></tr>}
                  {validShown.map((l, i) => (
                    <tr key={l.id} className="border-b">
                      <td className="px-4 py-2.5 text-gray-400">{validShown.length - i}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{fmt(l.created_at)}</td>
                      <td className="px-4 py-2.5 text-xs">{l.site}</td>
                      <td className="px-4 py-2.5 font-medium">
                        {l.name || "-"}
                        {l.restored && (
                          <span className="ml-1.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded" title={l.restored.firstAt ? `처음 접수 ${fmt(l.restored.firstAt)} · ${l.restored.firstSite}` : `원래 ${l.restored.was}`}>
                            살림({l.restored.by}){l.restored.note ? ` · ${l.restored.note}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">{fmtPhone(l.phone)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{l.birthday || "-"}</td>
                      <td className="px-4 py-2.5 text-gray-500">{l.region}</td>
                      <td className="px-4 py-2.5 text-right">
                        {canEdit(l) && (
                          <button onClick={() => act(l, l.restored ? "clear" : "exclude")} disabled={busy === l.id} className="text-xs border border-red-200 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 disabled:opacity-40 whitespace-nowrap">
                            {busy === l.id ? "처리 중..." : l.restored ? "다시 제외" : "중복 제외"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {excludedShown.length > 0 && (
              <div className="bg-white rounded-2xl border overflow-x-auto">
                <p className="px-4 pt-4 pb-2 text-sm font-bold text-gray-700">정산 제외 {excluded.length}건</p>
                <table className="w-full text-sm">
                  <tbody>
                    {excludedShown.map((l) => (
                      <tr key={l.id} className="border-t text-gray-500">
                        <td className="px-4 py-2.5 text-xs">{fmt(l.created_at)}</td>
                        <td className="px-4 py-2.5 text-xs">{l.site}</td>
                        <td className="px-4 py-2.5">{l.name || "-"}</td>
                        <td className="px-4 py-2.5">{fmtPhone(l.phone) || "-"}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{l.excluded!.reason}</span>
                          {l.excluded!.reason === "테스트 의심" && (
                            <span className="ml-2 text-xs text-gray-400">{l.excluded!.why}</span>
                          )}
                          {l.excluded!.reason === "중복" && (
                            <span className="ml-2 text-xs text-gray-400">처음 접수 {fmt(l.excluded!.firstAt)} · {l.excluded!.firstSite}</span>
                          )}
                          {(l.excluded!.reason === "판매처 제외" || l.excluded!.reason === "관리자 제외") && (
                            <span className="ml-2 text-xs text-gray-400">{l.excluded!.note || "사유 없음"} · {fmt(l.excluded!.at)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {(l.excluded!.reason === "판매처 제외" || l.excluded!.reason === "관리자 제외") && canEdit(l) && (
                            <button onClick={() => act(l, "clear")} disabled={busy === l.id} className="text-xs border px-2.5 py-1 rounded-lg hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">
                              되돌리기
                            </button>
                          )}
                          {(l.excluded!.reason === "중복" || l.excluded!.reason === "테스트 의심") && canEdit(l) && (
                            <button onClick={() => act(l, "include")} disabled={busy === l.id} className="text-xs border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-50 disabled:opacity-40 whitespace-nowrap">
                              살리기
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
