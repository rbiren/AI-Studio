import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { ChatSession, AIMessage, ChatMessageImage } from '../types';
import { generateImageWithPrompt, generateWithNanoBanana, fetchSuggestedEdits } from '../services/geminiService';
import { saveImage } from '../services/db';
import { useImageLoader } from '../hooks/useImageLoader';
import { IconComponents } from './IconComponents';
import { DesignMatrix } from './DesignMatrix';

interface ChatViewProps {
  chatSession: ChatSession;
  setMessages: (messages: AIMessage[]) => void;
  onImageClick: (image: ChatMessageImage) => void;
}

const LoadedMessageImage: React.FC<{ image: ChatMessageImage; onImageClick: (image: ChatMessageImage) => void; }> = ({ image, onImageClick }) => {
    const { loadedImage, isLoading } = useImageLoader(image);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!loadedImage?.data) {
            console.error("No image data to download");
            return;
        }
        const link = document.createElement('a');
        link.href = `data:${loadedImage.mimeType};base64,${loadedImage.data}`;
        const fileExtension = loadedImage.mimeType.split('/')[1] || 'jpeg';
        link.download = `rv-design-${loadedImage.id}.${fileExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return <div className="rounded-md bg-gray-700/50 aspect-video flex items-center justify-center animate-pulse"></div>;
    }
    
    if (!loadedImage?.data) {
        return (
            <div className="rounded-md bg-gray-700/50 aspect-video flex items-center justify-center text-xs text-gray-500 font-mono">
                [Image not loaded]
            </div>
        );
    }

    return (
        <div 
            className="relative group cursor-pointer"
            onClick={() => onImageClick(loadedImage)}
        >
            <img src={`data:${loadedImage.mimeType};base64,${loadedImage.data}`} alt="RV design" className="rounded-md" />
            <button
                onClick={handleDownload}
                aria-label="Download image"
                className="absolute bottom-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
                <IconComponents.Download className="w-4 h-4" />
            </button>
        </div>
    );
};


const Message: React.FC<{ message: AIMessage; onImageClick: (image: ChatMessageImage) => void; }> = ({ message, onImageClick }) => {
    const isModel = message.role === 'model';
    return (
        <div className={`flex my-4 ${isModel ? '' : 'justify-end'}`}>
            <div className={`p-4 rounded-lg max-w-4xl ${isModel ? 'bg-gray-800' : 'bg-indigo-600 text-white'}`}>
                {message.text && <p className="text-sm whitespace-pre-wrap">{message.text}</p>}
                {message.images && message.images.length > 0 && (
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {message.images.map(img => (
                           <LoadedMessageImage key={img.id} image={img} onImageClick={onImageClick} />
                        ))}
                    </div>
                )}
                 {message.isLoading && (
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

const SuggestedEdits: React.FC<{ suggestions: string[], onSelect: (suggestion: string) => void }> = ({ suggestions, onSelect }) => {
    if (suggestions.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2 justify-start my-4 px-10">
            {suggestions.map((s, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(s)}
                    className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"
                >
                    {s}
                </button>
            ))}
        </div>
    );
};


export const ChatView: React.FC<ChatViewProps> = ({ chatSession, setMessages, onImageClick }) => {
  const [input, setInput] = useState('');
  const [imageFiles, setImageFiles] = useState<{file: File, preview: string}[]>([]);
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [matrixImageToEdit, setMatrixImageToEdit] = useState<ChatMessageImage | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
        if ((window as any).aistudio) {
            const has = await (window as any).aistudio.hasSelectedApiKey();
            setHasApiKey(has);
        } else {
            setHasApiKey(true); // Fallback if not running in the specific environment
        }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatSession.messages]);

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
  });

  const connectApiKey = async () => {
      if ((window as any).aistudio) {
          await (window as any).aistudio.openSelectKey();
          // Assume success after dialog closes
          setHasApiKey(true);
      }
  };

  const handleSubmit = async (prompt?: string) => {
    if (!hasApiKey) {
        await connectApiKey();
        // Check again after attempt
        const has = await (window as any).aistudio?.hasSelectedApiKey();
        if (!has) return;
    }

    const textToSend = (prompt || input).trim();
    if (!textToSend && imageFiles.length === 0) return;

    const userMessageImages: ChatMessageImage[] = [];
    for (const [i, f] of imageFiles.entries()) {
        const base64 = await toBase64(f.file);
        const id = `upload_${Date.now()}_${i}`;
        const newImage: ChatMessageImage = { id, data: base64, type: 'uploaded', mimeType: f.file.type };
        userMessageImages.push(newImage);
        await saveImage({ id, data: base64, mimeType: f.file.type });
    }

    const userMessage: AIMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        text: textToSend,
        images: userMessageImages,
    };
    
    const lastModelMessage = [...chatSession.messages].reverse().find(m => m.role === 'model');
    const wasLastMessageAnImage = lastModelMessage?.images?.some(i => i.type === 'generated') ?? false;
    const isLastImageMissingData = wasLastMessageAnImage && !lastModelMessage?.images?.some(i => i.type === 'generated' && i.data);

    if (imageFiles.length === 0 && textToSend && isLastImageMissingData) {
        const alertMessage: AIMessage = {
            id: `error_${Date.now()}`,
            role: 'model',
            text: 'Sorry, I can\'t edit images from previous sessions as they are not stored locally. Please upload the image again to make edits, or describe a new design.'
        };
        setMessages([...chatSession.messages, userMessage, alertMessage]);
        setInput('');
        return;
    }

    const loadingMessage: AIMessage = {
        id: `model_${Date.now()}_loading`,
        role: 'model',
        isLoading: true
    };
    
    setMessages([...chatSession.messages, userMessage, loadingMessage]);
    setInput('');
    setImageFiles([]);

    try {
        let responseMessage: AIMessage;
        const updatedHistory = [...chatSession.messages, userMessage];

        const lastModelMessageWithImage = [...chatSession.messages]
          .reverse()
          .find(m => m.role === 'model' && m.images?.some(i => i.type === 'generated')); 
        const lastGeneratedImage = lastModelMessageWithImage?.images?.find(i => i.type === 'generated');

        const uploadedImagesData = userMessageImages.map(img => ({ data: img.data!, mimeType: img.mimeType }));

        if (lastGeneratedImage) {
            // This is an edit. The base image is the last generated one. Uploaded images are for reference.
            const imagesForApi = [
                // The lastGeneratedImage might not have data, so we need to load it
                { data: lastGeneratedImage.data!, mimeType: lastGeneratedImage.mimeType },
                ...uploadedImagesData
            ];
            responseMessage = await generateWithNanoBanana(textToSend, imagesForApi);
        } else if (uploadedImagesData.length > 0) {
            // No previous image in chat, but user uploaded one (or more).
            // Treat the first uploaded image as the base image.
            responseMessage = await generateWithNanoBanana(textToSend, uploadedImagesData);
        } else {
            // No images at all, generate a new one from scratch.
            responseMessage = await generateImageWithPrompt(textToSend);
        }
        
        if (responseMessage.images) {
            for(const image of responseMessage.images) {
                if (image.data) {
                    await saveImage({ id: image.id, mimeType: image.mimeType, data: image.data });
                }
            }
        }

        if (responseMessage.images && responseMessage.images.length > 0) {
            const newImage = responseMessage.images[0];
            if (newImage && newImage.data) {
                responseMessage.suggestions = await fetchSuggestedEdits(updatedHistory, { 
                    data: newImage.data, 
                    mimeType: newImage.mimeType 
                });
            } else {
                responseMessage.suggestions = await fetchSuggestedEdits(updatedHistory);
            }
        } else {
           responseMessage.suggestions = await fetchSuggestedEdits(updatedHistory);
        }

        setMessages([...chatSession.messages, userMessage, responseMessage]);
    } catch (error) {
        console.error("Error with Gemini API:", error);
        
        let errorText = `Sorry, I encountered an error. Please try again.\n\nDetails: ${error instanceof Error ? error.message : String(error)}`;
        
        // Handle race condition or expired key for paid projects
        if (error instanceof Error && error.message.includes("Requested entity was not found")) {
            setHasApiKey(false);
            errorText = "The selected Google Cloud Project or API Key seems invalid or expired. Please select a valid project to continue.";
            await connectApiKey();
        }

        const errorMessage: AIMessage = {
            id: `error_${Date.now()}`,
            role: 'model',
            text: errorText
        };
        setMessages([...chatSession.messages, userMessage, errorMessage]);
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    // Re-check API key before suggestion click too
    if (!hasApiKey) {
         await connectApiKey();
         const has = await (window as any).aistudio?.hasSelectedApiKey();
         if (!has) return;
    }

    const lastModelMessageWithImage = [...chatSession.messages]
      .reverse()
      .find(m => m.role === 'model' && m.images?.some(i => i.data));
      
    if (lastModelMessageWithImage && lastModelMessageWithImage.images) {
      const lastImage = lastModelMessageWithImage.images.find(i => i.data);
      if (!lastImage || !lastImage.data) return;

      const userMessage: AIMessage = {
          id: `user_${Date.now()}`,
          role: 'user',
          text: suggestion,
          images: []
      };
      
      const loadingMessage: AIMessage = {
          id: `model_${Date.now()}_loading`,
          role: 'model',
          isLoading: true
      };
      
      setMessages([...chatSession.messages, userMessage, loadingMessage]);
      setInput('');
      setImageFiles([]);

      try {
          const imageToEdit = { data: lastImage.data, mimeType: lastImage.mimeType };
          let responseMessage = await generateWithNanoBanana(suggestion, [imageToEdit]);
          
          if (responseMessage.images) {
              for(const image of responseMessage.images) {
                  if (image.data) {
                      await saveImage({ id: image.id, mimeType: image.mimeType, data: image.data });
                  }
              }
          }
          
          const updatedHistory = [...chatSession.messages, userMessage];
          
          if (responseMessage.images && responseMessage.images.length > 0) {
              const newImage = responseMessage.images[0];
              if (newImage && newImage.data) {
                  responseMessage.suggestions = await fetchSuggestedEdits(updatedHistory, { 
                      data: newImage.data, 
                      mimeType: newImage.mimeType 
                  });
              } else {
                  responseMessage.suggestions = await fetchSuggestedEdits(updatedHistory);
              }
          }

          setMessages([...chatSession.messages, userMessage, responseMessage]);
      } catch (error) {
          console.error("Error with Gemini API:", error);
           let errorText = `Sorry, I encountered an error. Please try again.\n\nDetails: ${error instanceof Error ? error.message : String(error)}`;

          if (error instanceof Error && error.message.includes("Requested entity was not found")) {
            setHasApiKey(false);
            errorText = "The selected Google Cloud Project or API Key seems invalid or expired. Please select a valid project to continue.";
            await connectApiKey();
          }

          const errorMessage: AIMessage = {
              id: `error_${Date.now()}`,
              role: 'model',
              text: errorText
          };
          setMessages([...chatSession.messages, userMessage, errorMessage]);
      }
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).map((file: File) => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setImageFiles(prev => [...prev, ...files]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const { isLastImageEditable, lastMessageSuggestions, placeholderText } = useMemo(() => {
    const lastMessage = chatSession.messages[chatSession.messages.length - 1];
    const wasLastMessageAnImage = lastMessage?.role === 'model' && lastMessage?.images?.some(i => i.type === 'generated');
    const isEditable = wasLastMessageAnImage || false;

    return {
        isLastImageEditable: isEditable,
        lastMessageSuggestions: lastMessage?.suggestions || [],
        placeholderText: isEditable
            ? "Ask for an edit or describe a new design..."
            : "Describe your RV design to generate an image..."
    };
  }, [chatSession.messages]);

  const handleOpenMatrix = () => {
    const lastModelMessageWithImage = [...chatSession.messages]
      .reverse()
      .find(m => m.role === 'model' && m.images?.some(i => i.type === 'generated'));
    
    const lastGeneratedImage = lastModelMessageWithImage?.images?.find(i => i.type === 'generated');

    if (!lastGeneratedImage) {
        console.warn("No generated image found to open in Design Matrix.");
        return;
    }
    setMatrixImageToEdit(lastGeneratedImage);
    setIsMatrixOpen(true);
  };
  
  const handleMatrixGenerate = (prompt: string) => {
    handleSubmit(prompt);
    setIsMatrixOpen(false);
    setMatrixImageToEdit(null);
  };
  
  const handleCloseMatrix = () => {
      setIsMatrixOpen(false);
      setMatrixImageToEdit(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 lg:px-10">
        {chatSession.messages.map((msg, index) => <Message key={msg.id || index} message={msg} onImageClick={onImageClick} />)}
        <div ref={messagesEndRef} />
      </div>
      {isLastImageEditable && <SuggestedEdits suggestions={lastMessageSuggestions} onSelect={handleSuggestionClick} />}
      <div className="px-4 lg:px-10 pb-4">
        <div className="bg-gray-800 rounded-lg p-2.5">
           {imageFiles.length > 0 && (
                <div className="flex space-x-2 mb-2 p-2 border-b border-gray-700">
                    {imageFiles.map((img, i) => (
                        <div key={i} className="relative">
                            <img src={img.preview} alt="preview" className="h-16 w-16 object-cover rounded"/>
                            <button onClick={() => removeImage(i)} className="absolute top-0 right-0 bg-black/50 text-white rounded-full p-0.5">
                                <IconComponents.Close className="w-3 h-3"/>
                            </button>
                        </div>
                    ))}
                </div>
           )}
          <div className="flex items-center">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white">
                <IconComponents.Paperclip className="w-5 h-5"/>
            </button>
            <button 
                onClick={handleOpenMatrix} 
                disabled={!isLastImageEditable}
                className="p-2 text-gray-400 hover:text-white disabled:text-gray-600 disabled:cursor-not-allowed"
                aria-label="Open Design Matrix"
            >
                <IconComponents.Wand className="w-5 h-5"/>
            </button>
            <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            
            {hasApiKey ? (
                <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                placeholder={placeholderText}
                className="flex-1 bg-transparent px-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
                />
            ) : (
                <div className="flex-1 px-2 flex items-center">
                    <button 
                        onClick={connectApiKey}
                        className="text-xs bg-yellow-600/20 text-yellow-300 border border-yellow-600/50 px-3 py-1.5 rounded-full hover:bg-yellow-600/30 transition-colors flex items-center gap-2"
                    >
                        <IconComponents.Sparkles className="w-3 h-3" />
                        Connect Google Cloud Project (Required for Gemini 3 Pro)
                    </button>
                </div>
            )}
            
            <button onClick={() => handleSubmit()} disabled={(!input.trim() && imageFiles.length === 0) || !hasApiKey} className="p-2 bg-indigo-600 rounded-md text-white disabled:bg-gray-600 disabled:cursor-not-allowed">
                <IconComponents.Send className="w-5 h-5"/>
            </button>
          </div>
        </div>
      </div>
       <DesignMatrix 
        isOpen={isMatrixOpen}
        onClose={handleCloseMatrix}
        onGenerate={handleMatrixGenerate}
        imageToEdit={matrixImageToEdit}
        chatHistory={chatSession.messages}
      />
    </div>
  );
};