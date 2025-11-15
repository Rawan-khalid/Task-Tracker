import React, { useState, useEffect, useCallback } from 'react';
import { Task, FollowUp, Document, TaskStatus } from '../types';
import { Icon } from './Icons';

interface TaskDetailProps {
  task: Task;
  onUpdateTask: (updatedTask: Task) => void;
  onDeleteTask: (id: string) => void;
}

// Helper to format ISO string for datetime-local input
const toDateTimeLocal = (isoString: string | undefined) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  // Adjust for timezone offset
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  return localISOTime;
};

export const TaskDetail: React.FC<TaskDetailProps> = ({ task, onUpdateTask, onDeleteTask }) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [details, setDetails] = useState(task.details);
  const [newFollowUp, setNewFollowUp] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAddingDocument, setIsAddingDocument] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');

  useEffect(() => {
    setTitle(task.title);
    setDetails(task.details);
    if(isAddingDocument) {
      handleCancelAddDocument();
    }
  }, [task]);

  const handleDetailsChange = useCallback(
    (newDetails: string) => {
      setDetails(newDetails);
      onUpdateTask({ ...task, details: newDetails });
    },
    [task, onUpdateTask]
  );

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (title.trim()) {
      onUpdateTask({ ...task, title: title.trim() });
    } else {
      setTitle(task.title); // revert if empty
    }
  };

  const handleDateChange = (field: 'created_at' | 'closed_at', value: string) => {
    const newDate = value ? new Date(value).toISOString() : undefined;
    onUpdateTask({ ...task, [field]: newDate });
  };

  const handleAddFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFollowUp.trim()) {
      const followUp: FollowUp = {
        id: `fu_${Date.now()}_${Math.random()}`,
        text: newFollowUp.trim(),
        completed: false,
      };
      onUpdateTask({ ...task, follow_ups: [...task.follow_ups, followUp] });
      setNewFollowUp('');
    }
  };

  const handleToggleFollowUp = (id: string) => {
    const updatedFollowUps = task.follow_ups.map(f =>
      f.id === id ? { ...f, completed: !f.completed } : f
    );
    onUpdateTask({ ...task, follow_ups: updatedFollowUps });
  };

  const handleDeleteFollowUp = (id: string) => {
    const updatedFollowUps = task.follow_ups.filter(f => f.id !== id);
    onUpdateTask({ ...task, follow_ups: updatedFollowUps });
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDocName.trim() && newDocUrl.trim()) {
      try {
        new URL(newDocUrl); // Basic URL validation
        const newDocument: Document = {
          id: `doc_${Date.now()}_${Math.random()}`,
          name: newDocName.trim(),
          url: newDocUrl.trim(),
        };
        onUpdateTask({ ...task, documents: [...task.documents, newDocument] });
        handleCancelAddDocument();
      } catch (error) {
        alert('Please enter a valid URL.');
      }
    }
  };

  const handleCancelAddDocument = () => {
    setIsAddingDocument(false);
    setNewDocName('');
    setNewDocUrl('');
  };

  const handleDeleteDocument = (id: string) => {
    const updatedDocuments = task.documents.filter(doc => doc.id !== id);
    onUpdateTask({ ...task, documents: updatedDocuments });
  };


  const timeTaken = () => {
    if (!task.closed_at) return 'In progress';
    const start = new Date(task.created_at).getTime();
    const end = new Date(task.closed_at).getTime();
    const diff = end - start;
    if (diff < 0) return 'Invalid dates';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    return `${days}d ${hours}h ${minutes}m`;
  };

  const confirmDelete = () => {
    onDeleteTask(task.id);
    setShowDeleteConfirm(false);
  };
  
  const incompleteFollowUpsCount = task.follow_ups.filter(f => !f.completed).length;

  if (!task) {
    return (
      <div className="h-full bg-white p-4 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Icon name="document" className="w-16 h-16 mx-auto text-slate-300" />
          <p className="mt-4 text-lg">Select a task to see details</p>
          <p>Focus on what matters most.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full bg-white p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          {editingTitle ? (
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => e.key === 'Enter' && handleTitleBlur()}
              className="text-2xl font-bold text-slate-800 w-full border-b-2 border-blue-500 focus:outline-none bg-white"
              autoFocus
            />
          ) : (
            <h1
              onClick={() => setEditingTitle(true)}
              className="text-2xl font-bold text-slate-800 cursor-pointer flex items-center gap-2"
            >
              {task.title} <Icon name="edit" className="w-4 h-4 text-slate-400" />
            </h1>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-full hover:bg-red-100"
          >
            <Icon name="trash" className="w-5 h-5 text-red-500" />
          </button>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold text-slate-600 mb-2">Details</h3>
          <textarea
            value={details}
            onChange={e => handleDetailsChange(e.target.value)}
            placeholder="Add task details, notes, or links..."
            className="w-full h-32 p-2 border bg-white border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-700 leading-relaxed"
          />
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">
              Created At
            </label>
            <input
              type="datetime-local"
              value={toDateTimeLocal(task.created_at)}
              onChange={e => handleDateChange('created_at', e.target.value)}
              className="w-full p-2 border bg-white border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">
              Closed At
            </label>
            <input
              type="datetime-local"
              value={toDateTimeLocal(task.closed_at)}
              onChange={e => handleDateChange('closed_at', e.target.value)}
              className="w-full p-2 border bg-white border-slate-200 rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-slate-600">
              <strong>Time Taken:</strong>{' '}
              <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                {timeTaken()}
              </span>
            </p>
          </div>
          {task.status !== TaskStatus.Done && incompleteFollowUpsCount > 0 && (
            <div className="md:col-span-2">
              <p className="text-sm text-slate-600">
                <strong>Pending On:</strong>{' '}
                <span className="font-mono bg-amber-100 text-amber-800 px-2 py-1 rounded">
                  {incompleteFollowUpsCount} incomplete follow-up{incompleteFollowUpsCount > 1 ? 's' : ''}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="mb-6">
          <h3 className="font-semibold text-slate-600 mb-2">Follow-ups</h3>
          <div className="space-y-2">
            {task.follow_ups.map(fu => (
              <div key={fu.id} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={fu.completed}
                  onChange={() => handleToggleFollowUp(fu.id)}
                  className="w-5 h-5 accent-blue-500"
                />
                <span
                  className={`flex-grow ${
                    fu.completed ? 'line-through text-slate-500' : 'text-slate-800'
                  }`}
                >
                  {fu.text}
                </span>
                <button
                  onClick={() => handleDeleteFollowUp(fu.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100"
                >
                  <Icon name="trash" className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddFollowUp} className="flex gap-2 mt-2">
            <input
              value={newFollowUp}
              onChange={e => setNewFollowUp(e.target.value)}
              type="text"
              placeholder="Add a follow-up item..."
              className="flex-grow p-2 border bg-white border-slate-200 rounded-lg text-sm"
            />
            <button
              type="submit"
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <Icon name="plus" className="w-5 h-5" />
            </button>
          </form>
        </div>

        <div>
          <h3 className="font-semibold text-slate-600 mb-2">Documents</h3>
          <div className="space-y-2 text-sm">
            {task.documents.length > 0 ? (
              task.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg group">
                  <Icon name="document" className="w-5 h-5 text-slate-500" />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-grow text-blue-600 hover:underline truncate"
                    title={doc.url}
                  >
                    {doc.name}
                  </a>
                   <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-100 transition-opacity"
                    title="Delete document"
                  >
                    <Icon name="trash" className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))
            ) : (
              !isAddingDocument && <p className="text-slate-500 italic">No documents attached.</p>
            )}
          </div>
          {!isAddingDocument ? (
             <button onClick={() => setIsAddingDocument(true)} className="mt-2 text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Icon name="document-add" className="w-4 h-4"/>
                Attach Document
            </button>
          ) : (
            <form onSubmit={handleAddDocument} className="mt-2 p-3 bg-slate-100 rounded-lg flex flex-col gap-2 animate-fade-in">
              <input
                type="text"
                placeholder="Document Name (e.g., 'Design Mockups')"
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
                className="p-2 border bg-white border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
                autoFocus
              />
              <input
                type="url"
                placeholder="URL (e.g., https://figma.com/...)"
                value={newDocUrl}
                onChange={e => setNewDocUrl(e.target.value)}
                className="p-2 border bg-white border-slate-200 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={handleCancelAddDocument} className="px-3 py-1 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600">
                  Save Document
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Icon name="trash" className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Delete this task?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This will permanently delete this task and all related follow-ups/documents.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};