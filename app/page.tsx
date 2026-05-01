import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow p-10 w-full max-w-sm text-center space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">DB 관리 시스템</h1>
        <p className="text-sm text-gray-500">접속할 대시보드를 선택하세요</p>
        <div className="space-y-3">
          <Link
            href="/admin"
            className="block w-full py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-700 transition"
          >
            관리자 대시보드
          </Link>
          <Link
            href="/dashboard"
            className="block w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            클라이언트 대시보드
          </Link>
          <Link
            href="/test-dashboard"
            className="block w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition"
          >
            테스트 대시보드
          </Link>
        </div>
      </div>
    </div>
  )
}
