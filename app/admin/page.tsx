"use client"

import { useState, useCallback, useEffect } from "react"

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
  created_at: string
}

export default function AdminPage() {
  const [adminId, setAdminId] = useState("")
  const [password, setPassword] = useState("")
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState("")
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [tab, setTab] = useState<"submissions" | "sites">("submissions")
  const [loading, setLoading] = useState(false)
  const [newSite, setNewSite] = useState({ name: "", owner_email: "" })
  const [filter, setFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent">("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [sending, setSending] = useState<string | null>(null)

  const headers = { "x-admin-id": adminId, "x-admin-password": password }

  const load = useCallback(async (id: string, pw: string) => {
    setLoading(true)
    const [s, st] = await Promise.all([
      fetch("/api/submissions", { headers: { "x-admin-id": id, "x-admin-password": pw } }),
      fetch("/api/sites", { headers: { "x-admin-id": id, "x-admin-password": pw } }),
    ])
    if (s.status === 401) { setAuthError("아이디 또는 비밀번호가 틀렸습니다."); setLoading(false); return }
    setSubmissions(await s.json())
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
      setStatusFilter("sent")
    }
    setSending(null)
  }

  const addSite = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(newSite),
    })
    if (res.ok) {
      const site = await res.json()
      setSites((p) => [site, ...p])
      setNewSite({ name: "", owner_email: "" })
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
          <a href="/dashboard" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">클라이언트 대시보드</a>
          <a href="/test-dashboard" className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">테스트 대시보드</a>
          <button onClick={() => load(adminId, password)} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">새로고침</button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6 border-b">
        {(["submissions", "sites"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors ${tab === t ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            {t === "submissions" ? `수신 데이터 (${submissions.length})` : `사이트 관리 (${sites.length})`}
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
              placeholder="이름, 전화번호, 사이트명 검색..."
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">생년월일</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">전화번호</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">성별</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">지역</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">자격증</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">카테고리</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">목적</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">수신일시</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
                )}
                {filtered.map((s) => (
                  <tr key={s.id} className={`border-b ${s.sent_at ? "bg-gray-50/50" : "hover:bg-yellow-50/30"}`}>
                    <td className="px-4 py-2.5">
                      {s.sent_at
                        ? <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full">전송완료</span>
                        : <span className="text-xs bg-yellow-50 text-yellow-600 border border-yellow-200 px-2 py-0.5 rounded-full">미전송</span>
                      }
                    </td>
                    <td className="px-4 py-2.5"><span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{s.sites?.name ?? "-"}</span></td>
                    <td className="px-4 py-2.5 font-medium">{s.name || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.birthday || "-"}</td>
                    <td className="px-4 py-2.5">{s.cellphone || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.sex || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.region || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.has_license || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.category || "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{s.purpose || "-"}</td>
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
            <button type="submit" className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700">
              사이트 추가
            </button>
          </form>

          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">사이트명</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">API Key (클라이언트에게 전달)</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">담당자</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">등록일</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {sites.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">등록된 사이트가 없습니다.</td></tr>
                )}
                {sites.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
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
