import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Project, Task, TaskStatus, ProjectStatus } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { ProjectView } from './components/ProjectView';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { Icon } from './components/Icons';
import { googleSheetsService } from './services/googleSheets';
import { SheetSetup } from './components/SheetSetup';

const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center h-full w-full">
        <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="mt-4 text-slate-600">{message}</p>
    </div>
);

function App() {
  const [spreadsheetId, setSpreadsheetId] = useLocalStorage<string | null>('spreadsheetId', null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isProjectPanelCollapsed, setIsProjectPanelCollapsed] = useState(false);
  const [view, setView] = useState<'projects' | 'today'>('projects');
  
  const [authInited, setAuthInited] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { projects, tasks } = await googleSheetsService.loadData(id);
      setProjects(projects);
      setTasks(tasks);
      if (view === 'today') {
        const firstTask = tasks.find(t => t.isPriority) || tasks.find(t => t.status !== TaskStatus.Done);
        if(firstTask) handleSelectTask(firstTask.id);
      } else if (projects.length > 0) {
        handleSelectProject(selectedProjectId || projects[0].id);
      }
    } catch (e: any) {
      console.error(e);
      if (e.result?.error?.message) {
        setError(`Error loading data: ${e.result.error.message}. Please check Sheet permissions.`);
      } else {
        setError("Could not load data from Google Sheet. Ensure the URL is correct and you have granted permissions.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId, view]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await googleSheetsService.initClient((signedIn) => {
          setIsSignedIn(signedIn);
          if (signedIn && spreadsheetId) {
            loadData(spreadsheetId);
          } else {
            setIsLoading(false);
          }
        });
        setAuthInited(true);
      } catch (e) {
        console.error("Error initializing auth", e);
        setError("Could not initialize Google authentication.");
        setIsLoading(false);
      }
    };
    initAuth();
  }, [spreadsheetId, loadData]);
  
  const handleSetSpreadsheetId = (id: string) => {
    setSpreadsheetId(id);
    if(isSignedIn) {
      loadData(id);
    }
  }

  const handleSignIn = () => {
    googleSheetsService.handleSignIn();
  };

  const handleSignOut = () => {
    googleSheetsService.handleSignOut();
  };
  
  const handleAddProject = async (name: string, parentId: string | null) => {
    setIsSaving(true);
    const newProject: Project = { id: `proj_${Date.now()}_${Math.random()}`, name, parentId, status: ProjectStatus.NotStarted, createdAt: new Date().toISOString() };
    try {
        await googleSheetsService.appendRow('Projects', newProject);
        setProjects(prev => [...prev, newProject]);
    } catch (e) {
        console.error(e);
        setError("Failed to save new project.");
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleDeleteProject = async (id: string) => {
    setIsSaving(true);
    
    // Create new state in memory first
    const projectsToDelete = new Set<string>();
    const queue: string[] = [id];
    projectsToDelete.add(id);

    while(queue.length > 0) {
      const currentId = queue.shift()!;
      const children = projects.filter(p => p.parentId === currentId);
      for (const child of children) {
        projectsToDelete.add(child.id);
        queue.push(child.id);
      }
    }

    const newProjects = projects.filter(p => !projectsToDelete.has(p.id));
    const newTasks = tasks.filter(t => !projectsToDelete.has(t.projectId));

    try {
        await googleSheetsService.writeData('Projects', newProjects);
        await googleSheetsService.writeData('Tasks', newTasks);
        
        setProjects(newProjects);
        setTasks(newTasks);

        if (selectedProjectId && projectsToDelete.has(selectedProjectId)) {
            setSelectedProjectId(null);
            setSelectedTaskId(null);
        }
    } catch (e) {
        console.error(e);
        setError("Failed to delete project.");
    } finally {
        setIsSaving(false);
    }
  };

  const updateHelper = async <T extends {id: string}>(
      sheetName: 'Projects' | 'Tasks', 
      id: string, 
      updatedFields: Partial<T>,
      stateSetter: React.Dispatch<React.SetStateAction<T[]>>
  ) => {
    setIsSaving(true);
    let updatedItem: T | undefined;
    
    stateSetter(prev => {
        const newItems = prev.map(p => {
            if (p.id === id) {
                updatedItem = { ...p, ...updatedFields };
                return updatedItem;
            }
            return p;
        });
        return newItems;
    });

    if (updatedItem) {
        try {
            await googleSheetsService.updateRow(sheetName, id, updatedItem);
        } catch (e) {
            console.error(e);
            setError(`Failed to update ${sheetName.slice(0, -1).toLowerCase()}. Reverting.`);
            // Revert on failure
            stateSetter(prev => prev.map(p => p.id === id ? { ...p, ...updatedItem, ...updatedFields } : p));
        } finally {
            setIsSaving(false);
        }
    } else {
        setIsSaving(false);
    }
  };

  const handleUpdateProject = (projectId: string, newName: string) => 
    updateHelper<Project>('Projects', projectId, { name: newName }, setProjects);

  const handleUpdateProjectStatus = (projectId: string, status: ProjectStatus) => 
    updateHelper<Project>('Projects', projectId, { status }, setProjects);

  const handleAddTask = async (title: string, projectId: string) => {
    setIsSaving(true);
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    const newOrder = projectTasks.length > 0 ? Math.max(...projectTasks.map(t => t.order)) + 1 : 0;
    const newTask: Task = {
      id: `task_${Date.now()}_${Math.random()}`,
      title,
      projectId,
      details: '',
      status: TaskStatus.ToDo,
      createdAt: new Date().toISOString(),
      documents: [],
      followUps: [],
      order: newOrder,
    };

    try {
        await googleSheetsService.appendRow('Tasks', newTask);
        setTasks(prev => [...prev, newTask]);
        setSelectedTaskId(newTask.id);
    } catch (e) {
        console.error(e);
        setError("Failed to save new task.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleUpdateTask = (updatedTask: Task) => 
    updateHelper<Task>('Tasks', updatedTask.id, updatedTask, setTasks);

  const handleUpdateTaskStatus = (id: string, status: TaskStatus) => {
     const task = tasks.find(t => t.id === id);
     if (task) {
        const updatedFields = { 
          status, 
          closedAt: status === TaskStatus.Done ? (task.closedAt || new Date().toISOString()) : undefined,
        };
        updateHelper<Task>('Tasks', id, updatedFields, setTasks);
     }
  };
  
  const handleDeleteTask = async (id: string) => {
    setIsSaving(true);
    const newTasks = tasks.filter(t => t.id !== id);
    try {
        await googleSheetsService.deleteRow('Tasks', id);
        setTasks(newTasks);
        if (selectedTaskId === id) {
            const tasksForSelection = view === 'today'
                ? todayTasks.filter(t => t.id !== id)
                : filteredTasks.filter(t => t.id !== id);
            setSelectedTaskId(tasksForSelection.length > 0 ? tasksForSelection[0].id : null);
        }
    } catch (e) {
        console.error(e);
        setError("Failed to delete task.");
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleReassignTask = (taskId: string, newProjectId: string) => {
      const taskToMove = tasks.find(t => t.id === taskId);
      if (taskToMove && taskToMove.projectId !== newProjectId) {
        const projectTasks = tasks.filter(t => t.projectId === newProjectId);
        const newOrder = projectTasks.length > 0 ? Math.max(...projectTasks.map(t => t.order)) + 1 : 0;
        updateHelper<Task>('Tasks', taskId, { projectId: newProjectId, order: newOrder }, setTasks);
        setSelectedProjectId(newProjectId);
        setSelectedTaskId(taskId);
      }
  };
  
   const handleReorderTask = useCallback((taskId: string, targetTaskId: string, position: 'top' | 'bottom') => {
    setIsSaving(true);
    let newTasks: Task[] = [];
    setTasks(currentTasks => {
      const taskToMove = currentTasks.find(t => t.id === taskId);
      const targetTask = currentTasks.find(t => t.id === targetTaskId);

      if (!taskToMove || !targetTask || taskToMove.projectId !== targetTask.projectId) {
        return currentTasks;
      }
      const projectId = taskToMove.projectId;
      const projectTasks = currentTasks
        .filter(t => t.projectId === projectId)
        .sort((a, b) => a.order - b.order);

      const fromIndex = projectTasks.findIndex(t => t.id === taskId);
      const [movedItem] = projectTasks.splice(fromIndex, 1);

      const newToIndex = projectTasks.findIndex(t => t.id === targetTaskId);
      if (position === 'top') {
        projectTasks.splice(newToIndex, 0, movedItem);
      } else {
        projectTasks.splice(newToIndex + 1, 0, movedItem);
      }

      const newOrderMap = new Map<string, number>();
      projectTasks.forEach((task, index) => {
        newOrderMap.set(task.id, index);
      });
      
      newTasks = currentTasks.map(task => {
        if (task.projectId === projectId) {
          return { ...task, order: newOrderMap.get(task.id)! };
        }
        return task;
      });
      return newTasks;
    });

    googleSheetsService.writeData('Tasks', newTasks)
      .catch(e => {
        console.error(e);
        setError("Failed to reorder tasks.");
        loadData(spreadsheetId!); // Revert by reloading
      })
      .finally(() => setIsSaving(false));
  }, [setTasks, spreadsheetId, loadData]);

  const handleReassignProject = useCallback((projectId: string, newParentId: string | null) => {
    let isValidMove = true;
    if (projectId === newParentId) isValidMove = false;
    let currentParentId = newParentId;
    while (currentParentId !== null) {
      if (currentParentId === projectId) {
        isValidMove = false;
        break;
      }
      const parentProject = projects.find(p => p.id === currentParentId);
      currentParentId = parentProject ? parentProject.parentId : null;
    }
    if(isValidMove) {
        updateHelper<Project>('Projects', projectId, { parentId: newParentId }, setProjects);
    } else {
        console.error("Cannot move a project into one of its own descendants.");
    }
  }, [projects]);
  
  const handleSetTaskPriority = useCallback((taskId: string, isPriority: boolean) => {
    updateHelper<Task>('Tasks', taskId, { isPriority }, setTasks);
  }, []);

  const filteredTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter(task => task.projectId === selectedProjectId).sort((a, b) => a.order - b.order);
  }, [tasks, selectedProjectId]);
  
  const todayTasks = useMemo(() => {
    const openProjectIds = new Set(projects.filter(p => p.status === ProjectStatus.Open).map(p => p.id));
    return tasks
        .filter(task => openProjectIds.has(task.projectId) && task.status !== TaskStatus.Done)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [projects, tasks]);
  
  const todayTopPriorityTasks = useMemo(() => {
    return todayTasks.filter(task => task.isPriority).sort((a, b) => a.order - b.order);
  }, [todayTasks]);

  const todayOtherTasks = useMemo(() => {
    return todayTasks.filter(task => !task.isPriority);
  }, [todayTasks]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return undefined;
    const task = tasks.find(t => t.id === selectedTaskId);
    if (view === 'projects' && task?.projectId !== selectedProjectId) {
        return undefined;
    }
    return task;
  }, [tasks, selectedTaskId, selectedProjectId, view]);

  const handleSelectProject = (id: string | null) => {
    setSelectedProjectId(id);
    if (id) {
      const tasksForProject = tasks
        .filter(task => task.projectId === id)
        .sort((a, b) => a.order - b.order);
      
      if (tasksForProject.length > 0) {
        setSelectedTaskId(tasksForProject[0].id);
      } else {
        setSelectedTaskId(null);
      }
    } else {
      setSelectedTaskId(null);
    }
  };
  
  const handleSelectTask = (taskId: string | null) => {
    setSelectedTaskId(taskId);
    if (view === 'today' && taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            setSelectedProjectId(task.projectId);
        }
    }
  };
  
  const handleSetView = (newView: 'projects' | 'today') => {
    setView(newView);
    setSelectedTaskId(null);
    setSelectedProjectId(null);
    const firstTask = todayTopPriorityTasks[0] || todayOtherTasks[0];
    if (newView === 'today' && firstTask) {
        handleSelectTask(firstTask.id);
    }
  }

  const ViewSwitcherButton: React.FC<{
    targetView: 'projects' | 'today';
    label: string;
  }> = ({ targetView, label }) => (
    <button
      onClick={() => handleSetView(targetView)}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
        view === targetView
          ? 'bg-blue-600 text-white'
          : 'text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );

  const renderContent = () => {
    if (!spreadsheetId) {
        return <SheetSetup onConnect={handleSetSpreadsheetId} />;
    }
    if (!authInited || isLoading) {
        return <LoadingSpinner message={!authInited ? "Initializing authentication..." : "Loading data from sheet..."} />;
    }
    if (!isSignedIn) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full">
                <h2 className="text-xl font-semibold text-slate-700">Connect to Google Sheets</h2>
                <p className="text-slate-500 my-4 max-w-md text-center">To use this app, please sign in and grant permission to access your Google Sheet data.</p>
                <button 
                    onClick={handleSignIn}
                    className="flex items-center gap-3 bg-white border border-slate-300 rounded-lg px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                    <Icon name="google" className="w-6 h-6"/>
                    Sign in with Google
                </button>
            </div>
        )
    }

    if(error) {
        return (
             <div className="flex flex-col items-center justify-center h-full w-full p-8">
                <h2 className="text-xl font-semibold text-red-600">An Error Occurred</h2>
                <p className="text-slate-500 my-4 max-w-lg text-center bg-red-50 p-4 rounded-lg">{error}</p>
                <button
                    onClick={() => { setSpreadsheetId(null); setError(null); }}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                    Use a different sheet
                </button>
            </div>
        )
    }

    return (
        <main className="flex-grow grid grid-cols-1 md:grid-cols-12 overflow-hidden">
            {view === 'projects' && !isProjectPanelCollapsed && (
                <div className="md:col-span-3 lg:col-span-3 h-full overflow-y-auto">
                    <ProjectView 
                        projects={projects}
                        selectedProjectId={selectedProjectId}
                        onSelectProject={handleSelectProject}
                        onAddProject={handleAddProject}
                        onDeleteProject={handleDeleteProject}
                        onUpdateProject={handleUpdateProject}
                        onUpdateProjectStatus={handleUpdateProjectStatus}
                        onAddTask={handleAddTask}
                        onReassignTask={handleReassignTask}
                        onReassignProject={handleReassignProject}
                        onCollapse={() => setIsProjectPanelCollapsed(true)}
                    />
                </div>
            )}
            <div className={`${(view === 'today' || (view === 'projects' && isProjectPanelCollapsed)) ? 'md:col-span-5 lg:col-span-5' : 'md:col-span-4 lg:col-span-4'} h-full overflow-y-auto transition-all duration-300`}>
                <TaskList
                    tasks={view === 'today' ? todayOtherTasks : filteredTasks}
                    priorityTasks={view === 'today' ? todayTopPriorityTasks : undefined}
                    projects={projects}
                    title={view === 'today' ? "Today's Focus" : "Tasks"}
                    canAddTask={view === 'projects' && !!selectedProjectId}
                    selectedTaskId={selectedTaskId}
                    selectedProjectId={selectedProjectId}
                    onSelectTask={handleSelectTask}
                    onAddTask={handleAddTask}
                    onUpdateTaskStatus={handleUpdateTaskStatus}
                    onReorderTask={handleReorderTask}
                    isProjectPanelCollapsed={view === 'projects' && isProjectPanelCollapsed}
                    onExpand={() => setIsProjectPanelCollapsed(false)}
                    onSetTaskPriority={handleSetTaskPriority}
                />
            </div>
            <div className={`${(view === 'today' || (view === 'projects' && isProjectPanelCollapsed)) ? 'md:col-span-7 lg:col-span-7' : 'md:col-span-5 lg:col-span-5'} h-full overflow-y-auto transition-all duration-300`}>
                {selectedTask ? (
                <TaskDetail 
                    task={selectedTask}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                />
                ) : (
                    <div className="h-full bg-white p-4 flex items-center justify-center">
                    <div className="text-center text-slate-500">
                        <Icon name="document" className="w-16 h-16 mx-auto text-slate-300" />
                        <p className="mt-4 text-lg">
                        {view === 'today' 
                            ? (todayTasks.length > 0 ? 'Select a task to see details' : 'No tasks for today!')
                            : !selectedProjectId
                            ? 'Select a project to begin'
                            : filteredTasks.length > 0
                            ? 'Select a task to see details'
                            : 'This project has no tasks'
                        }
                        </p>
                        <p>
                        {view === 'projects' && filteredTasks.length === 0 && selectedProjectId
                            ? 'Create your first task in the panel to your left.'
                            : 'Focus on what matters most.'
                        }
                        </p>
                    </div>
                    </div>
                )}
            </div>
        </main>
    );
  }

  return (
    <div className="h-screen w-screen font-sans text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-800">ADHD PM Task Tracker</h1>
            {isSaving && <div className="text-sm text-slate-500 flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
            </div>}
        </div>
        <div className="flex items-center gap-4">
            {isSignedIn && spreadsheetId &&
                <a href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                    Open Sheet
                </a>
            }
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
                <ViewSwitcherButton targetView="projects" label="Projects" />
                <ViewSwitcherButton targetView="today" label="Today's Focus" />
            </div>
            {isSignedIn && 
                <button onClick={handleSignOut} className="text-sm font-medium text-slate-600 hover:text-slate-800">
                    Sign Out
                </button>
            }
        </div>
      </header>
      {renderContent()}
    </div>
  );
}

export default App;
