'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LocationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/storage-locations');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-gray-600">Weiterleitung zu Lagerplätzen...</div>
    </div>
  );
}