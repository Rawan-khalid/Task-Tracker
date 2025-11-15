
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, ProjectStatus } from '../types';
import { Icon } from './Icons';

interface ProjectViewProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onAddProject: (name: string, parentId: string | null) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProject: (id: string, newName: string) => void;
  onUpdateProjectStatus: (id: string, status: ProjectStatus) => void;
  onAddTask: (title: string, projectId: string) => void;
  onReassignTask: (taskId: string, newProjectId: string) => void;
  onReassignProject: (projectId: string, newParentId: string | null) => void;
  onCollapse: () => void;
}

const statusConfig: { [key in ProjectStatus]: { color: string; label: string; icon: 'folder' | 'pause' | 'archive' } } = {
  [ProjectStatus.NotStarted]: { color: 'text-slate-500', label: 'Not Started', icon: 'folder' },
  [ProjectStatus.Open]: { color: 'text-blue-600', label: 'Open', icon: 'folder' },
  [ProjectStatus.OnHold]: { color: 'text-slate-500', label: 'On Hold', icon: 'pause' },
  [ProjectStatus.Archived]: { color: 'text-gray-400', label: 'Archived', icon: 'archive' },
};

const statusOrder: { [key in ProjectStatus]: number } = {
  [ProjectStatus.Open]: 0,
  [ProjectStatus.NotStarted]: 1,
  [ProjectStatus.OnHold]: 2,
  [ProjectStatus.Archived]: 3,
};

const sortProjects = (a: Project, b: Project): number => {
  const statusComparison = statusOrder[a.status] - statusOrder[b.status];
  if (statusComparison !== 0) {
    return statusComparison;
  }
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};


