

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Project, Task, TaskStatus, ProjectStatus } from './types';
import { supabase } from './supabaseClient';
import { ProjectView } from './components/ProjectView';
import { TaskList } from './components/TaskList';
import { TaskDetail } from './components/TaskDetail';
import { Icon } from './components/Icons';
import { Session } from '@supabase/supabase-js';
import { ImportExportModal } from './components/ImportExportModal';

interface DashboardProps {
    session: Session;
}

export const Dashboard: React.FC<DashboardProps> = ({ session }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isProjectPanelCollapsed, setIsProjectPanelCollapsed] = useState(false);
  const [view, setView] = useState<'projects' | 'today'>('projects');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: projectsData, error: projectsError } = await supabase.from('projects').select('*');
      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*');
      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

    } catch (err) {
        console.error("Error fetching data:", err);
        
        let displayError = "An unknown error occurred while fetching data.";
        
        if (err && typeof err === 'object') {
            const getCircularReplacer = () => {
              const seen = new WeakSet();
              return (key: string, value: any) => {
                if (typeof value === "object" && value !== null) {
                  if (seen.has(value)) {
                    return;
                  }
                  seen.add(value);
                }
                return value;
              };
            };
            
            try {
                if ('message' in err) {
                     displayError = `Error: ${(err as Error).message}\n\nFull error details:\n${JSON.stringify(err, getCircularReplacer(), 2)}`;
                } else {
                     displayError = `An error object was received:\n${JSON.stringify(err, getCircularReplacer(), 2)}`;
                }
            } catch {
                 displayError = "A non-serializable error object was received. Please check the developer console.";
            }

        } else {
          displayError = String(err);
        }

        setError(displayError);
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleAddProject = async (name: string, parent_id: string | null) => {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, parent_id, status: ProjectStatus.NotStarted, user_id: session.user.id })
      .select()
      .single();

    if (error) {
      console.error('Error adding project:', error);
    } else if (data) {
      setProjects(prev => [...prev, data]);
    }
  };
  
  const handleDeleteProject = async (id: string) => {
    const getDescendantIds = (projectId: string, allProjects: Project[]): string[] => {
      const children = allProjects.filter(p => p.parent_id === projectId);
      let descIds: string[] = children.map(c => c.id);
      children.forEach(c => {
        descIds = [...descIds, ...getDescendantIds(c.id, allProjects)];
      });
      return descIds;
    };
    const projectsToDeleteIds = [id, ...getDescendantIds(id, projects)];

    const { error: tasksError } = await supabase.from('tasks').delete().in('project_id', projectsToDeleteIds);
    if (tasksError) {
      console.error("Error deleting tasks for project:", tasksError);
      return;
    }

    const { error: projectsError } = await supabase.from('projects').delete().in('id', projectsToDeleteIds);
    if (projectsError) {
      console.error("Error deleting projects:", projectsError);
      return;
    }

    setProjects(prevProjects => prevProjects.filter(p => !projectsToDeleteIds.includes(p.id)));
    setTasks(prevTasks => prevTasks.filter(t => !projectsToDeleteIds.includes(t.project_id)));
    
    if (selectedProjectId && projectsToDeleteIds.includes(selectedProjectId)) {
      setSelectedProjectId(null);
      setSelectedTaskId(null);
    }
  };

  const handleUpdateProject = useCallback(async (projectId: string, newName: string) => {
    const { data, error } = await supabase
      .from('projects')
      .update({ name: newName })
      .eq('id', projectId)
      .select()
      .single();
    if (error) {
      console.error("Error updating project name: ", error);
    } else if (data) {
      setProjects(prev => prev.map(p => (p.id === projectId ? data : p)));
    }
  }, [setProjects]);

  const handleUpdateProjectStatus = useCallback(async (projectId: string, status: ProjectStatus) => {
    const { data, error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', projectId)
      .select()
      .single();
    if (error) {
      console.error("Error updating project status: ", error);
    } else if (data) {
      setProjects(prev => prev.map(p => (p.id === projectId ? data : p)));
    }
  }, [setProjects]);

  const handleAddTask = async (title: string, projectId: string) => {
    const projectTasks = tasks.filter(t => t.project_id === projectId);
    const newOrder = projectTasks.length > 0 ? Math.max(...projectTasks.map(t => t.order)) + 1 : 0;
    
    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert({
        title,
        project_id: projectId,
        details: '',
        status: TaskStatus.ToDo,
        documents: [],
        follow_ups: [],
        order: newOrder,
        user_id: session.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding task:", error);
    } else if (newTask) {
      setTasks(prev => [...prev, newTask]);
      setSelectedTaskId(newTask.id);
    }
  };

  const handleUpdateTask = useCallback(async (updatedTask: Task) => {
    const { id, ...updateData } = updatedTask;
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error("Error updating task: ", error);
    } else if (data) {
      setTasks(prev => prev.map(t => (t.id === data.id ? data : t)));
    }
  }, [setTasks]);

  const handleUpdateTaskStatus = async (id: string, status: TaskStatus) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const updatePayload = {
      status,
      closed_at: status === TaskStatus.Done ? (task.closed_at || new Date().toISOString()) : null,
    };
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
        console.error("Error updating task status:", error);
    } else if (data) {
        setTasks(prev => prev.map(t => t.id === id ? data : t));
    }
  };
  
  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) {
      console.error("Error deleting task:", error);
      return;
    }

    setTasks(prevTasks => {
      const remainingTasksInApp = prevTasks.filter(t => t.id !== id);
      if (selectedTaskId === id) {
        const tasksForSelection = (view === 'today'
          ? todayTasks
          : filteredTasks
        ).filter(t => t.id !== id);

        setSelectedTaskId(tasksForSelection.length > 0 ? tasksForSelection[0].id : null);
      }
      return remainingTasksInApp;
    });
  };
  
  const handleReassignTask = async (taskId: string, newProjectId: string) => {
    const taskToMove = tasks.find(t => t.id === taskId);
    if (taskToMove && taskToMove.project_id !== newProjectId) {
      const projectTasks = tasks.filter(t => t.project_id === newProjectId);
      const newOrder = projectTasks.length > 0 ? Math.max(...projectTasks.map(t => t.order)) + 1 : 0;
      
      const { data, error } = await supabase
        .from('tasks')
        .update({ project_id: newProjectId, order: newOrder })
        .eq('id', taskId)
        .select()
        .single();
      
      if (error) {
        console.error("Error reassigning task: ", error);
      } else if (data) {
        setTasks(prev => prev.map(task => (task.id === taskId ? data : task)));
        setSelectedProjectId(newProjectId);
        setSelectedTaskId(taskId);
      }
    }
  };
  
   const handleReorderTask = useCallback(async (taskId: string, targetTaskId: string, position: 'top' | 'bottom') => {
    const taskToMove = tasks.find(t => t.id === taskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);

    if (!taskToMove || !targetTask || taskToMove.project_id !== targetTask.project_id) {
      return;
    }

    const projectId = taskToMove.project_id;
    const projectTasks = tasks
      .filter(t => t.project_id === projectId)
      .sort((a, b) => a.order - b.order);

    const fromIndex = projectTasks.findIndex(t => t.id === taskId);
    const [movedItem] = projectTasks.splice(fromIndex, 1);

    const newToIndex = projectTasks.findIndex(t => t.id === targetTaskId);
    projectTasks.splice(position === 'top' ? newToIndex : newToIndex + 1, 0, movedItem);
    
    const tasksToUpdate = projectTasks.map((task, index) => ({ ...task, order: index }));

    setTasks(currentTasks => {
      const otherProjectTasks = currentTasks.filter(t => t.project_id !== projectId);
      return [...otherProjectTasks, ...tasksToUpdate].sort((a,b) => a.order - b.order);
    });

    const updatesForDb = tasksToUpdate.map(({ id, order }) => ({ id, order }));
    const { error } = await supabase.from('tasks').upsert(updatesForDb);

    if (error) {
      console.error('Error reordering tasks:', error);
      fetchAllData(); // Re-fetch to ensure consistency
    }
  }, [tasks, setTasks, fetchAllData]);

  const handleReassignProject = useCallback(async (projectId: string, newParentId: string | null) => {
    if (projectId === newParentId) return;

    let currentParentId = newParentId;
    while (currentParentId !== null) {
      if (currentParentId === projectId) {
        console.error("Cannot move a project into one of its own descendants.");
        return;
      }
      const parentProject = projects.find(p => p.id === currentParentId);
      currentParentId = parentProject ? parentProject.parent_id : null;
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ parent_id: newParentId })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error("Error reassigning project: ", error);
    } else if (data) {
      setProjects(prev => prev.map(p => p.id === projectId ? data : p));
    }
  }, [projects, setProjects]);
  
  const handleSetTaskPriority = useCallback(async (taskId: string, isPriority: boolean) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({ is_priority: isPriority })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error("Error setting task priority: ", error);
    } else if (data) {
      setTasks(prev => prev.map(t => t.id === taskId ? data : t));
    }
  }, [setTasks]);


  const filteredTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    let projectTasks = tasks.filter(task => task.project_id === selectedProjectId);
    if (hideCompleted) {
      projectTasks = projectTasks.filter(task => task.status !== TaskStatus.Done);
    }
    return projectTasks.sort((a, b) => a.order - b.order);
  }, [tasks, selectedProjectId, hideCompleted]);
  
  const todayTasks = useMemo(() => {
    const openProjectIds = new Set(projects.filter(p => p.status === ProjectStatus.Open).map(p => p.id));
    return tasks
        .filter(task => openProjectIds.has(task.project_id) && task.status !== TaskStatus.Done)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [projects, tasks]);
  
  const todayTopPriorityTasks = useMemo(() => {
    return todayTasks.filter(task => task.is_priority).sort((a, b) => a.order - b.order);
  }, [todayTasks]);

  const todayOtherTasks = useMemo(() => {
    return todayTasks.filter(task => !task.is_priority);
  }, [todayTasks]);


  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return undefined;
    const task = tasks.find(t => t.id === selectedTaskId);
    if (view === 'projects' && task?.project_id !== selectedProjectId) {
        return undefined;
    }
    return task;
  }, [tasks, selectedTaskId, selectedProjectId, view]);

  const handleSelectProject = (id: string | null) => {
    setSelectedProjectId(id);
    if (id) {
      const tasksForProject = tasks
        .filter(task => task.project_id === id)
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
            setSelectedProjectId(task.project_id);
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

  const userName = useMemo(() => {
    return session.user?.user_metadata?.full_name || session.user?.email;
  }, [session]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg font-semibold text-slate-700">Loading your workspace...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100 p-8">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-2xl">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
             <Icon name="trash" className="h-6 w-6 text-red-600"/>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-800">Failed to Load Data</h2>
          <p className="mt-2 text-slate-600">
            There was a problem connecting to your Supabase backend. This is often due to a security policy on your database.
          </p>
          <div className="mt-4 text-left bg-red-50 p-4 rounded-lg">
             <p className="text-sm font-semibold text-red-800">
                Common Causes & Solutions:
             </p>
             <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-2">
                <li><strong>Row Level Security (RLS):</strong> With user accounts enabled, you need RLS policies that check if `auth.uid() = user_id`. Make sure these policies are active for `select`, `insert`, `update`, and `delete` on both the `projects` and `tasks` tables.</li>
                <li><strong>CORS Policy:</strong> If the error message mentions "fetch" or "CORS", you may need to add this application's domain to your Supabase project's CORS allow-list in the API settings.</li>
             </ul>
          </div>
          <pre className="mt-4 text-xs text-left text-slate-500 bg-slate-100 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
            <strong className="font-semibold">Error Details:</strong>
            <br />
            {error}
          </pre>
          <button
            onClick={fetchAllData}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 flex justify-between items-center flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-800">Projects & Task Hub</h1>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <ViewSwitcherButton targetView="projects" label="Projects" />
              <ViewSwitcherButton targetView="today" label="Today's Focus" />
            </div>
            <div className="relative" ref={userMenuRef}>
                <button
                    onClick={() => setIsUserMenuOpen(prev => !prev)}
                    className="flex items-center gap-2 pl-3 pr-2 py-1 text-sm font-medium rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
                >
                    <Icon name="user" className="w-5 h-5 sm:hidden" />
                    <span className="hidden sm:inline" title={session.user.email}>{userName}</span>
                    <Icon name="chevron-down" className="w-4 h-4 text-slate-500" />
                </button>
                {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-slate-200 animate-fade-in">
                        <button
                            onClick={() => {
                                setIsImportExportModalOpen(true);
                                setIsUserMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-3"
                        >
                            <Icon name="upload" className="w-4 h-4" />
                            Import/Export
                        </button>
                        <button
                            onClick={() => {
                                supabase.auth.signOut();
                                setIsUserMenuOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                        >
                            <Icon name="log-out" className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        </div>
      </header>
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
                hideCompleted={hideCompleted}
                onToggleHideCompleted={setHideCompleted}
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
      {isImportExportModalOpen && (
        <ImportExportModal
          isOpen={isImportExportModalOpen}
          onClose={() => setIsImportExportModalOpen(false)}
          projects={projects}
          tasks={tasks}
          userId={session.user.id}
          onImportSuccess={fetchAllData}
        />
      )}
    </div>
  );
};