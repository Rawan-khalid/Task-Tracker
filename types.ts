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
  user_id: string;
  title: string;
  details: string;
  project_id: string;
  status: TaskStatus;
  created_at: string;
  closed_at?: string;
  documents: Document[];
  follow_ups: FollowUp[];
  order: number;
  is_priority?: boolean;
}

export enum ProjectStatus {
  NotStarted = 'not-started',
  Open = 'open',
  OnHold = 'on-hold',
  Archived = 'archived',
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  status: ProjectStatus;
  created_at: string;
}