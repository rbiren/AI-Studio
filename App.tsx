
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { GalleryPanel } from './components/GalleryPanel';
import { ImageModal } from './components/ImageModal';
import type { ChatSession, ChatMessageImage, AIMessage } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { IconComponents } from './components/IconComponents';
import { initDB } from './services/db';

const App: React.FC = () => {
  const [allChats, setAllChats] = useLocalStorage<ChatSession[]>('rvDesignerChats', []);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ChatMessageImage | null>(null);

  const activeChat = useMemo(() => {
    return allChats.find(chat => chat.id === activeChatId) || null;
  }, [allChats, activeChatId]);

  const allGeneratedImages = useMemo((): ChatMessageImage[] => {
    return allChats
      .flatMap(chat => chat.messages)
      .flatMap(message => message.images || [])
      .filter(image => image.type === 'generated') 
      .reverse();
  }, [allChats]);

  useEffect(() => {
    initDB().then(success => {
      if (!success) {
        console.error("Failed to initialize the database.");
      }
    });
  }, []);

  const createNewChat = useCallback(() => {
    const newChat: ChatSession = {
      id: `chat_${Date.now()}`,
      title: 'New RV Design',
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setAllChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  }, [setAllChats]);

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
  }, []);
  
  const deleteChat = useCallback((id: string) => {
    setAllChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) {
        const remainingChats = allChats.filter(c => c.id !== id);
        setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
    }
  }, [activeChatId, setAllChats, allChats]);

  const updateChatTitle = useCallback((id: string, newTitle: string) => {
    setAllChats(prev => prev.map(chat => chat.id === id ? { ...chat, title: newTitle } : chat));
  }, [setAllChats]);

  const updateActiveChatMessages = useCallback((messages: AIMessage[]) => {
    if (!activeChatId) return;
    setAllChats(prev => prev.map(chat => 
      chat.id === activeChatId ? { ...chat, messages } : chat
    ));
  }, [activeChatId, setAllChats]);

  React.useEffect(() => {
    if (allChats.length > 0 && !activeChatId) {
      setActiveChatId(allChats[0].id);
    } else if (allChats.length === 0) {
      createNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChats, activeChatId]);

  return (
    <div className="flex h-screen w-screen bg-black text-gray-200 font-sans">
      <Sidebar
        chats={allChats}
        activeChatId={activeChatId}
        onNewChat={createNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        onUpdateTitle={updateChatTitle}
      />
      <main className="flex-1 flex flex-col bg-gray-900/50">
        {activeChat ? (
          <ChatView
            key={activeChat.id}
            chatSession={activeChat}
            setMessages={updateActiveChatMessages}
            onImageClick={setSelectedImage}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <IconComponents.Sparkles className="w-16 h-16 mb-4"/>
            <h1 className="text-2xl font-bold">RV Designer AI</h1>
            <p>Create a new chat to start designing your next RV.</p>
          </div>
        )}
      </main>
      <GalleryPanel images={allGeneratedImages} onImageClick={setSelectedImage} />
      
      {selectedImage && selectedImage.data && (
        <ImageModal 
          imageUrl={`data:${selectedImage.mimeType};base64,${selectedImage.data}`}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
};

export default App;
