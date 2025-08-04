'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

export default function CreateWarehouseLocations() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCreated, setTotalCreated] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const createWarehouseStructure = async () => {
    setLoading(true);
    setProgress(0);
    setTotalCreated(0);
    setStatusMessage('Starte Erstellung der Lagerstruktur...');

    try {
      // 1. Prüfe ob Hauptlager bereits existiert
      setStatusMessage('Prüfe vorhandene Lagerstruktur...');
      const { data: existingWarehouses, error: checkError } = await supabase
        .from('locations')
        .select('*')
        .eq('name', 'Hauptlager')
        .eq('type', 'warehouse');

      if (checkError) {
        console.error('Fehler beim Prüfen:', checkError);
        throw new Error(`Datenbankfehler: ${checkError.message}`);
      }

      let warehouseId;
      
      if (existingWarehouses && existingWarehouses.length > 0) {
        // Verwende existierendes Hauptlager
        warehouseId = existingWarehouses[0].id;
        setStatusMessage('Verwende existierendes Hauptlager...');
        console.log('Verwende existierendes Hauptlager:', warehouseId);
      } else {
        // Erstelle neues Hauptlager
        setStatusMessage('Erstelle Hauptlager...');
        const { data: warehouse, error: warehouseError } = await supabase
          .from('locations')
          .insert({
            name: 'Hauptlager',
            description: 'Zentrales Lager mit 18 Palettenregalen',
            type: 'warehouse'
          })
          .select()
          .single();

        if (warehouseError) {
          console.error('Fehler beim Erstellen des Hauptlagers:', warehouseError);
          throw new Error(`Fehler beim Erstellen des Hauptlagers: ${warehouseError.message}`);
        }

        warehouseId = warehouse.id;
        console.log('Hauptlager erstellt:', warehouse);
      }

      let created = 1;
      setTotalCreated(created);

      // 2. Erstelle 18 Palettenregale
      for (let regalNr = 1; regalNr <= 18; regalNr++) {
        setStatusMessage(`Erstelle Palettenregal ${regalNr}...`);
        
        // Prüfe ob Regal bereits existiert
        const { data: existingRegal } = await supabase
          .from('locations')
          .select('*')
          .eq('name', `Palettenregal ${regalNr}`)
          .eq('parent_id', warehouseId)
          .single();

        let regalId;
        
        if (existingRegal) {
          regalId = existingRegal.id;
          console.log(`Regal ${regalNr} existiert bereits`);
        } else {
          const { data: regal, error: regalError } = await supabase
            .from('locations')
            .insert({
              name: `Palettenregal ${regalNr}`,
              description: `Regal ${regalNr} mit 9 Stellplätzen`,
              type: 'shelf',
              parent_id: warehouseId
            })
            .select()
            .single();

          if (regalError) {
            console.error(`Fehler bei Regal ${regalNr}:`, regalError);
            // Überspringe dieses Regal und fahre mit dem nächsten fort
            continue;
          }

          regalId = regal.id;
          console.log(`Regal ${regalNr} erstellt`);
          created++;
        }

        // 3. Erstelle 9 Stellplätze pro Regal
        const ebenen = ['Unten', 'Mitte', 'Oben'];
        const positionen = [1, 2, 3];
        const stellplaetze = [];

        for (const ebene of ebenen) {
          for (const position of positionen) {
            const stellplatzName = `${ebene} ${position}`;
            const stellplatzCode = `R${regalNr.toString().padStart(2, '0')}-${ebene.charAt(0)}${position}`;

            stellplaetze.push({
              name: stellplatzName,
              description: `Regal ${regalNr} - ${stellplatzName} (${stellplatzCode})`,
              type: 'box',
              parent_id: regalId
            });
          }
        }

        // Batch-Insert für Stellplätze
        if (stellplaetze.length > 0) {
          const { error: stellplatzError } = await supabase
            .from('locations')
            .insert(stellplaetze);

          if (stellplatzError) {
            console.error(`Fehler bei Stellplätzen für Regal ${regalNr}:`, stellplatzError);
            // Fahre trotzdem fort
          } else {
            created += stellplaetze.length;
            console.log(`${stellplaetze.length} Stellplätze für Regal ${regalNr} erstellt`);
          }
        }

        setTotalCreated(created);
        setProgress(Math.round((regalNr / 18) * 100));
      }

      setStatusMessage(`Erfolgreich ${created} Lagerorte erstellt!`);
      toast.success(`Erfolgreich ${created} Lagerorte erstellt!`);
      
      // Nach 2 Sekunden zur Locations-Seite navigieren
      setTimeout(() => {
        window.location.href = '/locations';
      }, 2000);

    } catch (error: any) {
      console.error('Fehler beim Erstellen der Lagerstruktur:', error);
      setStatusMessage(`Fehler: ${error.message || 'Unbekannter Fehler'}`);
      toast.error(`Fehler: ${error.message || 'Unbekannter Fehler beim Erstellen der Lagerstruktur'}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteAllLocations = async () => {
    if (!confirm('ACHTUNG: Dies löscht ALLE Lagerorte! Sind Sie sicher?')) return;
    
    setLoading(true);
    setStatusMessage('Lösche alle Lagerorte...');
    
    try {
      // Lösche zuerst alle Stellplätze (box)
      const { error: boxError } = await supabase
        .from('locations')
        .delete()
        .eq('type', 'box');
      
      if (boxError) throw boxError;
      
      // Dann alle Regale (shelf)
      const { error: shelfError } = await supabase
        .from('locations')
        .delete()
        .eq('type', 'shelf');
      
      if (shelfError) throw shelfError;
      
      // Zuletzt das Hauptlager (warehouse)
      const { error: warehouseError } = await supabase
        .from('locations')
        .delete()
        .eq('type', 'warehouse');
      
      if (warehouseError) throw warehouseError;
      
      toast.success('Alle Lagerorte wurden gelöscht');
      setStatusMessage('Alle Lagerorte wurden gelöscht');
      setProgress(0);
      setTotalCreated(0);
      
    } catch (error: any) {
      console.error('Fehler beim Löschen:', error);
      toast.error(`Fehler beim Löschen: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createSingleRegal = async (regalNr: number) => {
    setLoading(true);
    setStatusMessage(`Erstelle Regal ${regalNr}...`);
    
    try {
      // Prüfe ob Hauptlager existiert
      const { data: warehouses, error: fetchError } = await supabase
        .from('locations')
        .select('*')
        .eq('name', 'Hauptlager')
        .eq('type', 'warehouse');

      if (fetchError) throw fetchError;

      let warehouseId;
      
      if (!warehouses || warehouses.length === 0) {
        // Erstelle Hauptlager wenn es nicht existiert
        const { data: newWarehouse, error: warehouseError } = await supabase
          .from('locations')
          .insert({
            name: 'Hauptlager',
            description: 'Zentrales Lager mit Palettenregalen',
            type: 'warehouse'
          })
          .select()
          .single();

        if (warehouseError) throw warehouseError;
        warehouseId = newWarehouse.id;
      } else {
        warehouseId = warehouses[0].id;
      }

      // Prüfe ob Regal bereits existiert
      const { data: existingRegal } = await supabase
        .from('locations')
        .select('*')
        .eq('name', `Palettenregal ${regalNr}`)
        .eq('parent_id', warehouseId)
        .single();

      if (existingRegal) {
        toast.error(`Palettenregal ${regalNr} existiert bereits!`);
        return;
      }

      // Erstelle das spezifische Regal
      const { data: regal, error: regalError } = await supabase
        .from('locations')
        .insert({
          name: `Palettenregal ${regalNr}`,
          description: `Regal ${regalNr} mit 9 Stellplätzen`,
          type: 'shelf',
          parent_id: warehouseId
        })
        .select()
        .single();

      if (regalError) throw regalError;

      // Erstelle die 9 Stellplätze
      const ebenen = ['Unten', 'Mitte', 'Oben'];
      const positionen = [1, 2, 3];
      const stellplaetze = [];

      for (const ebene of ebenen) {
        for (const position of positionen) {
          const stellplatzName = `${ebene} ${position}`;
          const stellplatzCode = `R${regalNr.toString().padStart(2, '0')}-${ebene.charAt(0)}${position}`;

          stellplaetze.push({
            name: stellplatzName,
            description: `Regal ${regalNr} - ${stellplatzName} (${stellplatzCode})`,
            type: 'box',
            parent_id: regal.id
          });
        }
      }

      const { error: stellplatzError } = await supabase
        .from('locations')
        .insert(stellplaetze);

      if (stellplatzError) throw stellplatzError;

      toast.success(`Regal ${regalNr} mit 9 Stellplätzen erfolgreich erstellt!`);
      setStatusMessage(`Regal ${regalNr} erfolgreich erstellt!`);
      
    } catch (error: any) {
      console.error('Fehler:', error);
      toast.error(`Fehler beim Erstellen von Regal ${regalNr}: ${error.message}`);
      setStatusMessage(`Fehler: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">
          Lagerstruktur erstellen
        </h1>
        
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-2">Struktur:</h2>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 1 Hauptlager</li>
              <li>• 18 Palettenregale (Regal 1-18)</li>
              <li>• 9 Stellplätze pro Regal (Unten/Mitte/Oben × Position 1/2/3)</li>
              <li>• Insgesamt: 163 Lagerorte</li>
            </ul>
          </div>

          {statusMessage && (
            <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700">
              {statusMessage}
            </div>
          )}

          {progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Fortschritt</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={createWarehouseStructure}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                loading 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Erstelle Lagerstruktur...' : 'Komplette Struktur erstellen (alle 18 Regale)'}
            </button>

            <button
              onClick={deleteAllLocations}
              disabled={loading}
              className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                loading 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Alle Lagerorte löschen (Reset)
            </button>

            <div className="border-t pt-3">
              <p className="text-sm text-gray-600 mb-2">Oder einzelnes Regal erstellen:</p>
              <div className="grid grid-cols-6 gap-2">
                {[...Array(18)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => createSingleRegal(i + 1)}
                    disabled={loading}
                    className={`py-2 px-3 rounded border text-sm font-medium transition-colors ${
                      loading 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    R{i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && (
            <div className="text-center text-gray-600">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2">Bitte warten...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}