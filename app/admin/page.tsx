"use client"

import { useState, useCallback, useEffect } from "react"
import { COLUMNS, VERTICALS, verticalLabel, verticalOf, type Vertical } from "@/lib/verticals"

type Submission = {
  id: string
  name: string
  birthday: string
  cellphone: string
  sex: string
  ipaddress: string
  location: string
  region: string
  has_license: string
  category: string
  purpose: string
  created_at: string
  sent_at: string | null
  sites?: { name: string }
}

type Site = {
  id: string
  name: string
  api_key: string
  owner_email: string
  vertical?: string | null
  created_at: string
}

const EMPTY: Record<Vertical, Submission[]> = { beauty: [], internet: [] }

export default function AdminPage() {
  const [adminId, setAdminId] = useState("")
  const [password, setPassword] = useState("")
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState("")
  // 업종 탭 — 접수·사이트·전체 전송이 전부 이 업종 기준이다
  const [vertical, setVertical] = useState<Vertical>("beauty")
  const [subsBy, setSubsBy] = useState<Record<Vertical, Submission[]>>(EMPTY)
  const [sites, setSites] = useState<Site[]>([])
  const [tab, setTab] = useState<"submissions" | "sites">("submissions")
  const [loading, setLoading] = useState(false)
  const [newSite, setNewSite] = useState<{ name: string; owner_email: string; api_key: string; vertical: Vertical }>({ name: "", owner_email: "", api_key: "", vertical: "beauty" })
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent">("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [sending, setSending] = useState<string | null>(null)

  const headers = { "x-admin-id": adminId, "x-admin-password": password }
  const submissions = subsBy[vertical]
  const setSubmissions = (fn: (prev: Submission[]) => Submission[]) => setSubsBy((all) => ({ ...all, [vertical]: fn(all[vertical]) }))

  const load = useCallback(async (id: string, pw: string) => {
    setLoading(true)
    const h = { "x-admin-id": id, "x-admin-password": pw }
    const [b, i, st] = await Promise.all([
      fetch("/api/submissions?vertical=beauty", { headers: h }),
      fetch("/api/submissions?vertical=internet", { headers: h }),
      fetch("/api/sites", { headers: h }),
    ])
    if (b.status === 401) { setAuthError("아이디 또는 비밀번호가 틀렸습니다."); setLoading(false); return }
    setSubsBy({ beauty: await b.json(), internet: await i.json() })
    setSites(await st.json())
    setAuthed(true)
    localStorage.setItem("admin_id", id)
    localStorage.setItem("admin_pw", pw)
    setLoading(false)
  }, [])

  useEffect(() => {
    const id = localStorage.getItem("admin_id")
    const pw = localStorage.getItem("admin_pw")
    if (id && pw) {
      setAdminId(id)
      setPassword(pw)
      load(id, pw)
    }
  }, [load])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    load(adminId, password)
  }

  const sendSubmission = async (id: string) => {
    setSending(id)
    const res = await fetch("/api/submissions", {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSubmissions((prev) =>
        prev.map((s) => s.id === id ? { ...s, sent_at: new Date().toISOString() } : s)
      )
    }
    setSending(null)
  }

  const sendAll = async () => {
    const pendingIds = submissions.filter((s) => !s.sent_at).map((s) => s.id)
    if (pendingIds.length === 0) return alert("전송할 데이터가 없습니다.")
    if (!confirm(`${verticalLabel(vertical)} 미전송 ${pendingIds.length}건을 전체 전송하시겠습니까?`)) return
    setSending("all")
    const res = await fetch("/api/submissions", {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ all: true, vertical }),
    })
    if (res.ok) {
      const now = new Date().toISOString()
      setSubmissions((prev) =>
        prev.map((s) => s.sent_at ? s : { ...s, sent_at: now })
      )
    }
    setSending(null)
  }

  const addSite = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, string> = { name: newSite.name, owner_email: newSite.owner_email, vertical: newSite.vertical }
    if (newSite.api_key) payload.api_key = newSite.api_key
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const site = await res.json()
      setSites((p) => [site, ...p])
      setNewSite({ name: "", owner_email: "", api_key: "", vertical })
    } else {
      const { error } = await res.json().catch(() => ({ error: "" }))
      const hint = newSite.vertical === "internet" ? "\n(인터넷 업종은 supabase/2026-10-15_sites_vertical.sql 을 먼저 실행해야 합니다)" : ""
      alert(`사이트 추가 실패${error ? `: ${error}` : ""}${hint}`)
    }
  }

  const deleteSite = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return
    await fetch("/api/sites", { method: "DELETE", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ id }) })
    setSites((p) => p.filter((s) => s.id !== id))
  }

  const deleteSubmission = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return
    await fetch("/api/submissions", { method: "DELETE", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ id }) })
    setSubmissions((p) => p.filter((s) => s.id !== id))
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow p-10 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-800">관리자 로그인</h1>
          <input
            type="text"
            placeholder="아이디"
            value={adminId}
            onChange={(e) => setAdminId(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          {authError && <p className="text-red-500 text-sm">{authError}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-700 disabled:opacity-50">
            {loading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    )
  }

  const columns = COLUMNS[vertical]
  const vSites = sites.filter((s) => verticalOf(s) === vertical)
  const pendingCount = submissions.filter((s) => !s.sent_at).length
  const sentCount = submissions.filter((s) => !!s.sent_at).length

  const toDateKey = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
  const uniqueDates = ["all", ...Array.from(new Set(submissions.map((s) => toDateKey(s.created_at))))]

  const filtered = submissions.filter((s) => {
    const matchText = !filter || s.name?.includes(filter) || s.cellphone?.includes(filter) || s.sites?.name?.includes(filter)
    const matchStatus = statusFilter === "all" || (statusFilter === "pending" && !s.sent_at) || (statusFilter === "sent" && !!s.sent_at)
    const matchDate = dateFilter === "all" || toDateKey(s.created_at) === dateFilter
    return matchText && matchStatus && matchDate
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">관리자 대시보드</h1>
        <div className="flex gap-2">
          <span className="text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg font-semibold">미전송 {pendingCount}건</span>
          <span className="text-sm bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-semibold">전송완료 {sentCount}건</span>
          <a href="/" className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">← 메인</a>
          <button onClick={sendAll} disabled={sending === "all"} className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50 font-semibold">
            {sending === "all" ? "전송 중..." : `전체 전송 (${submissions.filter(s => !s.sent_at).length}건)`}
          </button>
          <button
            onClick={async () => {
              const res = await fetch("/api/master-key", { headers })
              if (res.ok) {
                const { key } = await res.json()
                window.open(`/dashboard?api_key=${encodeURIComponent(key)}&vertical=${vertical}`, "_blank")
              }
            }}
            className="text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700"
          >
            {verticalLabel(vertical)} 전체 대시보드
          </button>
          <a href="/dashboard" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">클라이언트 대시보드</a>
          <a href="/test-dashboard" className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">테스트 대시보드</a>
          <button onClick={() => load(adminId, password)} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">새로고침</button>
        </div>
      </div>

      {/* 업종 탭 */}
      <div className="inline-flex gap-1 p-1 mb-5 rounded-2xl bg-gray-100">
        {VERTICALS.map(({ key, label }) => {
          const pending = subsBy[key].filter((s) => !s.sent_at).length
          return (
            <button
              key={key}
              onClick={() => { setVertical(key); setNewSite((p) => ({ ...p, vertical: key })); setFilter(""); setDateFilter("all") }}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${vertical === key ? (key === "internet" ? "bg-blue-600 text-white shadow" : "bg-pink-500 text-white shadow") : "text-gray-500 hover:text-gray-800"}`}
            >
              {label}
              <span className={`ml-2 text-xs font-semibold ${vertical === key ? "text-white/80" : "text-gray-400"}`}>
                {subsBy[key].length}건{pending ? ` · 미전송 ${pending}` : ""}
              </span>
            </button>
          )
        })}
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b">
        {(["submissions", "sites"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors ${tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            {t === "submissions" ? `수신 데이터 (${submissions.length})` : `사이트 관리 (${vSites.length})`}
          </button>
        ))}
      </div>

      {tab === "submissions" && (
        <>
          {/* 날짜 필터 */}
          <div className="mb-4">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            >
              {uniqueDates.map((d) => (
                <option key={d} value={d}>{d === "all" ? "전체 날짜" : d}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder={vertical === "internet" ? "전화번호, 사이트명 검색..." : "이름, 전화번호, 사이트명 검색..."}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            />
            <div className="flex gap-2">
              {(["all", "pending", "sent"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${statusFilter === v ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-500 hover:border-gray-400"}`}
                >
                  {v === "all" ? "전체" : v === "pending" ? "미전송" : "전송완료"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">사이트</th>
                  {columns.map((c) => (
                    <th key={c.label} className="px-4 py-3 text-left font-semibold text-gray-600">{c.label}</th>
                  ))}
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">수신일시</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={columns.length + 4} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id} className={`border-b ${s.sent_at ? "bg-gray-50/50" : "hover:bg-yellow-50/30"}`}>
                    <td className="px-4 py-2.5">
                      {s.sent_at
                        ? <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">전송완료</span>
                        : <span className="text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 px-2 py-0.5 rounded-full">미전송</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      {s.sites?.name
                        ? s.sites.name.includes(".")
                          ? <a href={`https://${s.sites.name}`} target="_blank" rel="noopener noreferrer" className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full hover:bg-blue-100 hover:underline">{s.sites.name}</a>
                          : <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{s.sites.name}</span>
                        : "-"}
                    </td>
                    {columns.map((c) => (
                      <td
                        key={c.label}
                        title={c.wide ? c.get(s) : undefined}
                        className={`px-4 py-2.5 ${c.strong ? "font-medium" : "text-gray-500"}${c.wide ? " max-w-[16rem] truncate" : ""}`}
                      >
                        {c.get(s) || "-"}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(s.created_at).toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        {!s.sent_at && (
                          <button
                            onClick={() => sendSubmission(s.id)}
                            disabled={sending === s.id}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {sending === s.id ? "전송 중..." : "전송"}
                          </button>
                        )}
                        <button onClick={() => deleteSubmission(s.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "sites" && (
        <div className="space-y-6">
          <form onSubmit={addSite} className="bg-white rounded-2xl border p-6 flex flex-col sm:flex-row gap-3">
            <select
              value={newSite.vertical}
              onChange={(e) => setNewSite((p) => ({ ...p, vertical: e.target.value as Vertical }))}
              className="border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white font-semibold"
              aria-label="업종"
            >
              {VERTICALS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input
              placeholder="사이트명 *"
              value={newSite.name}
              onChange={(e) => setNewSite((p) => ({ ...p, name: e.target.value }))}
              required
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              placeholder="담당자 이메일"
              type="email"
              value={newSite.owner_email}
              onChange={(e) => setNewSite((p) => ({ ...p, owner_email: e.target.value }))}
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              placeholder="API Key (비워두면 자동생성)"
              value={newSite.api_key}
              onChange={(e) => setNewSite((p) => ({ ...p, api_key: e.target.value }))}
              className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 font-mono"
            />
            <button type="submit" className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700">
              사이트 추가
            </button>
          </form>

          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">업종</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">사이트명</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">API Key (클라이언트에게 전달)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">담당자</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">등록일</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {vSites.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">등록된 {verticalLabel(vertical)} 사이트가 없습니다.</td></tr>
                )}
                {vSites.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${verticalOf(s) === "internet" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-600"}`}>
                        {verticalLabel(verticalOf(s))}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium">{s.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs bg-gray-50 text-gray-600 select-all">{s.api_key}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.owner_email || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(s.created_at).toLocaleDateString("ko-KR")}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => deleteSite(s.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
