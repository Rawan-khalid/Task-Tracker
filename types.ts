
export interface Document {
  id: string;
  name: string;
  url: string;
}

export interface FollowUp {
  id: string;
  text: string;
  completed: boolean;
}

export enum TaskStatus {
  ToDo = 'todo',
  InProgress = 'inprogress',
  Done = 'done',
}

export interface Task {
  id:string;
  title: string;
  details: string;
  projectId: string;
  status: TaskStatus;
  createdAt: string;
  closedAt?: string;
  documents: Document[];
  followUps: FollowUp[];
  order: number;
  isPriority?: boolean;
}

export enum ProjectStatus {
  NotStarted = 'not-started',
  Open = 'open',
  OnHold = 'on-hold',
  Archived = 'archived',
}

export interface Project {
  id: string;
  name: string;
  parentId: string | null;
  status: ProjectStatus;
  createdAt: string;
}