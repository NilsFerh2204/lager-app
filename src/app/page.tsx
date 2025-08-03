export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-500 to-pink-500 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center text-white space-y-8">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-7xl font-bold animate-pulse">
              🎆 Lagerverwaltung
            </h1>
            <p className="text-2xl md:text-3xl font-light">
              Lichtenrader Feuerwerkverkauf
            </p>
            <p className="text-lg opacity-90">
              Professionelles Bestandsmanagement für Ihr Feuerwerk-Sortiment
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
            <a 
              href="/dashboard" 
              className="group relative px-8 py-4 bg-white text-orange-600 rounded-xl text-xl font-bold hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/25 min-w-[200px]"
            >
              <span className="relative z-10">Dashboard öffnen →</span>
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </a>
            
            <a 
              href="/products/new" 
              className="px-8 py-4 bg-white/20 backdrop-blur-md text-white border-2 border-white/50 rounded-xl text-xl font-semibold hover:bg-white/30 transition-all duration-300 min-w-[200px]"
            >
              Produkt anlegen
            </a>
          </div>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center hover:bg-white/20 transition-all">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="font-semibold text-lg mb-2">Bestandsverwaltung</h3>
            <p className="text-sm opacity-90">Vollständige Kontrolle über Ihr Lager</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center hover:bg-white/20 transition-all">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="font-semibold text-lg mb-2">Echtzeit-Analysen</h3>
            <p className="text-sm opacity-90">Statistiken und Berichte auf einen Blick</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center hover:bg-white/20 transition-all">
            <div className="text-4xl mb-3">🚀</div>
            <h3 className="font-semibold text-lg mb-2">Schnell & Einfach</h3>
            <p className="text-sm opacity-90">Intuitive Bedienung für alle Mitarbeiter</p>
          </div>
        </div>
      </div>
    </div>
  )
}