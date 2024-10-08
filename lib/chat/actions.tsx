// @ts-nocheck
import 'server-only'
import { anthropic } from '@ai-sdk/anthropic';
import { parseStringPromise } from 'xml2js';


import { createOpenAI, openai } from '@ai-sdk/openai'
import {
  createAI,
  createStreamableUI,
  createStreamableValue,
  getAIState,
  getMutableAIState,
  streamUI
} from 'ai/rsc'

import OpenAI from 'openai'

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
import { SpinnerMessage, ToolCallLoading, ToolImageLoading, ToolImages, ToolMessage, UserMessage, ToolLoadingAnimate, ArxivToolMessage } from '@/components/stocks/message'
import { Stocks } from '@/components/stocks/stocks'
import { Chat } from '@/lib/types'
import {
  formatNumber,
  nanoid,
  runAsyncFnWithoutBlocking,
  sleep
} from '@/lib/utils'

import { generateText, tool } from 'ai';
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

async function getWebSearches(query) {
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

    const linksArray = [];
    const data = await response.json();
    let resultString : string = `Search Results for "${query}": `;

    if (data.webPages && data.webPages.value) {
      resultString += "Web Pages result: ";
      data.webPages.value.forEach((page) => {
        resultString += `- ${page.name}: ${page.url} ,`;
        linksArray.push({"link": page.url, "name": page.name})
        if (page.snippet) resultString += `  Snippet: ${page.snippet} ,`;
        resultString += ",";
      });
    }

    if (data.images && data.images.value) {
      resultString += "Images result: ";
      data.images.value.forEach((image) => {
        resultString += `- ${image.name}: ${image.contentUrl}, `;
        resultString += `  Thumbnail: ${image.thumbnailUrl},`;
      });
    }

    if (data.videos && data.videos.value) {
      resultString += "Videos result: ";
      data.videos.value.forEach((video) => {
        resultString += `- ${video.name}: ${video.contentUrl} ,`;
        if (video.description)
          resultString += `  Description: ${video.description} ,`;
        resultString += `  Thumbnail: ${video.thumbnailUrl}, `;
      });
    }

    if (data.news && data.news.value) {
      resultString += "News result:,";
      data.news.value.forEach((news) => {
        resultString += `- ${news.name}: ${news.url},`;
        if (news.description)
          resultString += `  Description: ${news.description},`;
        if (news.image && news.image.thumbnail) {
          resultString += `  Thumbnail: ${news.image.thumbnail.contentUrl},`;
        }
        resultString += ",";
      });
    }

    return {resultString, linksArray};
  } catch (error) {
    console.error("Error fetching search results:", error);
    return "Something went wrong. Please try again."
  }
}

// async function fetchArxiv(query) {
//   console.log(query)
//   try {
//     const response = await fetch(`http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=10`);
//     if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
//     const xml = await response.text();
//     const json = await parseStringPromise(xml);
//     return json;
//   } catch (error) {
//     console.error('Error fetching or converting data:', error);
//     throw error;
//   }
// }

async function fetchArxiv(query, time) {
  console.log(query, time);
  try {
    const apiUrl = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query +" "+time)}${time ? "&start=0&max_results=40" : ""}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      return "HTTP error!";
    }
    
    const xml = await response.text();
    const json = await parseStringPromise(xml);
    
    if (time) {
      let parsedDate;
      if (time.length === 4) parsedDate = new Date(time + '-01-01T00:00:00Z');
      else if (time.length === 7) parsedDate = new Date(time + '-01T00:00:00Z');
      else return "Invalid time format";
      
      if (!json || !json.feed || !json.feed.entry) return "No relevant data found";
      
      const filteredData = json.feed.entry.filter((it) => {
        const publishedDate = new Date(it.published[0]);
        return publishedDate >= parsedDate;
      });
      
      console.log(filteredData.length);
      
      if (filteredData.length === 0) return "No relevant data found within the specified time";      
      return filteredData;
    } else {
      return json;
    }
  } catch (error) {
    console.error('Error fetching or converting data:', error);
    return "Something went wrong";
  }
}






const getFormattedDate = () => {
  const today = new Date();
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  return today.toLocaleDateString('en-CA', options); // 'en-CA' locale formats date as YYYY-MM-DD
};


