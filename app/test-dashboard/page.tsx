"use client"

import { useState, useCallback } from "react"

type Submission = {
  id: string
  name: string
  birthday: string
  cellphone: string
  sex: string
  region: string
  has_license: string
  category: string
  purpose: string
  created_at: string
  sent_at: string | null
  sites?: { name: string }
}

export default function TestDashboardPage() {
  const [adminId, setAdminId] = useState("")
  const [password, setPassword] = useState("")
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState("")
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (id: string, pw: string) => {
    setLoading(true)
    const res = await fetch("/api/submissions?test=1", {
      headers: { "x-admin-id": id, "x-admin-password": pw },
    })
    if (res.status === 401) {
      setAuthError("아이디 또는 비밀번호가 틀렸습니다.")
      setLoading(false)
      return
    }
    setSubmissions(await res.json())
    setAuthed(true)
    setLoading(false)
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    load(adminId, password)
  }

  const deleteSubmission = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return
    await fetch("/api/submissions", {
      method: "DELETE",
      headers: { "x-admin-id": adminId, "x-admin-password": password, "content-type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setSubmissions((p) => p.filter((s) => s.id !== id))
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow p-10 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-gray-800">테스트 대시보드</h1>
          <p className="text-sm text-gray-400">이름이 &quot;테스트&quot;인 데이터만 표시됩니다.</p>
          <input
            type="text"
            placeholder="관리자 아이디"
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">테스트 대시보드</h1>
          <p className="text-sm text-gray-400 mt-1">이름 = &quot;테스트&quot; 인 데이터 ({submissions.length}건)</p>
        </div>
        <button onClick={() => load(adminId, password)} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">
          새로고침
        </button>
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
              <th className="px-4 py-3 text-left font-semibold text-gray-600">카테고리</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">목적</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">수신일시</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">테스트 데이터가 없습니다.</td></tr>
            )}
            {submissions.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
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
                <td className="px-4 py-2.5 text-gray-500">{s.category || "-"}</td>
                <td className="px-4 py-2.5 text-gray-500">{s.purpose || "-"}</td>
                <td className="px-4 py-2.5 text-gray-400 text-xs">{new Date(s.created_at).toLocaleString("ko-KR")}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => deleteSubmission(s.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
