'use client';

import { useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShopifyTestPage() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const testConnection = async () => {
    setTesting(true);
    setLogs(['Starting connection test...']);
    
    try {
      const response = await fetch('/api/shopify/test');
      const data = await response.json();
      
      setResults(data);
      
      if (data.success) {
        toast.success('Shopify connection successful!');
      } else {
        toast.error('Connection failed: ' + data.error);
      }
    } catch (error: any) {
      toast.error('Test failed: ' + error.message);
      setResults({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const runFullSync = async () => {
    setTesting(true);
    setLogs(['Starting full sync...']);
    toast.loading('Synchronisiere alle Produkte...', { id: 'sync' });
    
    try {
      const response = await fetch('/api/shopify/sync', {
        method: 'POST',
      });
      
      const data = await response.json();
      setResults(data);
      
      if (data.success) {
        toast.success(data.message || 'Sync erfolgreich!', { id: 'sync' });
      } else {
        toast.error('Sync failed: ' + (data.error || 'Unknown error'), { id: 'sync' });
      }
    } catch (error: any) {
      toast.error('Sync failed: ' + error.message, { id: 'sync' });
      setResults({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6">Shopify Connection Test</h1>
          
          <div className="space-y-4">
            {/* Test Buttons */}
            <div className="flex gap-4">
              <button
                onClick={testConnection}
                disabled={testing}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {testing ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <AlertCircle size={20} />
                )}
                Test Connection
              </button>
              
              <button
                onClick={runFullSync}
                disabled={testing}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {testing ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  <RefreshCw size={20} />
                )}
                Run Full Sync
              </button>
            </div>

            {/* Environment Variables Check */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="font-semibold mb-3">Environment Check</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">SHOPIFY_STORE_DOMAIN:</span>
                  <span className="text-gray-600">Check in Vercel Dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">SHOPIFY_ACCESS_TOKEN:</span>
                  <span className="text-gray-600">Check in Vercel Dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">SHOPIFY_API_VERSION:</span>
                  <span className="text-gray-600">2024-01</span>
                </div>
              </div>
            </div>

            {/* Results */}
            {results && (
              <div className={`rounded-lg p-4 ${results.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-start gap-3">
                  {results.success ? (
                    <CheckCircle className="text-green-600 mt-1" size={20} />
                  ) : (
                    <XCircle className="text-red-600 mt-1" size={20} />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2">
                      {results.success ? 'Success' : 'Error'}
                    </h3>
                    
                    {results.message && (
                      <p className="text-sm mb-2">{results.message}</p>
                    )}
                    
                    {results.error && (
                      <p className="text-sm text-red-800 mb-2">{results.error}</p>
                    )}
                    
                    {results.results && (
                      <div className="mt-3 space-y-1 text-sm">
                        <p>Total Products: {results.results.totalProducts}</p>
                        <p>Created: {results.results.created}</p>
                        <p>Updated: {results.results.updated}</p>
                        <p>Errors: {results.results.errors}</p>
                        <p>Inventory Items: {results.results.inventoryItemsProcessed}</p>
                      </div>
                    )}
                    
                    {results.details && (
                      <pre className="mt-3 text-xs bg-white p-2 rounded overflow-auto">
                        {JSON.stringify(results.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Console Logs */}
            {logs.length > 0 && (
              <div className="bg-gray-900 text-green-400 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">Console Output</h3>
                <div className="font-mono text-xs space-y-1">
                  {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Troubleshooting</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Check Browser Console (F12) for detailed logs</li>
                <li>Verify environment variables in Vercel Dashboard</li>
                <li>Ensure Shopify Access Token has correct permissions</li>
                <li>Check if API version (2024-01) is correct</li>
                <li>Try "Test Connection" first, then "Run Full Sync"</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}