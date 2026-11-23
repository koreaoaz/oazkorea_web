'use client'

import {T,useUIText} from '@/components/LocaleProvider';
import {CATEGORY_LABELS,type ChangeCategory} from '@/lib/admin/boards'
export function Classification({category,reason,onCategory,onReason,disabled=false}:{category:ChangeCategory;reason:string;onCategory:(c:ChangeCategory)=>void;onReason:(r:string)=>void;disabled?:boolean}){
 const uiText=useUIText();

 return <fieldset disabled={disabled} className="admin-panel space-y-3"><legend className="px-2 font-semibold"><T text="변경 분류·사유"/></legend><label className="block"><T text="변경 분류"/><select aria-label={uiText("변경 분류")} value={category} onChange={e=>onCategory(e.target.value as ChangeCategory)}>{Object.entries(CATEGORY_LABELS).map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label><label className="block"><T text="변경 사유 (선택)"/><input aria-label={uiText("변경 사유")} value={reason} maxLength={160} onChange={e=>onReason(e.target.value)}/></label><p className="text-xs text-zinc-500"><T text="개인정보·이메일·비밀번호를 입력하지 마세요. 분류는 통계에, 사유는 최고관리자 작업 이력에 기록됩니다."/></p></fieldset>
}
