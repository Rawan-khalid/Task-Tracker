import React, { useState } from 'react';
import { Icon } from './Icons';

interface SheetSetupProps {
  onConnect: (spreadsheetId: string) => void;
}

const extractSheetIdFromUrl = (url: string): string | null => {
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(url);
  return match ? match[1] : null;
};

export const SheetSetup: React.FC<SheetSetupProps> = ({ onConnect }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleConnect = () => {
    if (!url.trim()) {
      setError('Please enter a Google Sheet URL.');
      return;
    }
    try {
      const sheetId = extractSheetIdFromUrl(url);
      if (sheetId) {
        setError('');
        onConnect(sheetId);
      } else {
        setError('Invalid Google Sheet URL. Please make sure it looks like "https://docs.google.com/spreadsheets/d/..."');
      }
    } catch (e) {
      setError('Invalid URL provided.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleConnect();
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-lg w-full border border-slate-200">
        <div className="text-center">
            <Icon name="document-add" className="w-12 h-12 mx-auto text-blue-500" />
            <h1 className="text-2xl font-bold text-slate-800 mt-4">Connect Your Google Sheet</h1>
            <p className="text-slate-600 mt-2">
                This app uses a Google Sheet as its database. Please create a new, empty sheet and paste its URL below.
            </p>
             <a 
                href="https://sheets.new" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm mt-2 inline-block"
            >
                Click here to create a new sheet
            </a>
        </div>
        <form onSubmit={handleFormSubmit} className="mt-6">
          <div>
            <label htmlFor="sheet-url" className="block text-sm font-medium text-slate-700">
              Google Sheet URL
            </label>
            <div className="mt-1">
              <input
                type="url"
                id="sheet-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          </div>
          <div className="mt-6">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Connect and Start
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