async function submitUserMessage(
  content: string,
  model: string,
  images?: string[],
  pdfFiles?: { name: string; text: string }[],
  csvFiles?: { name: string; text: string }[]
) {
  'use server'

  const openaiOriginal = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

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
  const isAnthropicModel= model ==='claude-3-5-sonnet-20240620'

  const api = isGroqModel ? groq : isGeminiModel ? gemini : isAnthropicModel ? anthropic : openai
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
    system: ['o1-preview', 'o1-mini'].includes(model) ? undefined : `You are a helpful assistant`,
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
        generate: async function* ({ query }) {
          let concisedQuery = '';

          try {
            const { text, finishReason, usage } = await generateText({
              system: 'You will should receive the query, identify its primary context, and generate a concise and precise query that captures the main intent. For example, if the input query is get the latest AI news, the model should output latest AI news.',
              model: openai('gpt-3.5-turbo'),
              prompt: query,
            });
            concisedQuery = text;
          } catch (error) {
            console.error("An error occurred:", error);
          }
          
          yield <ToolCallLoading concisedQuery={concisedQuery}/>
          await sleep(1000);
          const toolCallId = nanoid();
          const {resultString, linksArray}  = await getWebSearches(query);
          const finalToolResult = resultString;
          const toolCallMeta = {concisedQuery, linksArray}


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

          // Let's get the text response          
          const newResult = await streamUI({
            model: api(model),
            initial: <ToolCallLoading concisedQuery={concisedQuery}/>,
            system: `You are a helpful assistant, you extract the relevant data from the given data and try to answer precisely, only share links if asked or required`,
            messages: [
              ...aiState.get().messages
            ],
            text: ({ content, done, delta }) => {
              if (!textStream) {
                textStream = createStreamableValue('')
                textNode = <ToolMessage content={textStream.value} toolCallMeta={toolCallMeta}/>
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
                          text: content,
                          meta: toolCallMeta,
                          toolName: 'searchWeb'
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
        },
      }),
      generateImage: tool({
        description: 'A tool for generating images using DALL·E 3.',
        parameters: z.object({
          prompt: z.string().describe('The prompt for image generation'),
        }),
        generate: async function* ({ prompt }) {
          yield <ToolImageLoading/>
          await sleep(1000)
          const toolCallId = nanoid()

          let imageUrl = ''
          try {
            const completion = await openaiOriginal.images.generate({
              prompt,
              model: 'dall-e-3',
            })

            imageUrl = completion?.data?.[0]?.url
          } catch (error) {
            console.error('An error occurred:', error)
          }

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
                    toolName: 'generateImage',
                    toolCallId,
                    args: { prompt }
                  }
                ]
              },
              {
                id: nanoid(),
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolName: 'generateImage',
                    toolCallId,
                    result: imageUrl
                  }
                ]
              }
            ]
          })
          const newResult = await streamUI({
            model: api(model),
            initial: <h1>Generating image...</h1>,
            system: `You are a helpful assistant. You extract relevant data from the given data and try to answer precisely, only share links if asked or required.`,
            messages: [
              ...aiState.get().messages,
            ],
            text: ({ content, done, delta }) => {
              if (!textStream) {
                textStream = createStreamableValue('');
                textNode = <ToolImages content={textStream.value}/>
              }
        
              if (done) {
                textStream.done();
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
                          text: content,
                        },
                        {
                          type: 'image',
                          url: imageUrl,
                        },
                      ],
                    },
                  ],
                });
              } else {
                textStream.update(delta);
              }
              return textNode;
            },
          });

          return newResult.value;
        }
      }),
      arxivApiCaller: tool({
        description: 'A tool for calling arxiv api to search research papers.',
        parameters: z.object({ 
          query: z.string().describe('The search query to be included in the arXiv URL parameter'), 
          time: z.string().describe(`The specific date for which to search results, formatted as a year-month (e.g., 2023-05), or can be empty string if not specified, remember today is ${getFormattedDate()}`)
        }),        
        generate: async function* ({ query, time }) {
          yield <ToolLoadingAnimate searchQuery={query+" "+time} >{"Calling the arvix tool "}</ToolLoadingAnimate>
          await sleep(1000);
          const toolCallId = nanoid();
          const result = await fetchArxiv(query , time);

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
                    toolName: 'arxivApiCaller',
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
                    toolName: 'arxivApiCaller',
                    toolCallId,
                    result: result
                  }
                ]
              }
            ]
          })

          // Let's get the text response          
          const newResult = await streamUI({
            model: api(model),
            initial: <h1>Extracting data...</h1>,
            system: `You are a helpful assistant, you process the json data and extract the information such as title, published, links, summary`,
            messages: [
              ...aiState.get().messages
            ],
            text: ({ content, done, delta }) => {
              if (!textStream) {
                textStream = createStreamableValue('')
                textNode = <ArxivToolMessage content={textStream.value} query={query+" "+time} />
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
                          text: content,
                          toolName : 'arxivApiCaller',
                          meta: `${query} ${time}`
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
      const firstMessageContent = messages[0].content
      const title = firstMessageContent[0].text.substring(0, 100)
      // const title = 'firstMessageContent.substring(0, 100)'

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
  // aiState.messages.map(m => {
  //   console.log(m.role)
  //   console.log(m.content)
  //   console.log('----------------------------')
  // })

  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        ) 
        : message.role === 'user' ? (
          <UserMessage>{message?.content[0]?.text as string}</UserMessage>
        ) 
        : message.role === 'assistant' ? (
              typeof message.content === 'string' ? (
                <BotMessage content={message.content} />
              ) : (
                typeof message.content === 'object' &&
                (message.content[0]?.toolName === 'searchWeb' ? (
                  <BotCard>
                    <ToolMessage content={message.content[0].text} toolCallMeta={message.content[0].meta} />
                  </BotCard>
                ) : message.content[0]?.toolName === 'arxivApiCaller' ? (
                  <BotCard>
                    <ArxivToolMessage content={message?.content[0]?.text} query={message.content[0].meta} />
                  </BotCard>
                ) : null)
              )
        ) : null
    }))
}