const ProjectItem: React.FC<{
  project: Project;
  allProjects: Project[];
  level: number;
  onInitiateDelete: (project: Project) => void;
  searchQuery: string;
} & Omit<ProjectViewProps, 'projects' | 'onCollapse'>> = ({
  project,
  allProjects,
  level,
  selectedProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onUpdateProject,
  onUpdateProjectStatus,
  onAddTask,
  onReassignTask,
  onReassignProject,
  onInitiateDelete,
  searchQuery,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubProjectName, setNewSubProjectName] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(project.name);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const showExpanded = !!searchQuery || isExpanded;

  const childProjects = allProjects.filter(p => p.parentId === project.id).sort(sortProjects);
  const hasChildren = childProjects.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
            setIsStatusMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddSubProject = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newSubProjectName.trim()) {
      onAddProject(newSubProjectName.trim(), project.id);
      setNewSubProjectName('');
      setIsAddingSub(false);
      setIsExpanded(true);
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (newTaskName.trim()) {
      onAddTask(newTaskName.trim(), project.id);
      setNewTaskName('');
      setIsAddingTask(false);
      if (selectedProjectId !== project.id) {
        onSelectProject(project.id);
      }
    }
  };
  
  const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onInitiateDelete(project);
  }
  
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('projectId', project.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
        onReassignTask(taskId, project.id);
        return;
    }

    const projectId = e.dataTransfer.getData('projectId');
    if (projectId && projectId !== project.id) {
        onReassignProject(projectId, project.id);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleSelectAndToggle = () => {
    if (isEditing) return;
    onSelectProject(project.id);
    if (hasChildren && !searchQuery) {
      setIsExpanded(prev => !prev);
    }
  };

  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(project.name);
    setIsEditing(true);
  };

  const handleUpdateName = () => {
    if (editedName.trim() && editedName.trim() !== project.name) {
      onUpdateProject(project.id, editedName.trim());
    }
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setEditedName(project.name);
    setIsEditing(false);
  };

  const handleEditFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateName();
  };

  const config = statusConfig[project.status];
  const iconColor = selectedProjectId === project.id ? 'text-blue-800' : config.color;

  return (
    <div>
      <div
        onClick={handleSelectAndToggle}
        draggable
        onDragStart={handleDragStart}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer group transition-all duration-150
            ${isDragOver ? 'bg-blue-100 ring-2 ring-blue-400 ring-dashed' : 
            selectedProjectId === project.id ? 'bg-blue-200 text-blue-800' : 'hover:bg-slate-200'}
            ${(project.status === ProjectStatus.Archived || project.status === ProjectStatus.OnHold) ? 'opacity-60 hover:opacity-100' : ''}`}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
      >
        <div className="flex items-center gap-2 flex-grow min-w-0">
          {hasChildren ? (
            <Icon name={showExpanded ? 'chevron-down' : 'chevron-right'} className="w-4 h-4 text-slate-500 flex-shrink-0" />
          ) : (
            <div className="w-4 flex-shrink-0"></div>
          )}
          <Icon name={showExpanded && hasChildren ? 'folder-open' : config.icon} className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
          {isEditing ? (
            <form onSubmit={handleEditFormSubmit} className="flex-grow">
              <input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                onBlur={handleUpdateName}
                onKeyDown={e => e.key === 'Escape' && handleCancelEdit()}
                onClick={e => e.stopPropagation()}
                autoFocus
                className="w-full bg-white border border-blue-500 rounded px-1 -my-1 text-sm"
              />
            </form>
          ) : (
            <span className="flex-grow truncate" title={project.name}>{project.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button onClick={(e) => { e.stopPropagation(); setIsAddingTask(true); }} className="p-1 rounded hover:bg-slate-300" title="Add task">
            <Icon name="document-add" className="w-4 h-4" />
          </button>
          <button onClick={handleStartEditing} className="p-1 rounded hover:bg-slate-300" title="Edit project name">
            <Icon name="edit" className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsAddingSub(true); }} className="p-1 rounded hover:bg-slate-300" title="Add sub-project">
            <Icon name="plus" className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} className="p-1 rounded hover:bg-red-200" title="Delete project">
            <Icon name="trash" className="w-4 h-4 text-red-600" />
          </button>
          <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsStatusMenuOpen(prev => !prev);
                }}
                className="p-1 rounded hover:bg-slate-300"
                title="Change status"
              >
                <Icon name="dots-vertical" className="w-4 h-4" />
              </button>
              {isStatusMenuOpen && (
                <div 
                  ref={statusMenuRef}
                  className="absolute right-0 top-full mt-1 z-20 w-40 bg-white rounded-md shadow-lg border border-slate-200"
                >
                    <p className="px-3 py-1 text-xs font-semibold text-slate-500 border-b border-slate-100">Set status</p>
                    <ul>
                      {Object.values(ProjectStatus).map(status => (
                        <li key={status}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateProjectStatus(project.id, status);
                              setIsStatusMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 flex items-center gap-2"
                          >
                            <div className="w-4">
                                {project.status === status && <Icon name="check" className="w-4 h-4 text-blue-500" />}
                            </div>
                            <span className="flex-1">{statusConfig[status].label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                </div>
              )}
            </div>
        </div>
      </div>
       {isAddingTask && (
        <form onSubmit={handleAddTask} style={{ paddingLeft: `${(level + 1) * 1.5 + 0.5}rem` }} className="py-1">
          <input
            type="text"
            autoFocus
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            onBlur={() => setIsAddingTask(false)}
            onKeyDown={e => e.key === 'Escape' && setIsAddingTask(false)}
            placeholder="New task..."
            className="w-full px-2 py-1 text-sm bg-white border rounded"
          />
        </form>
      )}
      {isAddingSub && (
        <form onSubmit={handleAddSubProject} style={{ paddingLeft: `${(level + 1) * 1.5 + 0.5}rem` }} className="py-1">
          <input
            type="text"
            autoFocus
            value={newSubProjectName}
            onChange={(e) => setNewSubProjectName(e.target.value)}
            onBlur={() => setIsAddingSub(false)}
            onKeyDown={e => e.key === 'Escape' && setIsAddingSub(false)}
            placeholder="New sub-project..."
            className="w-full px-2 py-1 text-sm bg-white border rounded"
          />
        </form>
      )}
      {showExpanded && hasChildren && (
        <div>
          {childProjects.map(child => (
            <ProjectItem
              key={child.id}
              project={child}
              allProjects={allProjects}
              level={level + 1}
              selectedProjectId={selectedProjectId}
              onSelectProject={onSelectProject}
              onAddProject={onAddProject}
              onDeleteProject={onDeleteProject}
              onUpdateProject={onUpdateProject}
              onUpdateProjectStatus={onUpdateProjectStatus}
              onAddTask={onAddTask}
              onReassignTask={onReassignTask}
              onReassignProject={onReassignProject}
              onInitiateDelete={onInitiateDelete}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ProjectView: React.FC<ProjectViewProps> = ({ projects, onCollapse, ...props }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const projectsById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) {
      return projects;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const matchingIds = new Set<string>();
    for (const project of projects) {
      if (project.name.toLowerCase().includes(lowerCaseQuery)) {
        matchingIds.add(project.id);
      }
    }
    const displayIds = new Set<string>(matchingIds);
    for (const id of matchingIds) {
      let current = projectsById.get(id);
      while (current && current.parentId) {
        displayIds.add(current.parentId);
        current = projectsById.get(current.parentId);
      }
    }
    return projects.filter(p => displayIds.has(p.id));
  }, [searchQuery, projects, projectsById]);
  
  const rootProjects = filteredProjects.filter(p => p.parentId === null).sort(sortProjects);

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      props.onAddProject(newProjectName.trim(), null);
      setNewProjectName('');
      setIsAdding(false);
    }
  };

  const handleInitiateDelete = (project: Project) => {
    setProjectToDelete(project);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      props.onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  const cancelDelete = () => {
    setProjectToDelete(null);
  };
  
  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsRootDragOver(false);
    const projectId = e.dataTransfer.getData('projectId');
    // FIX: Corrected a typo in `e.dataTransfer`.
    const taskId = e.dataTransfer.getData('taskId');
    if (projectId && !taskId) { // It's a project, not a task
        props.onReassignProject(projectId, null);
    }
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsRootDragOver(true);
  };
  
  const handleRootDragLeave = (e: React.DragEvent) => {
    setIsRootDragOver(false);
  };

  return (
    <div className="h-full bg-slate-50 border-r border-slate-200 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-slate-800">Projects</h2>
        <button onClick={onCollapse} className="p-1 rounded-full hover:bg-slate-200 -mr-1" title="Collapse projects panel">
          <Icon name="panel-left-close" className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-2 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </div>
      </div>
      <div 
        className={`flex-grow overflow-y-auto space-y-1 p-1 -m-1 rounded-lg transition-colors ${isRootDragOver ? 'bg-blue-100 ring-2 ring-blue-400 ring-dashed' : ''}`}
        onDrop={handleRootDrop}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
      >
        {rootProjects.length > 0 ? (
          rootProjects.map(project => (
            <ProjectItem 
              key={project.id} 
              project={project} 
              allProjects={filteredProjects} 
              level={0} 
              {...props} 
              onInitiateDelete={handleInitiateDelete}
              searchQuery={searchQuery}
            />
          ))
        ) : (
           <div className="text-center text-slate-500 pt-10">
            <p>
                {searchQuery ? 'No projects found.' : 'Create a project to get started.'}
            </p>
          </div>
        )}
        {isAdding && (
          <form onSubmit={handleAddProject} className="mt-1">
            <input
              type="text"
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onBlur={() => setIsAdding(false)}
              onKeyDown={e => e.key === 'Escape' && setIsAdding(false)}
              placeholder="New project name..."
              className="w-full px-2 py-1 text-sm bg-white border rounded"
            />
          </form>
        )}
      </div>
       <button onClick={() => setIsAdding(true)} className="mt-4 flex items-center justify-center gap-2 w-full p-2 text-sm text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
        <Icon name="plus" className="w-4 h-4" />
        Add Project
      </button>

      {projectToDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Icon name="trash" className="w-6 h-6 text-red-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Delete "{projectToDelete.name}"?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This will permanently delete this project, all its sub-projects, and all related tasks.
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={cancelDelete}
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
    </div>
  );
};
