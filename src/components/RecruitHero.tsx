import Image from 'next/image'
import type {ReactNode} from 'react'

export function RecruitHero({title,subtitle}:{title:ReactNode;subtitle:ReactNode}){
 return (
      <section className="relative mx-auto h-56 sm:h-[350px] w-full max-w-7xl rounded-2xl flex flex-col items-center justify-center overflow-hidden border-b border-gray-100">
        <div className="absolute inset-0 bg-white/60 z-10" />
        <Image
          src="/oaz_homecomming.jpg"
          alt=""
          fill
          unoptimized
          loading="eager"
          decoding="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">{title}</h1>
          <p className="text-gray-600 text-lg font-medium">{subtitle}</p>
        </div>
      </section>
 )
}
