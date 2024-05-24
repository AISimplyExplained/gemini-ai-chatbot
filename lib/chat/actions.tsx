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
import { createOpenAI } from '@ai-sdk/openai';

import {
    spinner,
    BotCard,
    BotMessage,
    SystemMessage,
    Stock,
    Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
    formatNumber,
    runAsyncFnWithoutBlocking,
    sleep,
    nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat } from '@/lib/types'
import { auth } from '@/auth'

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
    type: 'text';
    text: string;
};

type ImagePart = {
    type: 'image';
    image: string;
};

type MessageContent = TextPart | ImagePart;

type UserMessage = {
    id: string;
    role: 'user';
    content: MessageContent[];
};

type AssistantMessage = {
    id: string;
    role: 'assistant';
    content: string;
};

type SystemMessage = {
    id: string;
    role: 'system';
    content: string;
};

type Message = UserMessage | AssistantMessage | SystemMessage;

async function submitUserMessage(content: string, model: string, images?: string[]) {
    'use server'

    const groq = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
    });
    const gemini = createOpenAI({
        baseURL: 'https://my-openai-gemini-omega-three.vercel.app/v1',
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    const isGroqModel = model.startsWith("llama3-70b-8192");
    const isGeminiModel = model === "gemini";
    const api = isGroqModel ? groq : isGeminiModel ? gemini : openai;
    const aiState = getMutableAIState<typeof AI>()

    const messageContent: MessageContent[] = [];

    if (content) {
        messageContent.push({ type: 'text', text: content });
    }
    if (images && images.length > 0) {
        images.forEach(image => {
            const base64Image = image.split(',')[1];
            messageContent.push({ type: 'image', image: base64Image });
        });
    }

    const userMessage: UserMessage = {
        id: nanoid(),
        role: 'user',
        content: messageContent
    };

    aiState.update({
        ...aiState.get(),
        messages: [
            ...aiState.get().messages,
            // @ts-ignore
            userMessage
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
                        // @ts-ignore
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
                    message.content.map((tool: any) => {
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
                ) : message.role === 'user' ? (
                    <UserMessage>{message.content.map((part: MessageContent) =>
                        part.type === 'text' ? (
                            <p>{part.text}</p>
                        ) : (
                            <img src={`data:image/png;base64,${part.image}`} alt="User uploaded content" />
                        )
                    )}</UserMessage>
                ) : message.role === 'assistant' && typeof message.content === 'string' ? (
                    <BotMessage content={message.content} />
                ) : null
        }))
}
