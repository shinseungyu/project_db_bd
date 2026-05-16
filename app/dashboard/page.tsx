"use client"

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

function DashboardContent() {
  const searchParams = useSearchParams()
  const [apiKey, setApiKey] = useState("")
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    const keyFromUrl = searchParams.get("api_key")
    if (keyFromUrl) {
      setApiKey(keyFromUrl)
      setLoading(true)
      fetch(`/api/submissions?api_key=${encodeURIComponent(keyFromUrl)}`)
        .then(res => res.status === 401 ? null : res.json())
        .then(d => { if (d) setData(d); else setError("API Key가 올바르지 않습니다.") })
        .finally(() => setLoading(false))
    }
  }, [searchParams])

  const load = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await fetch(`/api/submissions?api_key=${encodeURIComponent(apiKey)}`)
    if (res.status === 401) { setError("API Key가 올바르지 않습니다."); setLoading(false); return }
    setData(await res.json())
    setLoading(false)
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

  const filtered = data.submissions.filter((s) =>
    !filter || s.name?.includes(filter) || s.cellphone?.includes(filter)
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{data.site.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {data.submissions.length}건 수신</p>
        </div>
        <div className="flex gap-2">
          <a href="/" className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">← 메인</a>
          <button onClick={() => setData(null)} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">로그아웃</button>
        </div>
      </div>

      <input
        type="text"
        placeholder="이름, 전화번호 검색..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full mb-4 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      />

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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">데이터가 없습니다.</td></tr>
            )}
            {filtered.map((s) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
