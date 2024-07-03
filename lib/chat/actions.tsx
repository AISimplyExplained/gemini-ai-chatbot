// @ts-nocheck
import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { openai } from '@ai-sdk/openai'
import { DOMParser } from '@xmldom/xmldom'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
} from '@/components/stocks'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { z } from 'zod'
import { CategoryMultiSelect } from '@/components/category-multi-select'
import { DateSelect } from '@/components/date-single-select'
import { ArxivResponse } from '@/components/ArxivResponse'
import {
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'

function parseXML(xml) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'text/xml');

  const entries = xmlDoc.getElementsByTagName('entry');
  const results = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    const id = entry.getElementsByTagName('id')[0].textContent;
    const updated = entry.getElementsByTagName('updated')[0].textContent;
    const published = entry.getElementsByTagName('published')[0].textContent;
    const title = entry.getElementsByTagName('title')[0].textContent.trim();
    const summary = entry.getElementsByTagName('summary')[0].textContent.trim();

    const authors = [];
    const authorElements = entry.getElementsByTagName('author');
    for (let j = 0; j < authorElements.length; j++) {
      const author = authorElements[j].getElementsByTagName('name')[0].textContent;
      authors.push(author);
    }

    const links = [];
    const linkElements = entry.getElementsByTagName('link');
    for (let k = 0; k < linkElements.length; k++) {
      const link = {
        href: linkElements[k].getAttribute('href')?.startsWith('http://') ? linkElements[k].getAttribute('href').replace('http://', 'https://') : linkElements[[k]].getAttribute('href'),
        rel: linkElements[k].getAttribute('rel')
      };
      links.push(link);
    }

    results.push({
      id,
      updated,
      published,
      title,
      summary,
      authors,
      links
    });
  }
  return results;
}

async function fetchArxiv(query) {
  console.log(query)
  try {
    const response = await fetch(`https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=5`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const xml = await response.text();
    const json = parseXML(xml)
    return json;
  } catch (error) {
    console.error('Error fetching or converting data:', error);
    throw error;
  }
}

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const result = await streamUI({
    model: openai('gpt-3.5-turbo'),
    initial: <SpinnerMessage />,
    system: `\
    You are an arXiv research paper assistant. You can help users find and discuss research papers from various scientific fields.
    You can ask follow-up questions to clarify the user's request and provide more accurate results.

    If the user mentions a main category (e.g., "Computer Science"), you MUST use the \`show_category_selection\` function to display its subcategories.
    To do this, follow these steps:
    1. Identify the main category mentioned by the user.
    2. Look up the subcategories for that main category in the list below.
    3. Call show_category_selection with these subcategories, using the main category as the title.

    Here are the main categories and their subcategories:

    Computer Science:
    - Artificial Intelligence
    - Computation and Language
    ...

    Mathematics:
    - Algebraic Geometry
    - Algebraic Topology
    ...

    Physics:
    - Accelerator Physics
    - Applied Physics
    ...

    If you need to ask about a date range, use the \`show_date_range_selection\` function.
    If you want to display research papers, use the \`show_research_papers\` function.

    Besides that, you can also chat with users and provide information about scientific research and arXiv.`,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    tools: {
      show_category_selection: {
        description: 'Show a UI for the user to select subcategories of research papers.',
        parameters: z.object({
          categories: z.array(z.string()).describe('List of subcategories to choose from'),
          title: z.string().describe('The title for the category selection UI (usually the main category name)'),
        }),
        generate: async function* ({ categories, title }) {
          yield (
            <BotCard>
              <CategoryMultiSelect categories={categories} />
            </BotCard>
          )

          await sleep(1000)

          const toolCallId = nanoid()

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'show_category_selection',
                    toolCallId,
                    args: { categories, title }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'show_category_selection',
                    toolCallId,
                    result: { categories, title }
                  }
                ]
              }
            ]
          })

          return (
            <BotCard>
              <CategoryMultiSelect categories={categories} />
            </BotCard>
          )
        }
      },
      show_date_range_selection: {
        description: 'Show a UI for the user to select a date range for research papers.',
        parameters: z.object({}),
        generate: async function* () {
          yield (
            <BotCard>
              <DateSelect />
            </BotCard>
          )

          await sleep(1000)

          const toolCallId = nanoid()

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'show_date_range_selection',
                    toolCallId,
                    args: {}
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'show_date_range_selection',
                    toolCallId,
                    result: {}
                  }
                ]
              }
            ]
          })

          return (
            <BotCard>
              <DateSelect />
            </BotCard>
          )
        }
      },
      show_research_papers: {
        description: 'A tool for calling arxiv api to search research papers.',
        parameters: z.object({
          query: z.string().describe('The search query to be included in the arXiv URL parameter'),
          time: z.string().describe(`The specific date for which to search results, formatted as a year-month (e.g., 2023-05), or can be empty string if not specified`)
        }),
        generate: async function* ({ query, time }) {
          yield <SpinnerMessage />

          await sleep(1000)

          const papers = await fetchArxiv(query + " " + time)

          const toolCallId = nanoid()

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolName: 'show_research_papers',
                    toolCallId,
                    args: { query, time }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'show_research_papers',
                    toolCallId,
                    result: papers
                  }
                ]
              }
            ]
          })

          return (
            <BotCard>
              <ArxivResponse papers={papers} />
            </BotCard>
          )
        }
      }
    }
  })

  return {
    id: nanoid(),
    display: result.value
  }
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState() as Chat

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`

      const firstMessageContent = messages[0].content as string
      const title = firstMessageContent.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'show_category_selection' ? (
              <BotCard>
                <CategoryMultiSelect categories={tool.result.categories} />
              </BotCard>
            ) : tool.toolName === 'show_date_range_selection' ? (
              <BotCard>
                <DateSelect />
              </BotCard>
            ) : tool.toolName === 'show_research_papers' ? (
              <BotCard>
                <ArxivResponse papers={tool.result} />
              </BotCard>
            ) : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}