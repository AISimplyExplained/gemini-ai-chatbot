import { useModel } from '@/app/context/ModelContext';
import * as React from 'react';
import Textarea from 'react-textarea-autosize';
import { useActions, useUIState } from 'ai/rsc';
import { UserMessage } from './stocks/message';
import { type AI } from '@/lib/chat/actions';
import { Button } from '@/components/ui/button';
import { IconArrowElbow, IconPlus, IconTrash } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEnterSubmit } from '@/lib/hooks/use-enter-submit';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';

export function PromptForm({
                               input,
                               setInput,
                           }: {
    input: string;
    setInput: (value: string) => void;
}) {
    const { formRef, onKeyDown } = useEnterSubmit();
    const inputRef = React.useRef<HTMLTextAreaElement>(null);
    const { submitUserMessage } = useActions();
    const [messages, setMessages] = useUIState<typeof AI>();
    const [uploadedImages, setUploadedImages] = React.useState<string[]>([]);
    const { model } = useModel();

    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const fileRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) {
            toast.error('No file selected');
            return;
        }

        const files = Array.from(event.target.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));

        if (imageFiles.length > 0) {
            const base64Images = await Promise.all(
                imageFiles.map(file => readAsBase64(file))
            );

            setUploadedImages(prevImages => [
                ...prevImages,
                ...base64Images.filter(base64String => !!base64String)
            ]);
        } else {
            toast.error('Only image files are allowed');
        }
    };

    const readAsBase64 = (file: File): Promise<string | null> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result as string;
                resolve(base64String);
            };
            reader.onerror = () => {
                toast.error(`Failed to read file: ${file.name}`);
                resolve(null); // resolve with null on error to continue processing other files
            };
            reader.readAsDataURL(file);
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (window.innerWidth < 600) {
            e.currentTarget['message']?.blur();
        }

        const value = input.trim();
        setInput('');
        if (!value && uploadedImages.length === 0) return;

        const combinedContent = (
            <div>
                <p>{value}</p>
                {uploadedImages.map((image, index) => (
                    <img key={index} src={image} alt="Uploaded" className="max-w-full h-auto" />
                ))}
            </div>
        );

        setMessages(currentMessages => [
            ...currentMessages,
            {
                id: nanoid(),
                display: <UserMessage>{combinedContent}</UserMessage>
            }
        ]);

        try {
            const responseMessage = await submitUserMessage(value, model, uploadedImages);
            setMessages(currentMessages => [...currentMessages, responseMessage]);
        } catch {
            toast(
                <div className="text-red-600">
                    You have reached your message limit! Please try again later, or{' '}
                    <a
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                        href="https://vercel.com/templates/next.js/gemini-ai-chatbot"
                    >
                        deploy your own version
                    </a>
                    .
                </div>
            );
        }

        setUploadedImages([]);
    };

    const canUploadAttachments = ['gpt-4', 'gpt-4-turbo', 'gpt-4o-2024-05-13'].includes(model);

    return (
        <form ref={formRef} onSubmit={handleSubmit}>
            <input
                type="file"
                className="hidden"
                id="file"
                ref={fileRef}
                accept="image/*"
                onChange={handleFileChange}
                multiple
            />
            <div className="relative flex w-full items-center bg-zinc-100 px-6 sm:rounded-full sm:px-6">
                {canUploadAttachments && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8 rounded-full bg-background p-0"
                                onClick={() => {
                                    fileRef.current?.click();
                                }}
                            >
                                <IconPlus />
                                <span className="sr-only">New Chat</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Attachments</TooltipContent>
                    </Tooltip>
                )}
                {uploadedImages.length > 0 && (
                    <div className="relative mt-2 mb-2 flex justify-center space-x-2">
                        {uploadedImages.map((image, index) => (
                            <div key={index} className="relative">
                                <img src={image} alt="Uploaded" className="w-12 h-12 object-cover rounded-full border" />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="absolute top-0 right-0 text-red-500 bg-white rounded-full p-1"
                                    onClick={() => setUploadedImages(prevImages => prevImages.filter((_, i) => i !== index))}
                                >
                                    <IconTrash className="w-4 h-4" />
                                    <span className="sr-only">Remove image</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
                <Textarea
                    ref={inputRef}
                    tabIndex={0}
                    onKeyDown={onKeyDown}
                    placeholder="Message Bionic Diamond"
                    className="flex-1 min-h-[60px] bg-transparent placeholder:text-zinc-900 resize-none px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    name="message"
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="submit"
                            size="icon"
                            disabled={input === '' && uploadedImages.length === 0}
                            className="bg-transparent shadow-none text-zinc-950 rounded-full hover:bg-zinc-200"
                        >
                            <IconArrowElbow />
                            <span className="sr-only">Send message</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Send message</TooltipContent>
                </Tooltip>
            </div>

            <p className="text-xs text-gray-300 ml-4 transition-opacity duration-300 ease-in-out text-center">
                Models may make mistakes, always validate your work
            </p>
        </form>
    );
}
