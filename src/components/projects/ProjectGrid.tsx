"use client";
import {activityTermLabel} from '@/lib/semester'
import {TechTags} from './TechTags'
import {useLocale} from '@/components/LocaleProvider'
import {ContentTitle} from '@/components/ContentTitle';
import {T} from '@/components/LocaleProvider';
import {ContentImage as Image} from '@/components/ContentImage';
import {Skeleton} from '@/components/ui/skeleton';
import type {Project} from '@/types/project';
import {activityKey} from '@/lib/project-activities';
import {recordCard,recordImage,recordTitle,recordGrid} from '@/lib/record-card';

interface ProjectGridProps { Projects:Project[]; isLoading:boolean; onProjectClick:(project:Project, button:HTMLButtonElement)=>void }
export default function ProjectGrid({Projects,isLoading,onProjectClick}:ProjectGridProps){
 const english=useLocale()==='en'
 if(isLoading)return <div className={`mobile-project-grid ${recordGrid}`} aria-busy="true">{Array.from({length:6},(_,i)=><div key={i} className={recordCard}><Skeleton className={recordImage}/><Skeleton className="mx-auto mt-4 h-6 w-3/4"/></div>)}</div>;
 if(!Projects.length)return <div className="py-16 text-center"><h3 className="mb-2 text-xl font-semibold"><T text="검색된 프로젝트가 없습니다"/></h3><p className="text-slate-600"><T text="다른 검색어나 카테고리를 시도해보세요."/></p></div>;
 return <div className={`mobile-project-grid ${recordGrid}`}>{Projects.map(project=><button type="button" key={activityKey(project)} data-activity-key={activityKey(project)} className={recordCard} onClick={event=>onProjectClick(project,event.currentTarget)}>
  <span className="record-image mx-auto grid aspect-square w-4/5 max-w-[200px] grid-rows-[minmax(0,1fr)_auto]">
  {project.image_url?<Image src={project.image_url} alt={project.title} width={400} height={240} unoptimized className="size-full min-h-0 rounded-md object-contain transition-transform motion-reduce:transform-none group-hover:-translate-y-1"/>:<span aria-hidden="true" className="grid size-full min-h-0 place-items-center rounded-md bg-slate-100 text-4xl text-slate-400">{english?'OaZ':project.title.charAt(0)}</span>}
  {activityTermLabel(project,english)&&<span className="text-xs leading-4 text-zinc-600 sm:text-sm">{activityTermLabel(project,english)}</span>}
  </span>
  <h3 className={recordTitle}><ContentTitle table={project.sourceTable??'editor_1_projects'} id={project.id} title={project.title}/></h3><TechTags groups={project.groups}/>
 </button>)}</div>;
}
