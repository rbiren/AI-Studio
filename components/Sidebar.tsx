
import React, { useState } from 'react';
import type { ChatSession } from '../types';
import { IconComponents } from './IconComponents';

interface SidebarProps {
  chats: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onUpdateTitle: (id: string, newTitle: string) => void;
}

const ChatListItem: React.FC<{
  chat: ChatSession;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdateTitle: (newTitle: string) => void;
}> = ({ chat, isActive, onSelect, onDelete, onUpdateTitle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (title.trim()) {
      onUpdateTitle(title.trim());
    } else {
      setTitle(chat.title); // revert if empty
    }
    setIsEditing(false);
  };
  
  React.useEffect(() => {
    if (isEditing) {
        inputRef.current?.focus();
    }
  }, [isEditing]);

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center justify-between p-2 my-1 rounded-md cursor-pointer transition-colors duration-200 ${
        isActive ? 'bg-gray-700' : 'hover:bg-gray-800'
      }`}
    >
        {isEditing ? (
            <input
                ref={inputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-transparent text-sm text-gray-200 outline-none"
            />
        ) : (
            <span className="text-sm truncate flex-1">{chat.title}</span>
        )}
      
      {isActive && (
        <div className="flex items-center ml-2">
            {!isEditing && <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1 rounded hover:bg-gray-600"><IconComponents.Edit className="w-4 h-4" /></button>}
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded hover:bg-gray-600"><IconComponents.Trash className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ chats, activeChatId, onNewChat, onSelectChat, onDeleteChat, onUpdateTitle }) => {
  return (
    <aside className="w-64 bg-gray-900 p-4 flex flex-col border-r border-gray-800">
      <div className="flex items-center mb-6">
        <IconComponents.Logo className="w-8 h-8 mr-2 text-yellow-300"/>
        <h1 className="text-xl font-bold text-gray-100">RV Designer</h1>
      </div>
      <button
        onClick={onNewChat}
        className="w-full flex items-center justify-center p-2 mb-4 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200 text-sm font-medium"
      >
        <IconComponents.Plus className="w-4 h-4 mr-2" />
        New Chat
      </button>
      <div className="flex-1 overflow-y-auto pr-1">
        {chats.map(chat => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === activeChatId}
            onSelect={() => onSelectChat(chat.id)}
            onDelete={() => onDeleteChat(chat.id)}
            onUpdateTitle={(newTitle) => onUpdateTitle(chat.id, newTitle)}
          />
        ))}
      </div>
    </aside>
  );
};
