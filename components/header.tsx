/* eslint-disable @next/next/no-img-element */
import * as React from 'react'
import Link from 'next/link'
import {ModelSelector} from "@/components/model-selector";
import { cn } from '@/lib/utils'
import { auth, signIn } from '@/auth'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  IconGitHub,
  IconNextChat,
  IconSeparator,
  IconVercel
} from '@/components/ui/icons'
import { UserMenu } from '@/components/user-menu'
import { SidebarMobile } from './sidebar-mobile'
import { SidebarToggle } from './sidebar-toggle'
import { ChatHistory } from './chat-history'
import { Session } from '@/lib/types'
import { MicorsoftLoginButton } from './microsoft-login-button';

async function UserOrLogin() {
  const session = (await auth()) as Session
  return (
    <>
      {session?.user ? (
        <>
          <SidebarMobile>
            <ChatHistory userId={session.user.id} />
          </SidebarMobile>
          <SidebarToggle />
        </>
      ) : (
        <Link href="https://ai-image-lac.vercel.app/" rel="nofollow">
          <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
        </Link>
      )}
      <div className="flex w-full items-center justify-between">
        <div className='flex items-center'>
          <IconSeparator className="size-6 text-zinc-200" />
          <ModelSelector/>
        </div>
        {session?.user ? <UserMenu user={session.user} /> : <MicorsoftLoginButton />}
      </div>
    </>
  )
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 shrink-0 bg-gradient-to-b from-background/10 via-background/50 to-background/80 backdrop-blur-xl">
      <div className="flex w-full px-4 items-center">
        <React.Suspense fallback={<div className="flex-1 overflow-auto" />}>
          <UserOrLogin />
        </React.Suspense>
      </div>
    </header>
  )
}
