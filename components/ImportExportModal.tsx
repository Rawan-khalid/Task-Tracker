import React, { useState } from 'react';
import { Project, Task } from '../types';
import { Icon } from './Icons';
import { supabase } from '../supabaseClient';

declare var Papa: any;

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  tasks: Task[];
  userId: string;
  onImportSuccess: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({ isOpen, onClose, projects, tasks, userId, onImportSuccess }) => {
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [taskFile, setTaskFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const downloadCSV = (data: any[], filename: string) => {
    // Stringify JSON fields
    const dataWithStringifiedJson = data.map(row => {
        const newRow = {...row};
        if (newRow.documents) newRow.documents = JSON.stringify(newRow.documents);
        if (newRow.follow_ups) newRow.follow_ups = JSON.stringify(newRow.follow_ups);
        return newRow;
    });

    const csv = Papa.unparse(dataWithStringifiedJson);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!projectFile || !taskFile) {
        setError('Please select both a project and a task file.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
        // FIX: Changed generic type from Project/Task to any to handle raw CSV data without type errors.
        const projectsData = await parseCsvFile<any>(projectFile);
        const tasksData = await parseCsvFile<any>(taskFile);
        
        // Sanitize and enrich projects data
        const sanitizedProjects = projectsData
            .filter(p => p.id && p.name)
            .map(p => ({ ...p, user_id: userId }));

        // Sanitize and enrich tasks data
        const sanitizedTasks = tasksData
            .filter(t => t.id && t.title && t.project_id)
            .map(t => {
            try {
                // FIX: Cast the sanitized object to Task to ensure type compatibility for the subsequent filter.
                return {
                    ...t,
                    user_id: userId,
                    order: typeof t.order === 'number' ? t.order : parseInt(String(t.order) || '0', 10),
                    is_priority: t.is_priority === true || String(t.is_priority).toLowerCase() === 'true',
                    // FIX: `t` is now `any`, so `t.documents` is `any`. `startsWith` can be called after a type check. This resolves the "does not exist on type 'never'" error.
                    documents: typeof t.documents === 'string' && t.documents.startsWith('[') ? JSON.parse(t.documents) : [],
                    // FIX: `t` is now `any`, so `t.follow_ups` is `any`. `startsWith` can be called after a type check. This resolves the "does not exist on type 'never'" error.
                    follow_ups: typeof t.follow_ups === 'string' && t.follow_ups.startsWith('[') ? JSON.parse(t.follow_ups) : [],
                    closed_at: t.closed_at || null,
                } as Task;
            } catch (e) {
                console.error("Skipping malformed task row:", t, e);
                return null;
            }
        // FIX: The type predicate is now valid because the map function returns `(Task | null)[]`.
        }).filter((t): t is Task => t !== null);
        
        console.log("Upserting projects:", sanitizedProjects);
        const { error: projectError } = await supabase.from('projects').upsert(sanitizedProjects);
        if (projectError) throw new Error(`Project import failed: ${projectError.message}`);

        console.log("Upserting tasks:", sanitizedTasks);
        const { error: taskError } = await supabase.from('tasks').upsert(sanitizedTasks);
        if (taskError) throw new Error(`Task import failed: ${taskError.message}`);
        
        setSuccess('Data imported successfully! The page will now refresh.');
        setTimeout(() => {
            onImportSuccess();
            onClose();
        }, 1500);

    } catch (e: any) {
        setError(e.message || 'An unexpected error occurred during import.');
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const parseCsvFile = <T extends {}>(file: File): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: (results: any) => {
                if(results.errors.length) {
                    reject(new Error(`Error parsing ${file.name}: ${results.errors[0].message}`));
                } else {
                    resolve(results.data as T[]);
                }
            },
            error: (error: any) => {
                reject(new Error(`Failed to parse ${file.name}: ${error.message}`));
            }
        });
    });
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h2 className="text-xl font-bold text-slate-800">Import & Export Data</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* EXPORT SECTION */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Export to CSV</h3>
            <p className="text-sm text-slate-500 mb-3">Download your data as CSV files, which can be opened in Google Sheets or Excel. This is a great way to create a backup.</p>
            <div className="flex gap-4">
              <button onClick={() => downloadCSV(projects, 'projects.csv')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-600 text-white hover:bg-slate-700">
                <Icon name="download" className="w-4 h-4" />
                Export Projects
              </button>
              <button onClick={() => downloadCSV(tasks, 'tasks.csv')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-600 text-white hover:bg-slate-700">
                <Icon name="download" className="w-4 h-4" />
                Export Tasks
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200" />

          {/* IMPORT SECTION */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-2">Import from CSV</h3>
            <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg mb-3">
                <p className="text-sm text-amber-800">
                    <strong>Warning:</strong> Importing will update existing items that have matching IDs and create new ones for those that don't. It's recommended to export a backup first.
                </p>
            </div>
            <div className="space-y-3">
               <div>
                 <label className="text-sm font-medium text-slate-600 block mb-1">Projects CSV File</label>
                 <input type="file" accept=".csv" onChange={(e) => setProjectFile(e.target.files ? e.target.files[0] : null)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-full"/>
               </div>
               <div>
                 <label className="text-sm font-medium text-slate-600 block mb-1">Tasks CSV File</label>
                 <input type="file" accept=".csv" onChange={(e) => setTaskFile(e.target.files ? e.target.files[0] : null)} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 w-full"/>
               </div>
            </div>
            <button
              onClick={handleImport}
              disabled={!projectFile || !taskFile || isLoading}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <Icon name="upload" className="w-4 h-4" />
                  Import Data
                </>
              )}
            </button>
            {error && <p className="text-sm text-red-600 mt-2 text-center">{error}</p>}
            {success && <p className="text-sm text-green-600 mt-2 text-center">{success}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
