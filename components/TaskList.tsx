import React from 'react';
import { Task, TaskStatus, Project } from '../types';
import { Icon } from './Icons';

interface TaskListProps {
  tasks: Task[];
  priorityTasks?: Task[];
  projects: Project[];
  title: string;
  canAddTask: boolean;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  onSelectTask: (id: string | null) => void;
  onAddTask: (title: string, projectId: string) => void;
  onUpdateTaskStatus: (id: string, status: TaskStatus) => void;
  onReorderTask: (taskId: string, targetTaskId: string, position: 'top' | 'bottom') => void;
  onSetTaskPriority?: (taskId: string, isPriority: boolean) => void;
  isProjectPanelCollapsed: boolean;
  onExpand: () => void;
}

interface TaskItemProps {
  task: Task;
  projectName?: string;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateStatus: (status: TaskStatus) => void;
  onDragStartItem: (e: React.DragEvent, taskId: string) => void;
  onDragEndItem: () => void;
  onDragOverItem: (e: React.DragEvent, taskId: string) => void;
  onDropItem: (e: React.DragEvent, taskId: string) => void;
  onDragLeaveItem: () => void;
  isBeingDragged: boolean;
  dropPosition: 'top' | 'bottom' | null;
}

const TaskItem: React.FC<TaskItemProps> = ({ 
    task, projectName, isSelected, onSelect, onUpdateStatus,
    onDragStartItem, onDragEndItem, onDragOverItem, onDropItem, onDragLeaveItem,
    isBeingDragged, dropPosition
}) => {
  const statusConfig = {
    [TaskStatus.ToDo]: { color: 'bg-slate-400', label: 'To Do' },
    [TaskStatus.InProgress]: { color: 'bg-blue-500', label: 'In Progress' },
    [TaskStatus.Done]: { color: 'bg-green-500', label: 'Done' },
  };

  const incompleteFollowUpsCount = task.followUps.filter(f => !f.completed).length;

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newStatus = e.target.value as TaskStatus;
    onUpdateStatus(newStatus);
  };
  
  return (
     <div 
        className="relative"
        onDragOver={(e) => onDragOverItem(e, task.id)}
        onDrop={(e) => onDropItem(e, task.id)}
        onDragLeave={onDragLeaveItem}
    >
        {dropPosition === 'top' && <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full -mt-0.5 z-10" />}
        <div
          onClick={onSelect}
          draggable
          onDragStart={(e) => onDragStartItem(e, task.id)}
          onDragEnd={onDragEndItem}
          className={`p-3 rounded-lg cursor-pointer border-l-4 transition-opacity ${
              isBeingDragged ? 'opacity-40' : 'opacity-100'
          } ${isSelected ? 'bg-white shadow-md border-blue-500' : 'bg-slate-50 hover:bg-white border-transparent'}`}
        >
          <div className="flex justify-between items-start gap-2">
            <p className={`font-medium pr-2 flex-grow ${isSelected ? 'text-slate-800' : 'text-slate-700'}`}>{task.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative" onClick={e => e.stopPropagation()}>
                    <select
                        value={task.status}
                        onChange={handleStatusChange}
                        className={`pl-3 pr-7 py-1 text-xs font-semibold rounded-full text-white appearance-none focus:outline-none cursor-pointer ${statusConfig[task.status].color}`}
                    >
                        {Object.values(TaskStatus).map(s => (
                            <option key={s} value={s}>{statusConfig[s as TaskStatus].label}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <svg className="w-4 h-4 fill-current text-white opacity-70" viewBox="0 0 20 20"><path d="M5.516 7.548c.436-.446 1.144-.446 1.58 0L10 10.43l2.904-2.882c.436-.446 1.144-.446 1.58 0 .436.446.436 1.17 0 1.615l-3.694 3.664c-.436.446-1.144.446-1.58 0L5.516 9.163c-.436-.446-.436-1.17 0-1.615z"></path></svg>
                    </div>
                </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {projectName ? (
                <p className="text-xs text-slate-600 font-medium bg-slate-200 px-2 py-0.5 rounded-full truncate" title={projectName}>
                    {projectName}
                </p>
            ) : <div />}
            <div className="flex flex-col items-end">
                {task.status !== TaskStatus.Done && incompleteFollowUpsCount > 0 && (
                    <p className="text-xs text-amber-700 font-medium">
                        Pending on: {incompleteFollowUpsCount} follow-up{incompleteFollowUpsCount > 1 ? 's' : ''}
                    </p>
                )}
            </div>
          </div>
        </div>
        {dropPosition === 'bottom' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full -mb-0.5 z-10" />}
    </div>
  );
};


export const TaskList: React.FC<TaskListProps> = ({ 
    tasks, priorityTasks = [], projects, title, canAddTask, selectedTaskId, selectedProjectId, onSelectTask, onAddTask, 
    onUpdateTaskStatus, onReorderTask, onSetTaskPriority, isProjectPanelCollapsed, onExpand 
}) => {
  const [newTaskTitle, setNewTaskTitle] = React.useState('');
  const [draggedTaskId, setDraggedTaskId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ id: string, position: 'top' | 'bottom' } | null>(null);
  const [isPriorityZoneDragOver, setIsPriorityZoneDragOver] = React.useState(false);
  const [isFullListZoneDragOver, setIsFullListZoneDragOver] = React.useState(false);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskTitle.trim() && selectedProjectId) {
      onAddTask(newTaskTitle, selectedProjectId);
      setNewTaskTitle('');
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDropTarget(null);
    setIsPriorityZoneDragOver(false);
    setIsFullListZoneDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (targetTaskId === draggedTaskId) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const isOverTopHalf = e.clientY < rect.top + rect.height / 2;

    if (dropTarget?.id !== targetTaskId || dropTarget?.position !== (isOverTopHalf ? 'top' : 'bottom')) {
        setDropTarget({
            id: targetTaskId,
            position: isOverTopHalf ? 'top' : 'bottom',
        });
    }
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && taskId !== targetTaskId && dropTarget) {
        onReorderTask(taskId, targetTaskId, dropTarget.position);
    }
    handleDragEnd();
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  }
  
  const handlePriorityDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onSetTaskPriority) {
      const isAlreadyPriority = priorityTasks.some(t => t.id === taskId);
      if (!isAlreadyPriority) {
        onSetTaskPriority(taskId, true);
      }
    }
    handleDragEnd();
  };

  const handlePriorityDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsPriorityZoneDragOver(true);
  };
  
  const handlePriorityDragLeave = () => {
    setIsPriorityZoneDragOver(false);
  };

  const handleFullListDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onSetTaskPriority) {
      const isPriority = priorityTasks.some(t => t.id === taskId);
      if (isPriority) {
        onSetTaskPriority(taskId, false);
      }
    }
    handleDragEnd();
  };

  const handleFullListDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFullListZoneDragOver(true);
  };

  const handleFullListDragLeave = () => {
    setIsFullListZoneDragOver(false);
  };


  if (title === "Today's Focus") {
    const renderTaskList = (list: Task[]) => list.map(task => {
        const projectName = projects.find(p => p.id === task.projectId)?.name;
        return (
            <TaskItem 
                key={task.id} 
                task={task} 
                projectName={projectName}
                isSelected={selectedTaskId === task.id}
                onSelect={() => onSelectTask(task.id)}
                onUpdateStatus={(status) => onUpdateTaskStatus(task.id, status)}
                onDragStartItem={handleDragStart}
                onDragEndItem={handleDragEnd}
                onDragOverItem={handleDragOver}
                onDropItem={handleDrop}
                onDragLeaveItem={handleDragLeave}
                isBeingDragged={draggedTaskId === task.id}
                dropPosition={dropTarget?.id === task.id ? dropTarget.position : null}
            />
        )
    });
    
    return (
      <div className="h-full bg-slate-100 p-4 flex flex-col">
        <div className="flex-grow flex flex-col overflow-hidden">
          <div className="mb-6 flex-shrink-0">
            <h3 className="font-semibold text-slate-600 mb-2 py-1">Top Priorities</h3>
            <div
              onDrop={handlePriorityDrop}
              onDragOver={handlePriorityDragOver}
              onDragLeave={handlePriorityDragLeave}
              className={`p-2 space-y-3 bg-slate-200/50 rounded-lg min-h-[80px] border-2 border-dashed transition-colors ${
                isPriorityZoneDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300'
              } max-h-72 overflow-y-auto`}
            >
              {priorityTasks.length > 0 ? (
                renderTaskList(priorityTasks)
              ) : (
                <div className="flex items-center justify-center h-full min-h-[64px] text-slate-500">
                  <p>Drag tasks here to prioritize</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex-grow flex flex-col overflow-hidden">
            <h3 className="font-semibold text-slate-600 mb-2 py-1">Full List</h3>
            <div 
              onDrop={handleFullListDrop}
              onDragOver={handleFullListDragOver}
              onDragLeave={handleFullListDragLeave}
              className={`space-y-3 overflow-y-auto flex-grow p-2 rounded-lg border-2 border-dashed transition-colors ${
                isFullListZoneDragOver ? 'border-blue-500 bg-blue-50' : 'border-transparent'
              }`}
            >
              {tasks.length > 0 ? (
                renderTaskList(tasks)
              ) : (
                <div className="flex items-center justify-center h-full min-h-[64px] text-slate-500">
                    <p>No other tasks on your list.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProjectId && canAddTask) {
    return (
      <div className="h-full bg-white border-r border-slate-200 p-4 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Icon name="folder" className="w-16 h-16 mx-auto text-slate-300" />
          <p className="mt-4 text-lg">Select a project to see tasks</p>
          <p>or create a new project to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-100 border-r border-slate-200 p-4 flex flex-col">
       <div className="flex items-center mb-4">
        {isProjectPanelCollapsed && (
          <button onClick={onExpand} className="p-1 rounded-full hover:bg-slate-200 -ml-1 mr-2" title="Expand projects panel">
            <Icon name="panel-left-open" className="w-5 h-5 text-slate-600" />
          </button>
        )}
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
      </div>
      {canAddTask && (
        <form onSubmit={handleAddTask} className="mb-4">
            <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a new task..."
            className="w-full p-2 border bg-white border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
        </form>
      )}
      <div className="flex-grow overflow-y-auto space-y-3 pr-1">
        {tasks.length > 0 ? (
          tasks.map(task => {
            const projectName = projects.find(p => p.id === task.projectId)?.name;
            return (
              <TaskItem 
                key={task.id} 
                task={task} 
                projectName={projectName}
                isSelected={selectedTaskId === task.id}
                onSelect={() => onSelectTask(task.id)}
                onUpdateStatus={(status) => onUpdateTaskStatus(task.id, status)}
                onDragStartItem={handleDragStart}
                onDragEndItem={handleDragEnd}
                onDragOverItem={handleDragOver}
                onDropItem={handleDrop}
                onDragLeaveItem={handleDragLeave}
                isBeingDragged={draggedTaskId === task.id}
                dropPosition={dropTarget?.id === task.id ? dropTarget.position : null}
              />
            )
          })
        ) : (
          <div className="text-center text-slate-500 pt-16">
            <Icon name="circle" className="w-16 h-16 mx-auto text-slate-300" />
            <p className="mt-4">
                {title === "Today's Focus"
                ? "No incomplete tasks in open projects."
                : "No tasks in this project."}
            </p>
            <p>
                {canAddTask ? "Add your first task above!" : "Great job!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
