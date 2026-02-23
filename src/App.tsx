/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  MessageSquare, 
  User, 
  Bot, 
  Menu, 
  X, 
  Settings, 
  LogOut,
  ChevronRight,
  Trash2,
  MoreVertical,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  Globe,
  Brain,
  Save,
  PlusCircle,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileCode,
  Loader2,
  Eraser,
  Search,
  Sliders,
  Monitor,
  Database,
  Download,
  Upload,
  Sun,
  Moon,
  Cpu
} from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { gemini, Message, getRelevantMemories, GenerationConfig } from './services/geminiService';
import { format } from 'date-fns';
import { parseFile, FileData } from './utils/fileParser';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date;
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('gemini_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          updatedAt: new Date(s.updatedAt),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }));
      } catch (e) {
        console.error("Failed to parse saved sessions", e);
      }
    }
    return [
      {
        id: '1',
        title: 'New Chat',
        messages: [],
        updatedAt: new Date(),
      }
    ];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('gemini_current_session_id');
    return saved || '1';
  });
  const [memories, setMemories] = useState<string[]>(() => {
    const saved = localStorage.getItem('gemini_memories');
    return saved ? JSON.parse(saved) : [];
  });
  const [newMemory, setNewMemory] = useState('');
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState(() => {
    const saved = localStorage.getItem('gemini_custom_instructions');
    return saved ? JSON.parse(saved) : { userContext: '', responseStyle: '' };
  });
  const [appSettings, setAppSettings] = useState(() => {
    const saved = localStorage.getItem('gemini_app_settings');
    return saved ? JSON.parse(saved) : {
      model: 'gemini-3-flash-preview',
      temperature: 1,
      topP: 0.95,
      topK: 40,
      searchGrounding: true,
      theme: 'light',
      userName: 'John Doe',
      userAvatar: 'JD'
    };
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'model' | 'profile' | 'data'>('general');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  useEffect(() => {
    localStorage.setItem('gemini_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('gemini_current_session_id', currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    localStorage.setItem('gemini_memories', JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    localStorage.setItem('gemini_custom_instructions', JSON.stringify(customInstructions));
  }, [customInstructions]);

  useEffect(() => {
    localStorage.setItem('gemini_app_settings', JSON.stringify(appSettings));
    if (appSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appSettings]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession.messages]);

  const handleNewChat = () => {
    const newId = Math.random().toString(36).substring(7);
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [],
      updatedAt: new Date(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newId);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    if (newSessions.length === 0) {
      handleNewChat();
    } else {
      setSessions(newSessions);
      if (currentSessionId === id) {
        setCurrentSessionId(newSessions[0].id);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    setIsParsingFile(true);
    try {
      const newFiles: FileData[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const parsed = await parseFile(files[i]);
          newFiles.push(parsed);
        } catch (err) {
          console.error(`Failed to parse ${files[i].name}:`, err);
          alert(`Could not read "${files[i].name}". It might be corrupted or an unsupported version.`);
        }
      }
      setAttachedFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error("Error in file selection:", error);
    } finally {
      setIsParsingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e?: React.FormEvent, retryMessage?: string, retryFiles?: FileData[]) => {
    if (e) e.preventDefault();
    
    const messageContent = retryMessage || input;
    const currentFiles = retryFiles || attachedFiles;
    
    if ((!messageContent.trim() && currentFiles.length === 0) || isLoading) return;

    // Construct full message with file context if any
    let fullPrompt = messageContent;
    if (currentFiles.length > 0) {
      const fileContext = currentFiles.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n');
      fullPrompt = `I have attached the following files for context:\n\n${fileContext}\n\nUser Question: ${messageContent}`;
    }
    
    let updatedMessages = currentSession.messages;
    
    if (!retryMessage) {
      const userMessage: Message = {
        role: 'user',
        content: messageContent,
        timestamp: new Date(),
        files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
      };
      updatedMessages = [...currentSession.messages, userMessage];
      
      // Update title if it's the first message
      let newTitle = currentSession.title;
      if (currentSession.messages.length === 0) {
        newTitle = messageContent.length > 30 ? messageContent.substring(0, 30) + '...' : (messageContent || attachedFiles[0]?.name || 'New Chat');
      }

      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: updatedMessages, title: newTitle, updatedAt: new Date() } 
          : s
      ));
      setInput('');
      setAttachedFiles([]);
    } else {
      // If retry, remove the last error message if it exists
      updatedMessages = currentSession.messages.filter(m => !m.isError);
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: updatedMessages } 
          : s
      ));
    }
    
    setIsLoading(true);
    setStreamingContent('');

    // Prioritize memories based on relevance to the current message
    const relevantMemories = getRelevantMemories(messageContent, memories);

    const systemInstruction = `You are a helpful assistant. Use Google Search to provide up-to-date information when relevant. Your responses should be formatted in Markdown. Be concise and direct.
         
         ${customInstructions.userContext ? `USER CONTEXT:\n${customInstructions.userContext}\n` : ''}
         ${customInstructions.responseStyle ? `RESPONSE STYLE GUIDELINES:\n${customInstructions.responseStyle}\n` : ''}
         ${relevantMemories.length > 0 ? `RELEVANT USER FACTS (MEMORIES):\n${relevantMemories.map((m, i) => `${i + 1}. ${m}`).join('\n')}` : ''}`;

    try {
      const stream = await gemini.sendMessageStream(
        fullPrompt, 
        updatedMessages, 
        systemInstruction,
        {
          model: appSettings.model,
          temperature: appSettings.temperature,
          topP: appSettings.topP,
          topK: appSettings.topK,
          searchGrounding: appSettings.searchGrounding
        }
      );
      
      let assistantContent = '';
      let sources: { title: string; uri: string }[] = [];

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          assistantContent += text;
          setStreamingContent(assistantContent);
        }

        // Extract grounding metadata if available
        const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach(c => {
            if (c.web && c.web.uri && c.web.title) {
              if (!sources.find(s => s.uri === c.web!.uri)) {
                sources.push({ title: c.web.title, uri: c.web.uri });
              }
            }
          });
        }
      }

      const assistantMessage: Message = {
        role: 'model',
        content: assistantContent,
        timestamp: new Date(),
        sources: sources.length > 0 ? sources : undefined
      };

      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: [...s.messages.filter(m => !m.isError), assistantMessage] } 
          : s
      ));
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        role: 'model',
        content: "I'm sorry, I encountered an error while processing your request. This could be due to a temporary connection issue or rate limiting.",
        timestamp: new Date(),
        isError: true
      };
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages: [...s.messages.filter(m => !m.isError), errorMessage] } 
          : s
      ));
    } finally {
      setIsLoading(false);
      setStreamingContent(null);
    }
  };

  const handleFeedback = (messageIndex: number, feedback: 'positive' | 'negative') => {
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId 
        ? { 
            ...s, 
            messages: s.messages.map((m, idx) => 
              idx === messageIndex ? { ...m, feedback: m.feedback === feedback ? undefined : feedback } : m
            ) 
          } 
        : s
    ));
  };

  const clearChat = () => {
    setSessions(prev => prev.map(s => 
      s.id === currentSessionId 
        ? { ...s, messages: [], updatedAt: new Date() } 
        : s
    ));
    setIsClearConfirmOpen(false);
  };

  const exportData = () => {
    const data = {
      sessions,
      memories,
      customInstructions,
      appSettings,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-assistant-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.sessions) setSessions(data.sessions);
        if (data.memories) setMemories(data.memories);
        if (data.customInstructions) setCustomInstructions(data.customInstructions);
        if (data.appSettings) setAppSettings(data.appSettings);
        alert('Data imported successfully!');
      } catch (err) {
        alert('Failed to import data. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  const filteredSessions = sessions.filter(session => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = session.title.toLowerCase().includes(query);
    const messageMatch = session.messages.some(m => m.content.toLowerCase().includes(query));
    return titleMatch || messageMatch;
  });

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans overflow-hidden">
      {/* Mobile Menu Overlay */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm md:hidden"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-[#f9f9f9] border-r border-gray-200 transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={handleNewChat}
              className="flex items-center gap-2 w-full p-3 text-sm font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Plus size={18} />
              New Chat
            </button>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 ml-2 text-gray-500 hover:bg-gray-200 rounded-lg md:hidden"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
              {searchQuery ? 'Search Results' : 'Recent Chats'}
            </div>
            {filteredSessions.length === 0 ? (
              <div className="text-center py-8 px-4">
                <div className="text-gray-400 mb-2">
                  <Search size={24} className="mx-auto opacity-20" />
                </div>
                <p className="text-xs text-gray-500">No chats found matching "{searchQuery}"</p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    setCurrentSessionId(session.id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "group flex items-center gap-3 w-full p-3 text-sm rounded-xl transition-all relative overflow-hidden",
                    currentSessionId === session.id 
                      ? "bg-white shadow-sm border border-gray-200 text-gray-900" 
                      : "text-gray-600 hover:bg-gray-200/50"
                  )}
                >
                  <MessageSquare size={16} className={cn(
                    currentSessionId === session.id ? "text-emerald-600" : "text-gray-400"
                  )} />
                  <span className="truncate flex-1 text-left">{session.title}</span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Trash2 
                      size={14} 
                      className="text-gray-400 hover:text-red-500" 
                      onClick={(e) => deleteSession(e, session.id)}
                    />
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-gray-200 space-y-1">
            {/* Memory Section */}
            <div className="px-2 mb-2">
              <button 
                onClick={() => setIsMemoryOpen(!isMemoryOpen)}
                className={cn(
                  "flex items-center justify-between w-full p-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors",
                  isMemoryOpen && "text-emerald-600"
                )}
              >
                <div className="flex items-center gap-2">
                  <Brain size={14} />
                  AI Memory
                </div>
                <ChevronRight size={14} className={cn("transition-transform", isMemoryOpen && "rotate-90")} />
              </button>
              
              {isMemoryOpen && (
                <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex gap-1">
                    <input 
                      type="text"
                      value={newMemory}
                      onChange={(e) => setNewMemory(e.target.value)}
                      placeholder="Add a fact..."
                      className="flex-1 text-xs p-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newMemory.trim()) {
                          setMemories([...memories, newMemory.trim()]);
                          setNewMemory('');
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        if (newMemory.trim()) {
                          setMemories([...memories, newMemory.trim()]);
                          setNewMemory('');
                        }
                      }}
                      className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <PlusCircle size={14} />
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                    {memories.length === 0 ? (
                      <div className="text-[10px] text-gray-400 italic p-2 text-center">
                        No memories saved yet.
                      </div>
                    ) : (
                      memories.map((m, i) => (
                        <div key={i} className="group flex items-center justify-between p-2 bg-white border border-gray-100 rounded-lg text-[11px] text-gray-600">
                          <span className="truncate flex-1">{m}</span>
                          <button 
                            onClick={() => setMemories(memories.filter((_, idx) => idx !== i))}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-3 w-full p-3 text-sm text-gray-600 hover:bg-gray-200/50 rounded-xl transition-colors"
            >
              <Settings size={18} />
              Settings
            </button>
            <div className="flex items-center gap-3 w-full p-3 text-sm text-gray-900">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                {appSettings.userAvatar}
              </div>
              <div className="flex-1 truncate">
                <div className="font-medium truncate">{appSettings.userName}</div>
                <div className="text-xs text-gray-500 truncate">Free Plan</div>
              </div>
              <LogOut size={16} className="text-gray-400" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col relative h-full overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = e.dataTransfer.files;
          if (files && files.length > 0) {
            setIsParsingFile(true);
            try {
              const newFiles: FileData[] = [];
              for (let i = 0; i < files.length; i++) {
                const parsed = await parseFile(files[i]);
                newFiles.push(parsed);
              }
              setAttachedFiles(prev => [...prev, ...newFiles]);
            } catch (error) {
              console.error("Error parsing files:", error);
              alert("Failed to parse some files.");
            } finally {
              setIsParsingFile(false);
            }
          }
        }}
      >
        {/* Header */}
        <header className="h-14 border-b border-gray-100 flex items-center justify-between px-4 md:px-8 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={cn(
                "p-2 hover:bg-gray-100 rounded-lg transition-colors hidden md:block",
                isSidebarOpen && "hidden"
              )}
            >
              <Menu size={20} />
            </button>
            <h2 className="font-semibold text-gray-800 truncate max-w-[200px] md:max-w-md">
              {currentSession.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-100">
              <Bot size={14} />
              {appSettings.model.includes('pro') ? 'Gemini 3 Pro' : 'Gemini 3 Flash'}
            </div>
            {appSettings.searchGrounding && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                <Globe size={14} />
                Google Search
              </div>
            )}
            <button
              onClick={() => setIsClearConfirmOpen(true)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all ml-2"
              title="Clear Chat"
            >
              <Eraser size={18} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-0 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-8">
            {currentSession.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                  <Bot size={32} />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">How can I help you today?</h1>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Ask me anything, from writing code to summarizing articles or just having a chat.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                  {[
                    "Write a Python script for web scraping",
                    "Explain quantum computing simply",
                    "Plan a 3-day trip to Tokyo",
                    "Help me write a professional email"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="p-4 text-left text-sm border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all hover:border-emerald-200 group"
                    >
                      <div className="font-medium text-gray-800 group-hover:text-emerald-700">{suggestion}</div>
                      <div className="text-xs text-gray-400 mt-1">Click to try this prompt</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              currentSession.messages.map((message, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "flex gap-4 md:gap-6 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm",
                    message.role === 'user' 
                      ? "bg-gray-900 text-white" 
                      : "bg-emerald-600 text-white"
                  )}>
                    {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className={cn(
                    "flex-1 max-w-[85%] md:max-w-[80%] space-y-2",
                    message.role === 'user' ? "text-right" : "text-left"
                  )}>
                    <div className={cn(
                      "inline-block px-4 py-3 rounded-2xl text-sm relative group/msg",
                      message.role === 'user' 
                        ? "bg-gray-100 text-gray-800 rounded-tr-none" 
                        : message.isError
                          ? "bg-red-50 border border-red-100 text-red-800 rounded-tl-none shadow-sm"
                          : "bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-sm"
                    )}>
                      {message.isError && (
                        <div className="flex items-center gap-2 mb-2 text-red-600 font-medium">
                          <AlertCircle size={16} />
                          <span>Response Error</span>
                        </div>
                      )}
                      <div className="markdown-body">
                        <Markdown>{message.content}</Markdown>
                      </div>

                      {message.files && message.files.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.files.map((file, idx) => (
                            <button
                              key={idx}
                              onClick={() => setPreviewFile(file)}
                              className="flex items-center gap-2 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-600 hover:border-emerald-300 transition-colors"
                            >
                              {file.name.endsWith('.pdf') ? <FileText size={12} className="text-red-500" /> : 
                               file.name.match(/\.(xlsx|xls|csv)$/) ? <FileSpreadsheet size={12} className="text-emerald-500" /> :
                               file.name.match(/\.(docx|doc)$/) ? <FileText size={12} className="text-blue-500" /> :
                               <FileCode size={12} className="text-gray-500" />}
                              <span className="truncate max-w-[100px]">{file.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                            <Globe size={12} />
                            Sources
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-[11px] text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-all"
                              >
                                <span className="truncate max-w-[150px]">{source.title}</span>
                                <ExternalLink size={10} className="flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {message.isError && (
                        <button
                          onClick={() => {
                            const lastUserMsg = [...currentSession.messages].reverse().find(m => m.role === 'user');
                            if (lastUserMsg) handleSubmit(undefined, lastUserMsg.content, lastUserMsg.files);
                          }}
                          className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors shadow-sm"
                        >
                          <RotateCcw size={14} />
                          Retry Generation
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <div className="text-[10px] text-gray-400">
                        {format(message.timestamp, 'h:mm a')}
                      </div>
                      {message.role === 'model' && !message.isError && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleFeedback(index, 'positive')}
                            className={cn(
                              "p-1 rounded hover:bg-gray-100 transition-colors",
                              message.feedback === 'positive' ? "text-emerald-600 bg-emerald-50" : "text-gray-400"
                            )}
                          >
                            <ThumbsUp size={12} />
                          </button>
                          <button 
                            onClick={() => handleFeedback(index, 'negative')}
                            className={cn(
                              "p-1 rounded hover:bg-gray-100 transition-colors",
                              message.feedback === 'negative' ? "text-red-600 bg-red-50" : "text-gray-400"
                            )}
                          >
                            <ThumbsDown size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && streamingContent !== null && streamingContent !== '' && (
              <div className="flex gap-4 md:gap-6 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex-shrink-0 flex items-center justify-center shadow-sm">
                  <Bot size={18} />
                </div>
                <div className="flex-1 max-w-[85%] md:max-w-[80%] space-y-2">
                  <div className="inline-block px-4 py-3 rounded-2xl text-sm bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-sm">
                    <div className="markdown-body">
                      <Markdown>{streamingContent}</Markdown>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isLoading && (streamingContent === '' || streamingContent === null) && (
              <div className="flex gap-4 md:gap-6 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex-shrink-0 flex items-center justify-center text-emerald-300">
                  <Bot size={18} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-8 bg-gradient-to-t from-white via-white to-transparent">
          <form 
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto relative group"
          >
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 animate-in slide-in-from-bottom-2 duration-200">
                {attachedFiles.map((file, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 group/file relative hover:border-emerald-300 transition-colors cursor-pointer"
                    onClick={() => setPreviewFile(file)}
                  >
                    {file.name.endsWith('.pdf') ? <FileText size={14} className="text-red-500" /> : 
                     file.name.match(/\.(xlsx|xls|csv)$/) ? <FileSpreadsheet size={14} className="text-emerald-500" /> :
                     file.name.match(/\.(docx|doc)$/) ? <FileText size={14} className="text-blue-500" /> :
                     <FileCode size={14} className="text-gray-500" />}
                    <span className="truncate max-w-[120px] font-medium">{file.name}</span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="p-1 hover:bg-gray-200 rounded-full transition-colors ml-1 text-gray-400 hover:text-gray-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative flex items-end bg-white border border-gray-200 rounded-2xl shadow-lg focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all p-2">
              <input 
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                onChange={handleFileChange}
                accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.md,.json,.js,.ts,.py,.html,.css"
              />
              <label 
                htmlFor="file-upload"
                className={cn(
                  "p-2.5 rounded-xl transition-all mb-1 ml-1 cursor-pointer hover:bg-gray-100 text-gray-500",
                  isParsingFile && "animate-pulse pointer-events-none"
                )}
              >
                {isParsingFile ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Message Gemini..."
                className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-sm max-h-40 min-h-[44px] custom-scrollbar"
                rows={1}
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
              <button
                type="submit"
                disabled={(!input.trim() && attachedFiles.length === 0) || isLoading || isParsingFile}
                className={cn(
                  "p-2.5 rounded-xl transition-all mb-1 mr-1",
                  (input.trim() || attachedFiles.length > 0) && !isLoading && !isParsingFile
                    ? "bg-emerald-600 text-white shadow-md hover:bg-emerald-700" 
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                )}
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-3">
              Gemini can make mistakes. Check important info.
            </p>
          </form>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d1d5db;
        }
      `}</style>
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-3xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                  <Settings size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Settings</h3>
                  <p className="text-xs text-gray-500">Manage your preferences and AI configuration</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* Tabs Sidebar */}
              <div className="w-48 border-r border-gray-100 bg-gray-50/50 p-4 flex flex-col gap-1">
                <button 
                  onClick={() => setSettingsTab('general')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    settingsTab === 'general' ? "bg-white shadow-sm text-emerald-600" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <Monitor size={16} />
                  General
                </button>
                <button 
                  onClick={() => setSettingsTab('model')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    settingsTab === 'model' ? "bg-white shadow-sm text-emerald-600" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <Sliders size={16} />
                  AI Model
                </button>
                <button 
                  onClick={() => setSettingsTab('profile')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    settingsTab === 'profile' ? "bg-white shadow-sm text-emerald-600" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <User size={16} />
                  Profile
                </button>
                <button 
                  onClick={() => setSettingsTab('data')}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    settingsTab === 'data' ? "bg-white shadow-sm text-emerald-600" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <Database size={16} />
                  Data
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {settingsTab === 'general' && (
                  <div className="space-y-8">
                    <section className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Monitor size={16} className="text-emerald-600" />
                        Appearance
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setAppSettings({...appSettings, theme: 'light'})}
                          className={cn(
                            "p-4 border rounded-2xl flex flex-col items-center gap-3 transition-all",
                            appSettings.theme === 'light' ? "border-emerald-500 bg-emerald-50/50" : "border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <Sun size={24} className={appSettings.theme === 'light' ? "text-emerald-600" : "text-gray-400"} />
                          <span className="text-sm font-medium">Light Mode</span>
                        </button>
                        <button 
                          onClick={() => setAppSettings({...appSettings, theme: 'dark'})}
                          className={cn(
                            "p-4 border rounded-2xl flex flex-col items-center gap-3 transition-all",
                            appSettings.theme === 'dark' ? "border-emerald-500 bg-emerald-50/50" : "border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <Moon size={24} className={appSettings.theme === 'dark' ? "text-emerald-600" : "text-gray-400"} />
                          <span className="text-sm font-medium">Dark Mode</span>
                        </button>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Brain size={16} className="text-emerald-600" />
                        Custom Instructions
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            What should Gemini know about you?
                          </label>
                          <textarea 
                            value={customInstructions.userContext}
                            onChange={(e) => setCustomInstructions({...customInstructions, userContext: e.target.value})}
                            placeholder="e.g. I am a software engineer who prefers concise explanations..."
                            className="w-full h-24 p-4 text-sm bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            How should Gemini respond?
                          </label>
                          <textarea 
                            value={customInstructions.responseStyle}
                            onChange={(e) => setCustomInstructions({...customInstructions, responseStyle: e.target.value})}
                            placeholder="e.g. Use a professional tone, avoid jargon, and always provide code examples..."
                            className="w-full h-24 p-4 text-sm bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none transition-all"
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {settingsTab === 'model' && (
                  <div className="space-y-8">
                    <section className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Cpu size={16} className="text-emerald-600" />
                        Model Selection
                      </h4>
                      <div className="space-y-3">
                        {[
                          { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Fast and efficient for everyday tasks' },
                          { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Advanced reasoning for complex problems' }
                        ].map((model) => (
                          <button 
                            key={model.id}
                            onClick={() => setAppSettings({...appSettings, model: model.id})}
                            className={cn(
                              "w-full p-4 border rounded-2xl text-left transition-all flex items-center justify-between",
                              appSettings.model === model.id ? "border-emerald-500 bg-emerald-50/50" : "border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            <div>
                              <div className="text-sm font-bold text-gray-900">{model.name}</div>
                              <div className="text-xs text-gray-500">{model.desc}</div>
                            </div>
                            {appSettings.model === model.id && (
                              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                                <ChevronRight size={14} />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="space-y-6">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Sliders size={16} className="text-emerald-600" />
                        Generation Parameters
                      </h4>
                      
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-700">Temperature: {appSettings.temperature}</label>
                            <span className="text-[10px] text-gray-400">Creative vs Precise</span>
                          </div>
                          <input 
                            type="range" min="0" max="2" step="0.1"
                            value={appSettings.temperature}
                            onChange={(e) => setAppSettings({...appSettings, temperature: parseFloat(e.target.value)})}
                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div>
                            <div className="text-sm font-bold text-gray-900">Google Search Grounding</div>
                            <div className="text-xs text-gray-500">Enable real-time web information</div>
                          </div>
                          <button 
                            onClick={() => setAppSettings({...appSettings, searchGrounding: !appSettings.searchGrounding})}
                            className={cn(
                              "w-12 h-6 rounded-full transition-colors relative",
                              appSettings.searchGrounding ? "bg-emerald-600" : "bg-gray-300"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              appSettings.searchGrounding ? "left-7" : "left-1"
                            )} />
                          </button>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {settingsTab === 'profile' && (
                  <div className="space-y-8">
                    <section className="space-y-6">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-24 h-24 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-700 text-3xl font-bold shadow-sm border-4 border-white ring-1 ring-emerald-100">
                          {appSettings.userAvatar}
                        </div>
                        <div className="text-center">
                          <h4 className="text-lg font-bold text-gray-900">{appSettings.userName}</h4>
                          <p className="text-sm text-gray-500">Personalize your profile</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-700">Display Name</label>
                          <input 
                            type="text"
                            value={appSettings.userName}
                            onChange={(e) => setAppSettings({...appSettings, userName: e.target.value})}
                            className="w-full p-4 text-sm bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-700">Avatar Initials</label>
                          <input 
                            type="text"
                            maxLength={2}
                            value={appSettings.userAvatar}
                            onChange={(e) => setAppSettings({...appSettings, userAvatar: e.target.value.toUpperCase()})}
                            className="w-20 p-4 text-sm bg-gray-50 border border-gray-200 rounded-2xl text-center focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {settingsTab === 'data' && (
                  <div className="space-y-8">
                    <section className="space-y-4">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Database size={16} className="text-emerald-600" />
                        Data Management
                      </h4>
                      <p className="text-xs text-gray-500">Your data is stored locally in your browser. You can export it to back it up or import it on another device.</p>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <button 
                          onClick={exportData}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                              <Download size={18} />
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-gray-900">Export All Data</div>
                              <div className="text-[10px] text-gray-500">Download sessions, memories, and settings</div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-gray-300" />
                        </button>

                        <label className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all group cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                              <Upload size={18} />
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-gray-900">Import Data</div>
                              <div className="text-[10px] text-gray-500">Restore from a previously exported file</div>
                            </div>
                          </div>
                          <input type="file" accept=".json" onChange={importData} className="hidden" />
                          <ChevronRight size={16} className="text-gray-300" />
                        </label>

                        <button 
                          onClick={() => {
                            if (confirm('Are you sure you want to delete ALL data? This includes all chats, memories, and settings.')) {
                              localStorage.clear();
                              window.location.reload();
                            }
                          }}
                          className="flex items-center justify-between p-4 bg-white border border-red-100 rounded-2xl hover:bg-red-50 transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 text-red-600 rounded-lg group-hover:bg-red-100 transition-colors">
                              <Trash2 size={18} />
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-bold text-red-600">Delete All Data</div>
                              <div className="text-[10px] text-red-400">Permanently wipe everything</div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-red-200" />
                        </button>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 bg-emerald-600 flex justify-between items-center text-white">
              <div className="text-xs opacity-80">Settings are saved automatically</div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-6 py-2 text-sm font-bold bg-white text-emerald-700 rounded-xl hover:bg-emerald-50 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-600">
                  {previewFile.name.endsWith('.pdf') ? <FileText size={24} className="text-red-500" /> : 
                   previewFile.name.match(/\.(xlsx|xls|csv)$/) ? <FileSpreadsheet size={24} className="text-emerald-500" /> :
                   previewFile.name.match(/\.(docx|doc)$/) ? <FileText size={24} className="text-blue-500" /> :
                   <FileCode size={24} className="text-gray-500" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 truncate max-w-md">{previewFile.name}</h3>
                  <p className="text-xs text-gray-500">{(previewFile.size / 1024).toFixed(1)} KB • Extracted Content</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewFile(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50 custom-scrollbar">
              <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-gray-100 min-h-full">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                  {previewFile.content || "No text content could be extracted from this file."}
                </pre>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setPreviewFile(null)}
                className="px-6 py-2 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-md"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-4">
                <Eraser size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Clear conversation?</h3>
              <p className="text-gray-500 text-sm">
                This will delete all messages in this chat. This action cannot be undone.
              </p>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button 
                onClick={() => setIsClearConfirmOpen(false)}
                className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={clearChat}
                className="flex-1 py-3 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-md"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
