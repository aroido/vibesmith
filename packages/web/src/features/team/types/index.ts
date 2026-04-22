export type TeamRole = 'owner' | 'maintainer' | 'member';

export type TeamVisibility = 'private' | 'team' | 'public';

export type TeamPermission = 'read' | 'write';

export type TeamSyncIntervalMinutes = 5 | 30 | 60;

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
}

export interface TeamSkill {
  id: string;
  name: string;
  category: string;
  owner: string;
  permission: TeamPermission;
  updatedAt: string;
  downloads: number;
}

export interface TeamActivity {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface TeamSettings {
  visibility: TeamVisibility;
  defaultPermission: TeamPermission;
  autoSync: boolean;
  syncIntervalMinutes: TeamSyncIntervalMinutes;
}

export interface TeamEntity {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  members: TeamMember[];
  sharedSkills: TeamSkill[];
  activities: TeamActivity[];
  settings: TeamSettings;
}
