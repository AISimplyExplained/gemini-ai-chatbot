// @ts-nocheck

'use client'

import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat-list'
import { ChatPanel } from '@/components/chat-panel'
import { EmptyScreen } from '@/components/empty-screen'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { useEffect, useState } from 'react'
import { useUIState, useAIState } from 'ai/rsc'
import { Message, Session } from '@/lib/types'
import { usePathname, useRouter } from 'next/navigation'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { useGlobalState } from '@/context/GlobalContext'
import {X} from 'lucide-react'

export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  id?: string
  session?: Session
  missingKeys: string[]
}

export function Chat({ id, className, session, missingKeys }: ChatProps) {
  const {selectedPdfUrl, setSelectedPdfUrl} = useGlobalState();
  const router = useRouter()
  const path = usePathname()
  const [input, setInput] = useState('')
  const [messages] = useUIState()
  const [aiState] = useAIState()

  const [_, setNewChatId] = useLocalStorage('newChatId', id)

  useEffect(() => {
    if (session?.user) {
      if (!path.includes('chat') && messages.length === 1) {
        window.history.replaceState({}, '', `/chat/${id}`)
      }
    }
  }, [id, path, session?.user, messages])

  useEffect(() => {
    const messagesLength = aiState.messages?.length
    if (messagesLength === 2) {
      router.refresh()
    }
  }, [aiState.messages, router])

  useEffect(() => {
    setNewChatId(id)
  })

  useEffect(() => {
    missingKeys.map(key => {
      toast.error(`Missing ${key} environment variable!`)
    })
  }, [missingKeys])

  const { messagesRef, scrollRef, visibilityRef, isAtBottom, scrollToBottom } =
      useScrollAnchor()

  return (
    <>
      <div
          className="group w-full overflow-auto pl-0 peer-[[data-state=open]]:lg:pl-[250px] peer-[[data-state=open]]:xl:pl-[300px]"
          ref={scrollRef}
      >
        <div
            className={`transition duration-300 ${selectedPdfUrl ? '-translate-x-1/4' : 'translate-x-0'} pb-[200px] pt-4 md:pt-10 `}
            ref={messagesRef}
        >
          {messages.length ? (
              <ChatList messages={messages} isShared={false} session={session} />
          ) : (
              <EmptyScreen />
          )}
          <div className="w-full h-px" ref={visibilityRef} />
        </div>
        <ChatPanel
            id={id}
            input={input}
            setInput={setInput}
            isAtBottom={isAtBottom}
            scrollToBottom={scrollToBottom}
        />
      </div>
        <Card className={`bg-black fixed right-0 top-0 bottom-0 w-[45%] mt-16 transition ${selectedPdfUrl ? 'block' : 'hidden'}`}>
          <div className='flex justify-end '>
              <X 
                  className='text-white m-4 cursor-pointer rounded-full border-2 border-gray-200' 
                  onClick={() => setSelectedPdfUrl(null)} 
                  size={24}
              />
          </div>
          <embed
              src={selectedPdfUrl}
              allowFullScreen={true}
              zoom
              title="arXiv Paper"
              width="100%"
              height="100%"
          ></embed>
      </Card>
    </>
  )
}