
import {TechTags,TechnologyBadges} from './TechTags'
import {ContentTitle} from '@/components/ContentTitle'
import {T,useLocale} from '@/components/LocaleProvider';
import {ContentImage as Image} from '@/components/ContentImage';
import {TranslatedContent} from '@/components/TranslatedContent';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {activityTermLabel} from "@/lib/semester";
import { Project } from "@/types/project";
import {Trophy,Github} from "lucide-react";

const categoryColors: Record<string, string> = {
  "AI/ML": "bg-blue-100 text-blue-800 border-blue-200",
  "해커톤": "bg-purple-100 text-purple-800 border-purple-200",
  "HW": "bg-green-100 text-green-800 border-green-200",
  "Web/App": "bg-orange-100 text-orange-800 border-orange-200",
  "BigData": "bg-pink-100 text-pink-800 border-pink-200",
};

interface ProjectModalProps {
  project: Project | null;   // 선택된 프로젝트, 없을 수도 있으니 null 허용
  restoreFocus: (id: number) => void;
  onClose: () => void;       // 닫기 이벤트
}

export default function ProjectModal({ project, onClose, restoreFocus } : ProjectModalProps) {
  const en=useLocale()==='en'
  if (!project) return null;

  const term=activityTermLabel(project,en)
  const achievements=(en&&project.englishAchievements)||project.achievements
  return (
    <Dialog open={!!project} onOpenChange={onClose}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); restoreFocus(project.id); }} aria-describedby={undefined} className="w-[calc(100%-2rem)] max-w-5xl sm:max-w-5xl max-h-[90dvh] overflow-y-auto overscroll-contain [&_[data-slot=dialog-close]]:grid [&_[data-slot=dialog-close]]:size-11 [&_[data-slot=dialog-close]]:place-items-center">
        <DialogHeader className="pr-12 text-left">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <DialogTitle className="min-w-0 max-w-full break-words text-2xl font-bold text-slate-900">
              <ContentTitle table="editor_1_projects" id={project.id} title={project.title}/>
            </DialogTitle>
            <Badge className={`${categoryColors[project.category]} border font-medium w-fit`}>
              <T text={project.category}/>
            </Badge>
          </div>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            {project.image_url && <div className="relative h-28 w-full overflow-hidden rounded-lg bg-zinc-50 sm:w-40">
              <Image src={project.image_url} alt={project.title} fill unoptimized loading="eager" decoding="auto" className="object-contain"/>
            </div>}
            <div className="min-w-0 flex-1 basis-56">
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {([[en?'Semester':'활동 학기',term],[en?'Duration':'기간',(en&&project.englishDuration)||project.duration],
                  [en?'Team size':'팀 규모',project.team_size],[en?'Members':'팀원',project.members]] as const)
                  .map(([label,value])=>value!=null&&value!==''&&<div key={label} className="min-w-0"><dt className="text-xs text-zinc-500">{label}</dt><dd className="whitespace-pre-line [overflow-wrap:anywhere]">{value}</dd></div>)}
              </dl>
              <TechTags groups={project.groups} exclude={project.tech_stack}/>
            </div>
          </div>
          <TechnologyBadges names={project.tech_stack??[]}/>
          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3"><T text="프로젝트 설명"/></h3>
            <TranslatedContent table="editor_1_projects" id={project.id} title={project.title} body={project.detailed_description || project.description} automaticBody={!project.detailed_description?project.englishSummary:undefined} heading={false} sections={project.sections??[]}/>
          </div>

          {/* Achievements */}
          {achievements && achievements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-zinc-600" /><T text="성과 및 수상"/></h3>
              <div className="space-y-2">
                {achievements.map((achievement, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200"
                  >
                    <Trophy className="w-4 h-4 text-zinc-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-medium text-zinc-900">
                      {achievement}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
          )}

          {project.github_url && /^https?:\/\//i.test(project.github_url) && <Button asChild variant="outline"><a href={project.github_url} target="_blank" rel="noopener noreferrer"><Github className="size-4"/><T text="GitHub 저장소"/></a></Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
