import Link from "next/link"
import { GROUPS } from "@/lib/settlement"

/**
 * 정산 폴더 — 판매처별 페이지로 가는 입구. 두 판매처는 서로의 데이터를 보면 안 되므로 여기서 데이터를 합쳐 보여주지 않는다.
 * 각 판매처 페이지(/settlement/ipsi · /settlement/dangwa · /settlement/local)는 관리자 로그인 또는 그 판매처 계정으로만 열린다.
 */
export default function SettlementIndex() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800">주간 정산</h1>
        <a href="/admin" className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50">← 관리자</a>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {GROUPS.map((g) => (
          <Link key={g.id} href={`/settlement/${g.id}`} className="block bg-white rounded-2xl border p-6 hover:border-gray-400 transition-colors">
            <div className="text-3xl mb-3" aria-hidden="true">📁</div>
            <div className="font-bold text-gray-800">{g.label}</div>
            <div className="text-sm text-gray-500 mt-1">건당 {g.price.toLocaleString("ko-KR")}원</div>
            <div className="text-xs text-gray-400 mt-2">{g.desc}</div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-6">판매처마다 데이터가 완전히 분리돼 있습니다. 판매처에는 각자의 링크(키 포함)만 전달하세요.</p>
    </div>
  )
}
