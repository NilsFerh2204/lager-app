'use client'

import { ArrowLeft } from 'lucide-react'

export default function MovementsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <a href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Zurück zum Dashboard
          </a>
          <h1 className="text-3xl font-bold">Lagerbewegungen</h1>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Bewegungshistorie kommt bald...</p>
        </div>
      </div>
    </div>
  )
}