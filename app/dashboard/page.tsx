"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"

type Submission = {
  id: string
  name: string
  birthday: string
  cellphone: string
  sex: string
  location: string
  region: string
  has_license: string
  category: string
  purpose: string
  created_at: string
}

type Data = {
  site: { name: string }
  submissions: Submission[]
}

const PAGE_SIZE = 20
const EXCLUDED = ["신승윤", "테스트"]
const LAST_SEEN_KEY = "dashboard_last_seen"

function DashboardContent() {
  const searchParams = useSearchParams()
  const [apiKey, setApiKey] = useState("")
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [newCount, setNewCount] = useState(0)
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(LAST_SEEN_KEY)
    setLastSeen(saved)
  }, [])

  const loadData = (key: string) => {
    setLoading(true)
    fetch(`/api/submissions?api_key=${encodeURIComponent(key)}`)
      .then(res => res.status === 401 ? null : res.json())
      .then(d => {
        if (!d) { setError("API Key가 올바르지 않습니다."); return }
        setData(d)
        const saved = localStorage.getItem(LAST_SEEN_KEY)
        if (saved) {
          const count = d.submissions.filter((s: Submission) =>
            !EXCLUDED.includes(s.name) && new Date(s.created_at) > new Date(saved)
          ).length
          setNewCount(count)
        }
        localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString())
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const keyFromUrl = searchParams.get("api_key")
    if (keyFromUrl) { setApiKey(keyFromUrl); loadData(keyFromUrl) }
  }, [searchParams])

  const load = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    loadData(apiKey)
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <form onSubmit={load} className="bg-white rounded-2xl shadow p-10 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-800">클라이언트 대시보드</h1>
          <p className="text-sm text-gray-500">발급받은 API Key를 입력하세요.</p>
          <input
            type="text"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
            {loading ? "확인 중..." : "조회하기"}
          </button>
        </form>
      </div>
    )
  }

  const toDateKey = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })
  const uniqueDates = ["all", ...Array.from(new Set(data.submissions.map((s) => toDateKey(s.created_at))))]

  const filtered = data.submissions.filter((s) => {
    if (EXCLUDED.includes(s.name)) return false
    const matchText = !filter || s.name?.includes(filter) || s.cellphone?.includes(filter)
    const matchDate = dateFilter === "all" || toDateKey(s.created_at) === dateFilter
    return matchText && matchDate
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilterChange = (fn: () => void) => { fn(); setPage(1) }

  const deleteSubmission = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return
    setDeleting(id)
    await fetch("/api/submissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, api_key: apiKey }),
    })
    setData((prev) => prev ? { ...prev, submissions: prev.submissions.filter((s) => s.id !== id) } : prev)
    setDeleting(null)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 신규 데이터 알림 */}
      {newCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
          <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-sm font-semibold text-blue-700">
            마지막 접속 이후 신규 데이터 <span className="text-blue-900">{newCount}건</span>이 추가됐습니다.
          </p>
          <button onClick={() => setNewCount(0)} className="ml-auto text-xs text-blue-400 hover:text-blue-600">닫기</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.site.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {filtered.length}건 표시</p>
        </div>
        <div className="flex gap-2">
          <a href="/" className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">← 메인</a>
          <button onClick={() => setData(null)} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">로그아웃</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="이름, 전화번호 검색..."
          value={filter}
          onChange={(e) => handleFilterChange(() => setFilter(e.target.value))}
          className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
        <select
          value={dateFilter}
          onChange={(e) => handleFilterChange(() => setDateFilter(e.target.value))}
          className="border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          {uniqueDates.map((d) => (
            <option key={d} value={d}>{d === "all" ? "전체 날짜" : d}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">이름</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">생년월일</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">전화번호</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">성별</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">지역</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">자격증</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">카테고리</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">목적</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">수신일시</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
            )}
            {paginated.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
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
                  <button
                    onClick={() => deleteSubmission(s.id)}
                    disabled={deleting === s.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  >
                    {deleting === s.id ? "삭제 중..." : "삭제"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 text-sm border rounded-lg ${page === p ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50"}`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}

      <button
        onClick={() => {
          const header = ["이름", "생년월일", "전화번호", "성별", "지역", "자격증", "카테고리", "목적", "수신일시"]
          const rows = filtered.map((s) => [s.name, s.birthday, s.cellphone, s.sex, s.region, s.has_license, s.category, s.purpose, new Date(s.created_at).toLocaleString("ko-KR")])
          const csv = [header, ...rows].map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
          const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a"); a.href = url; a.download = `${data.site.name}_수신데이터.csv`; a.click()
        }}
        className="mt-4 text-sm text-blue-600 hover:underline"
      >
        CSV 다운로드
      </button>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
