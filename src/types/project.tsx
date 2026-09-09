export interface Project {
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