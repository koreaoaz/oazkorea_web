"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export type ManagerRole = {
  loading: boolean
  isMainManager: boolean
  isSubManager: boolean
}

const NO_ROLE: ManagerRole = {
  loading: false,
  isMainManager: false,
  isSubManager: false,
}

// 메인 매니저: who_is_boss 테이블에 uuid가 등록된 사용자
// 서브 매니저: registered_member.is_manager 가 true 인 사용자
export function useManagerRole(): ManagerRole {
  const [role, setRole] = useState<ManagerRole>({ ...NO_ROLE, loading: true })

  useEffect(() => {
    let active = true

    const resolve = async (uuid: string | undefined) => {
      if (!uuid) {
        if (active) setRole(NO_ROLE)
        return
      }

      const [boss, member] = await Promise.all([
        supabase.from("who_is_boss").select("uuid").eq("uuid", uuid).limit(1),
        supabase.from("registered_member").select("is_manager").eq("uuid", uuid).limit(1),
      ])

      if (!active) return

      setRole({
        loading: false,
        isMainManager: (boss.data?.length ?? 0) > 0,
        isSubManager: !!member.data?.[0]?.is_manager,
      })
    }

    supabase.auth.getUser().then(({ data }) => resolve(data.user?.id))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      resolve(session?.user?.id)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return role
}
