'use client'

/* eslint-disable @next/next/no-img-element */

import { GoogleIcon, IconGemini, IconUser } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { spinner } from './spinner'
import { CodeBlock } from '../ui/codeblock'
import { MemoizedReactMarkdown } from '../markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { StreamableValue } from 'ai/rsc'
import { useStreamableText } from '@/lib/hooks/use-streamable-text'

// Different types of message bubbles.
export function UserMessage({ children }: { children: React.ReactNode }) {
    return (
        <div className="group relative flex items-center justify-end md:-ml-12">
            <div className="mr-4 flex-1 space-y-2 overflow-hidden pr-2 text-right flex justify-end">
                {children}
            </div>
            <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
                <IconUser />
            </div>
        </div>
    );
}



export function BotMessage({
  content,
  className
}: {
  content: string | StreamableValue<string>
  className?: string
}) {
  const text = useStreamableText(content)

  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] == '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  )
                }

                children[0] = (children[0] as string).replace('`▍`', '▍')
              }

              const match = /language-(\w+)/.exec(className || '')

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              )
            }
            
          }}
          
        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}

export function ToolMessage({
  content,
  className,
  concisedQuery
}: {
  content: string | StreamableValue<string>,
  concisedQuery : string,
  className?: string
}) {
  const text = useStreamableText(content)

  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <h1 className='text-gray-500 p-[3px]'>Searched few sites</h1>
        {
          concisedQuery && (
            <a href={`https://www.bing.com/search?q=${encodeURIComponent(concisedQuery)}`} target='_blank' className='text-gray-500 cursor-pointer flex py-4 border border-gray-300 rounded-md shadow-lg'>                
              <img className="w-6 h-6 object-contain mx-2 scale-75" src="/images/search.png" alt="gemini logo" />
              <div className='flex flex-col'>
                <span>
                  "{concisedQuery}"
                </span>
                <span className='text-sm'>
                  bing.com
                </span>
              </div>
            </a>
          )
        }
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] == '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  )
                }

                children[0] = (children[0] as string).replace('`▍`', '▍')
              }

              const match = /language-(\w+)/.exec(className || '')

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              )
            },
            a({ href, children, ...props }) {
              return (
              <a href={href} target='_blank'>
                {children}
              </a>
            )}
          }}
        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}


export function BotCard({
  children,
  showAvatar = true
}: {
  children: React.ReactNode
  showAvatar?: boolean
}) {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div
        className={cn(
          'bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm',
          !showAvatar && 'invisible'
        )}
      >
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 pl-2">{children}</div>
    </div>
  )
}

export function SystemMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={
        'mt-2 flex items-center justify-center gap-2 text-xs text-gray-500'
      }
    >
      <div className={'max-w-[600px] flex-initial p-2'}>{children}</div>
    </div>
  )
}

export function SpinnerMessage() {
  return (
    <div className="group relative flex items-start md:-ml-12">
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 h-[24px] flex flex-row items-center flex-1 space-y-2 overflow-hidden px-1">
        {spinner}
      </div>
    </div>
  )
}

export function ToolCallLoading({concisedQuery} : {concisedQuery: String}) {
  return (
    <div className={cn('group relative flex items-start md:-ml-12')}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <div className="animate-pulse">Searching the web for {concisedQuery.length > 0 ? `"${concisedQuery}"` : "result"}</div>  
      </div>
    </div>
  )
}




/*
export function ToolMessage({
  content,
  className,
  concisedQuery
}: {
  content: string | StreamableValue<string>,
  concisedQuery : string,
  className?: string
}) {
  const text = useStreamableText(content)

  return (
    <div className={cn('group relative flex items-start md:-ml-12', className)}>
      <div className="bg-background flex size-[25px] shrink-0 select-none items-center justify-center rounded-lg border shadow-sm">
        <img className="size-6 object-contain" src="/images/gemini.png" alt="gemini logo" />
      </div>
      <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
        <h1 className='text-gray-500 p-[3px]'>Searched few sites</h1>
        <MemoizedReactMarkdown
          className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0"
          remarkPlugins={[remarkGfm, remarkMath]}
          components={{
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>;
            },
            code({ node, inline, className, children, ...props }) {
              if (children.length) {
                if (children[0] === '▍') {
                  return (
                    <span className="mt-1 animate-pulse cursor-default">▍</span>
                  );
                }

                children[0] = (children[0] as string).replace('`▍`', '▍');
              }

              const match = /language-(\w+)/.exec(className || '');

              if (inline) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }

              return (
                <CodeBlock
                  key={Math.random()}
                  language={(match && match[1]) || ''}
                  value={String(children).replace(/\n$/, '')}
                  {...props}
                />
              );
            },
            a({ href, children, ...props }) {
              return (
              <a href={href} className="no-underline block w-full transition-all duration-300 hover:bg-slate-200">
                <div className='flex items-center py-4 border border-gray-200 rounded-md w-[98%] h-12'>
                  <img className="w-6 h-6 object-contain mx-2 scale-75" src="/images/search.png" alt="gemini logo" />
                  <span className="text-gray-400" {...props}>
                    {children}
                  </span>
                </div>
              </a>
            )}
          }}
        >
          {text}
        </MemoizedReactMarkdown>
      </div>
    </div>
  )
}

*/