
import {T} from '@/components/LocaleProvider';
import Link from "next/link";
export default function ClosedRegistration(){return <section className="mx-auto max-w-xl py-20 text-center"><h1 className="text-2xl font-semibold"><T text="회원가입 안내"/></h1><p className="my-6"><T text="공개 홈페이지는 로그인 없이 이용할 수 있습니다. 신규 일반 회원가입은 운영하지 않습니다."/></p><Link className="underline" href="/admin/login"><T text="관리자 로그인"/></Link><p className="mt-4"><Link href="/"><T text="홈으로"/></Link></p></section>}
