
import {T} from '@/components/LocaleProvider';
import Link from "next/link";
export default function LegacyCallback(){return <section className="mx-auto max-w-xl py-20 text-center"><h1 className="text-2xl font-semibold"><T text="로그인 안내"/></h1><p className="my-6"><T text="홈페이지는 로그인 없이 이용할 수 있습니다. 관리자는 관리자 로그인에서 현재 권한을 확인해 주세요."/></p><Link className="underline" href="/admin/login"><T text="관리자 로그인"/></Link></section>}
