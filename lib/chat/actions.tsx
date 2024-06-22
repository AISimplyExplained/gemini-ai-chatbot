// @ts-nocheck
import 'server-only'
import { anthropic } from '@ai-sdk/anthropic';

import { createOpenAI, openai } from '@ai-sdk/openai'
import {
  createAI,
  createStreamableUI,
  createStreamableValue,
  getAIState,
  getMutableAIState,
  streamUI
} from 'ai/rsc'

import {
  BotCard,
  BotMessage,
  Purchase,
  Stock,
  SystemMessage,
  spinner
} from '@/components/stocks'

import { saveChat } from '@/app/actions'
import { auth } from '@/auth'
import { Events } from '@/components/stocks/events'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Stocks } from '@/components/stocks/stocks'
import { Chat } from '@/lib/types'
import {
  formatNumber,
  nanoid,
  runAsyncFnWithoutBlocking,
  sleep
} from '@/lib/utils'

import { tool } from 'ai';
import { z } from 'zod';

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{' '}
          {formatNumber(amount * price)}
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
        {formatNumber(amount * price)}.
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}
type TextPart = {
  type: 'text'
  text: string
}

type ImagePart = {
  type: 'image'
  image: string
}

type MessageContent = TextPart | ImagePart

type UserMessage = {
  id: string
  role: 'user'
  content: MessageContent[]
}

type AssistantMessage = {
  id: string
  role: 'assistant'
  content: string
}

type SystemMessage = {
  id: string
  role: 'system'
  content: string
}

type Message = UserMessage | AssistantMessage | SystemMessage

async function getWebSearches(query) : string{
  const endpoint = "https://api.bing.microsoft.com/v7.0/search";      
  const urlQuery = encodeURIComponent(query);      
  const apiKey = process.env.BING_SEARCH_API_KEY
  const options = {
    mkt: "en-us",
    safeSearch: "moderate",
    textDecorations: true,
    textFormat: "raw",
    count: 10,
    offset: 0,
  };
  const queryParams = new URLSearchParams({
    q: urlQuery,
    ...options,
  }).toString();

  const url = `${endpoint}?${queryParams}`;      
  const headers = {
    "Ocp-Apim-Subscription-Key": apiKey,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
  };

  try {
    const response = await fetch(url, { headers });      
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    let resultString : string = `Search Results for "${query}":\n\n`;

    if (data.webPages && data.webPages.value) {
      resultString += "Web Pages:\n";
      data.webPages.value.forEach((page) => {
        resultString += `- ${page.name}: ${page.url}\n`;
        if (page.snippet) resultString += `  Snippet: ${page.snippet}\n`;
        resultString += "\n";
      });
    }

    if (data.images && data.images.value) {
      resultString += "Images:\n";
      data.images.value.forEach((image) => {
        resultString += `- ${image.name}: ${image.contentUrl}\n`;
        resultString += `  Thumbnail: ${image.thumbnailUrl}\n\n`;
      });
    }

    if (data.videos && data.videos.value) {
      resultString += "Videos:\n";
      data.videos.value.forEach((video) => {
        resultString += `- ${video.name}: ${video.contentUrl}\n`;
        if (video.description)
          resultString += `  Description: ${video.description}\n`;
        resultString += `  Thumbnail: ${video.thumbnailUrl}\n\n`;
      });
    }

    if (data.news && data.news.value) {
      resultString += "News:\n";
      data.news.value.forEach((news) => {
        resultString += `- ${news.name}: ${news.url}\n`;
        if (news.description)
          resultString += `  Description: ${news.description}\n`;
        if (news.image && news.image.thumbnail) {
          resultString += `  Thumbnail: ${news.image.thumbnail.contentUrl}\n`;
        }
        resultString += "\n";
      });
    }

    return resultString;
  } catch (error) {
    console.error("Error fetching search results:", error);
    return "Something went wrong. Please try again."
  }
}


async function submitUserMessage(
  content: string,
  model: string,
  images?: string[],
  pdfFiles?: { name: string; text: string }[],
  csvFiles?: { name: string; text: string }[]
) {
  'use server'

  const groq = createOpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY
  })
  const gemini = createOpenAI({
    baseURL: 'https://my-openai-gemini-omega-three.vercel.app/v1',
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY
  })
  // List of Groq models
  const groqModels = ['llama3-70b-8192', 'gemma-7b-it', 'mixtral-8x7b-32768']
  // Determine the API based on the model name
  const isGeminiModel = model === 'gemini'
  const isGroqModel = groqModels.includes(model)
  const isAnthropicModel= model ==='claude-3-sonnet-20240229'

  const api = isGroqModel ? groq : isGeminiModel ? gemini : isGeminiModel ? anthropic : openai
  const aiState = getMutableAIState<typeof AI>()

  // Prepare the message content
  const messageContent: MessageContent[] = []

  if (content) {
    messageContent.push({ type: 'text', text: content })
  }

  if (pdfFiles && pdfFiles.length > 0) {
    pdfFiles.map(val => {
      messageContent.push({
        type: 'text',
        // To ensure that AI reads this text in PDF formate
        text:
          'Treat the below text as pdf. \n' +
          val.text +
          '\n here, this Pdf ends.'
      })
    })
  }

  if (images && images.length > 0) {
    images.forEach(image => {
      // Remove the base64 header if present
      const base64Image = image.split(',')[1]
      messageContent.push({ type: 'image', image: base64Image })
    })
  }

  if (csvFiles && csvFiles.length > 0) {
    csvFiles.forEach(file => {
      messageContent.push({
        type: 'text',
        // To ensure that AI reads this text in CSV formate
        text:
          'Treat the below text as csv data \n' +
          file.text +
          '\n Csv data ends here.'
      })
    })
  }

 
  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content: messageContent
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const result = await streamUI({
    model: api(model),
    initial: <SpinnerMessage />,
    system: `You are a helpful assistant`,
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
      searchWeb: tool({
        description: 'A tool for performing web searches.',
        parameters: z.object({ query: z.string().describe('The query for web search') }),
        generate: async ({ query }) => {

          await sleep(1000);
          const toolCallId = nanoid();

          const finalToolResult = await getWebSearches(query);

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
                    toolName: 'searchWeb',
                    toolCallId,
                    args: { query }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'searchWeb',
                    toolCallId,
                    result: finalToolResult
                  }
                ]
              }
            ]
          })

          // const log = aiState.get().messages;
          // for(let i = 0; i< log.length; i++){
          //   console.log(log[i].role, log[i].content)
          // }
          // console.log(aiState.get())

          // Let's get the text response          
          const newResult = await streamUI({
            model: api(model),
            initial: <SpinnerMessage />,
            system: `You are a helpful assistant, you extract the relevant data from the given data`,
            messages: [
              ...aiState.get().messages
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
                      content: [
                        {
                          type: 'text',
                          text: content
                        }
                      ]
                    }
                  ]
                })
              } else {
                textStream.update(delta)
              }
              return textNode
            }
          })
          return (
            newResult.value
          )
          // return finalToolResult;
        },
      }),
    },
  });

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
    submitUserMessage,
    confirmPurchase
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

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
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                {/* @ts-expect-error */}
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Events props={tool.result} />
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
