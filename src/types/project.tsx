import type {TechGroup} from '@/lib/project-tech'
export type ProjectSection = {kind:'overview'|'activities'|'implementation'|'results'; ko:string; en:string}
export type ProjectJson = string | number | boolean | null | ProjectJson[] | { [key: string]: ProjectJson };

// editor_1_projects의 SELECT 응답. DB 원시 값과 화면 표시 값을 구분한다.
export interface RawProjectRow {
  _sections?: ProjectSection[];
  _english?: Record<string,string>;
  // JSON 숫자로 전달된 bigint는 number로 파싱되며, 큰 값의 정밀도는 보장되지 않는다.
  id: number;
  project_name: string | null;
  created_at: string;
  team_size: number | null;
  members: string | null;
  duration: string | null;
  category: string | null;
  description: string | null;
  semester: number;
  detailed_description: string | null;
  tech_stack: ProjectJson;
  filename: string | null;
  achievements: string | null;
  github_url: string | null;
  image_url: string | null;
  year: number | null;
}

export interface Project {
  sections?: ProjectSection[];
  groups?: TechGroup[];
  englishSummary?: string;
  englishDuration?: string;
  englishAchievements?: string[];
  sourceTable?: 'editor_1_projects'|'editor_6_events';
  sourceHref?: string;
  reviewedNews?: boolean;
  id: number;
  title: string;
  description: string;
  category: string;
  duration?: string;
  team_size?: number;
  members?: string;
  year?: number;
  semester?: number;
  detailed_description?: string;
  created_at?: string;
  tech_stack?: string[];
  achievements?: string[];
  image_url?: string;
  github_url?: string;
}
