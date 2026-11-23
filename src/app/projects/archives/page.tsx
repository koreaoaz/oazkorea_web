'use client';

import {matchesReleaseNews} from '@/lib/news-release'
import {getEventImages} from '@/app/editor/utils/parsing_first'
import {activityKind,isNewsActivity,uniqueActivities,ACTIVITY_LABELS} from '@/lib/project-activities'
import {imageURL} from '@/lib/image-delivery'

import {T} from '@/components/LocaleProvider';
import {useSearchParams} from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { useAsyncQuery } from "@/hooks/useAsyncQuery";
import ProjectGrid from "../../../components/projects/ProjectGrid";
import ProjectModal from "../../../components/projects/ProjectModal";
import { supabase } from '@/lib/supabaseClient';
import { Project, RawProjectRow } from "@/types/project";
import {technologyNames,techGroups} from '@/lib/project-tech'
import {projectAchievements} from '@/lib/project-achievements';

import {SemesterFilter} from '@/components/SemesterFilter';
import {compareProjectTerms,filterSemester} from '@/lib/semester';

function mapProjectRow(p: RawProjectRow): Project {
  const imagePath = p.image_url || p.filename;

  return {
    id: p.id,
    sections: p._sections,
    groups: techGroups(p.tech_stack,[p.project_name,p.description,p.detailed_description]),
    englishSummary: p._english?.description,
    englishDuration: p._english?.duration,
    englishAchievements: p._english?.achievements ? projectAchievements(p._english.achievements) : undefined,
    title: p.project_name ?? "",
    description: p.description || "",
    category: p.category || "기타",
    duration: p.duration || "",
    team_size: p.team_size ?? undefined,
    members: p.members || "",
    year: p.year || undefined,
    semester: p.semester || undefined,
    detailed_description: p.detailed_description || "",
    created_at: p.created_at,
    // 비정상 배열은 이 프로젝트의 기술 스택만 비우고, 다른 필드는 유지한다.
    tech_stack: technologyNames(p.tech_stack),
    achievements: projectAchievements(p.achievements),
    image_url: imagePath
      ? /^https?:\/\//.test(imagePath) ? imagePath : imageURL("project_img",imagePath,supabase.storage.from("project_img").getPublicUrl(imagePath).data.publicUrl)
      : undefined,
    github_url: p.github_url || "",
  };
}

const EMPTY_PROJECTS: Project[] = [];

   const loadProjects = async () => {

    // 필요한 컬럼만 선택
    const { data, error } = await supabase
      .from("editor_1_projects")
      .select(`
        id,
        project_name,
        category,
        duration,
        team_size,
        members,
        description,
        created_at,
        year,
        semester,
        detailed_description,
        tech_stack,
        achievements,
        filename,
        image_url,
        github_url
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("프로젝트를 불러오지 못했습니다.");
    }

    let mapped: Project[];
    try {
      mapped = data?.map(mapProjectRow) ?? [];
    } catch {
      throw new Error("프로젝트 데이터 형식이 올바르지 않습니다.");
    }

    const {data:events,error:eventError}=await supabase.from('editor_6_events').select('id,title,description,created_at,filenames').order('created_at',{ascending:false});
    if(eventError)throw new Error('학회 활동을 불러오지 못했습니다.');
    const activities:Project[]=await Promise.all((events??[]).map(async event=>{
      const first=getEventImages(event.filenames).sort((a,b)=>a.order-b.order)[0]?.filename;
      const explicitYear=event.title?.match(/^(20\d{2})년/);
      const item:Project={id:event.id,reviewedNews:await matchesReleaseNews(event),title:event.title??'',description:event.description??'',detailed_description:event.description??'',created_at:event.created_at,category:'',sourceTable:'editor_6_events',sourceHref:`/projects/activities/${event.id}`,year:explicitYear?Number(explicitYear[1]):undefined,image_url:first?imageURL('card_news',first,supabase.storage.from('card_news').getPublicUrl(first).data.publicUrl):undefined};
      return {...item,category:ACTIVITY_LABELS[activityKind(item)]};
    }));
    return uniqueActivities([...mapped,...activities]).filter(p=>!isNewsActivity(p)).sort(compareProjectTerms);
  };

export default function Projects() {
  return <Suspense fallback={<ProjectGrid Projects={[]} isLoading onProjectClick={() => {}}/>}><ProjectArchive/></Suspense>;
}

function ProjectArchive() {
  const [semester,setSemester]=useState('all');
  const search = useSearchParams();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const { data: Projects, loading: isLoading, error } = useAsyncQuery("projects", loadProjects, EMPTY_PROJECTS, "프로젝트를 불러오지 못했습니다. 다시 시도해 주세요.");

  const selectedProject = Projects.find(p => !p.sourceHref && String(p.id) === search.get('project')) ?? null;

  function selectProject(project: Project, button: HTMLButtonElement) {
    if (project.sourceHref) { window.location.assign(project.sourceHref); return; }
    trigger.current = button;
    const url = new URL(window.location.href);
    url.searchParams.set('project', String(project.id));
    window.history.pushState({oazProjectDialog: true}, '', url);
  }

  function closeProject() {
    if (trigger.current?.isConnected && window.history.state?.oazProjectDialog) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('project');
    window.history.replaceState(null, '', url);
  }

  function restoreFocus(id: number) {
    const button = trigger.current;
    const key = 'editor_1_projects:' + id;
    const target = button?.isConnected && button.dataset.activityKey === key ? button
      : document.querySelector<HTMLButtonElement>(`button[data-activity-key="${key}"]`);
    (target ?? heading.current)?.focus({preventScroll: true});
    trigger.current = null;
  }

  return (
    <div className="mobile-project-archives min-h-screen bg-white">

      <div className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 ref={heading} tabIndex={-1} className="mobile-archive-title text-4xl lg:text-5xl font-bold text-slate-900 mb-6">Project Records</h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed"><T text="프로젝트, 해커톤, 세미나·학술활동을 함께 둘러보세요."/></p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {error && <p role="alert" className="mb-4 text-red-600"><T text={error}/></p>}
        <SemesterFilter rows={Projects} value={semester} onChange={setSemester}/>
        <ProjectGrid
          Projects={filterSemester(Projects,semester)}
          isLoading={isLoading}
          onProjectClick={selectProject}
        />

      </div>

      <ProjectModal
        project={selectedProject}
        onClose={closeProject}
        restoreFocus={restoreFocus}
      />
    </div>
  );
};
