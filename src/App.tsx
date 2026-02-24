import { useEffect, useState } from 'react';
import { Bot, MessageSquare, Image as ImageIcon, Settings, ExternalLink, AlertCircle, CheckCircle2, Shield } from 'lucide-react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface BotStatus {
  status: string;
  user: {
    username: string;
    tag: string;
    avatar: string;
  } | null;
  inviteLink: string | null;
  isAutoReplyEnabled: boolean;
  preferredChatModel: string;
  config: {
    discordToken: string;
    discordClientId: string;
    geminiApiKey: string;
    openaiApiKey: string;
    autoReplyChannel: string;
  };
  configMissing: boolean;
  geminiMissing: boolean;
  openaiMissing: boolean;
  logs: { timestamp: string; level: string; message: string }[];
}

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingModel, setUpdatingModel] = useState(false);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const testAI = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/test-ai");
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? data.response : data.error
      });
    } catch (e) {
      setTestResult({ success: false, message: "Failed to reach server" });
    } finally {
      setTesting(false);
    }
  };

  const updatePreferredModel = async (model: string) => {
    setUpdatingModel(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredChatModel: model })
      });
      const data = await res.json();
      if (data.success) {
        setStatus(prev => prev ? { ...prev, preferredChatModel: data.preferredChatModel } : null);
      }
    } catch (e) {
      console.error("Failed to update model", e);
    } finally {
      setUpdatingModel(false);
    }
  };

  const handleResetKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // After selecting, we might want to refresh the status
      window.location.reload();
    } else {
      alert("API Key selection is only available in the AI Studio environment.");
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error('Failed to fetch status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const appUrl = window.location.origin;

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                <Bot className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-white">Gemini Discord Bot</h1>
            </motion.div>
            <p className="text-slate-400 max-w-xl">
              A multimodal Discord bot powered by Google's Gemini AI. Chat, ask questions, and generate stunning images directly in your server.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "flex items-center gap-4 px-6 py-4 rounded-2xl border backdrop-blur-md",
              status?.status === 'Online' 
                ? "bg-emerald-500/5 border-emerald-500/20" 
                : "bg-amber-500/5 border-amber-500/20"
            )}
          >
            {status?.user?.avatar ? (
              <img src={status.user.avatar} alt="Bot Avatar" className="w-12 h-12 rounded-full border-2 border-indigo-500/50" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <Bot className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {status?.user?.username || 'Bot Offline'}
                </span>
                <div className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  status?.status === 'Online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                )} />
              </div>
              <p className="text-xs text-slate-400 font-mono">{status?.status || 'Connecting...'}</p>
            </div>
          </motion.div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Features */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                    <MessageSquare className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Intelligent Chat</h3>
                  <p className="text-sm text-slate-400">Use <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">/chat</code> with <strong>Google Search grounding</strong> for real-time, comprehensive answers.</p>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                    <ImageIcon className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Gemini Imagination</h3>
                  <p className="text-sm text-slate-400">Use <code className="text-purple-300 bg-purple-500/10 px-1 rounded">/imagine</code> to create high-quality images with custom aspect ratios.</p>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-orange-500/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4 group-hover:bg-orange-500/20 transition-colors">
                    <ImageIcon className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">DALL-E 3</h3>
                  <p className="text-sm text-slate-400">Use <code className="text-orange-300 bg-orange-500/10 px-1 rounded">/dalle</code> to generate photorealistic images using OpenAI's latest model.</p>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-emerald-500/30 transition-colors group">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">ChatGPT (GPT-4o)</h3>
                  <p className="text-sm text-slate-400">Use <code className="text-emerald-300 bg-emerald-500/10 px-1 rounded">/chatgpt</code> to interact with OpenAI's latest model.</p>
                </div>
            </section>

            {/* Invite Section */}
            <section className="p-8 rounded-3xl bg-indigo-600/10 border border-indigo-500/20">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                  <h2 className="text-2xl font-bold text-white">Invite Bot to Server</h2>
                  <p className="text-slate-400 max-w-md">Use this link to add the bot to your Discord server with the permissions you selected (137442470400).</p>
                </div>
                <a
                  href={status?.inviteLink || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/20 ${!status?.inviteLink && 'opacity-50 pointer-events-none'}`}
                >
                  <ExternalLink className="w-5 h-5" />
                  Add to Discord
                </a>
              </div>
            </section>

            {/* Configuration Check Section */}
            <section className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Settings className="w-6 h-6 text-indigo-400" />
                  <h2 className="text-2xl font-bold text-white">Bot Settings</h2>
                </div>
              </div>

              <div className="space-y-8">
                {/* Model Selection */}
                <div className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Preferred Chat Model (/chat)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => updatePreferredModel("gemini")}
                      disabled={updatingModel}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                        status?.preferredChatModel === "gemini"
                          ? "bg-indigo-500/10 border-indigo-500/50 text-white"
                          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      <div>
                        <p className="font-bold">Google Gemini</p>
                        <p className="text-xs opacity-70">Fast, multimodal, long context</p>
                      </div>
                      {status?.preferredChatModel === "gemini" && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                    </button>

                    <button
                      onClick={() => updatePreferredModel("chatgpt")}
                      disabled={updatingModel}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                        status?.preferredChatModel === "chatgpt"
                          ? "bg-emerald-500/10 border-emerald-500/50 text-white"
                          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
                      )}
                    >
                      <div>
                        <p className="font-bold">OpenAI ChatGPT</p>
                        <p className="text-xs opacity-70">GPT-4o, high reasoning</p>
                      </div>
                      {status?.preferredChatModel === "chatgpt" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Configuration Check</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">Discord Token</p>
                      <p className="font-mono text-sm text-slate-300">{status?.config.discordToken}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">Discord Client ID</p>
                      <p className="font-mono text-sm text-slate-300">{status?.config.discordClientId}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">Gemini API Key</p>
                      <p className="font-mono text-sm text-slate-300">{status?.config.geminiApiKey}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">OpenAI API Key</p>
                      <p className="font-mono text-sm text-slate-300">{status?.config.openaiApiKey}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">Auto-Reply Channel</p>
                      <p className="font-mono text-sm text-slate-300">{status?.config.autoReplyChannel}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 md:col-span-2">
                      <p className="text-xs font-medium text-slate-500 uppercase mb-2">Custom Gemini Key (Optional)</p>
                      <p className="font-mono text-sm text-slate-300">USER_PROVIDED_GEMINI_API_KEY</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={testAI}
                  disabled={testing}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-all"
                >
                  {testing ? "Testing..." : "Test AI Connection"}
                </button>
                
                <button
                  onClick={handleResetKey}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Change API Key
                </button>
              </div>
              
              {testResult && (
                  <div className={`p-4 rounded-2xl border ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-red-500/10 border-red-500/20 text-red-200'}`}>
                    <p className="text-xs font-bold uppercase mb-1">{testResult.success ? "Success" : "Error"}</p>
                    <p className="text-sm font-mono break-words">{testResult.message}</p>
                  </div>
                )}
              
              <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-200">Important: Message Content Intent</p>
                    <p className="text-xs text-amber-200/70">Ensure "Message Content Intent" is enabled in your Discord Developer Portal under the "Bot" tab. Without this, the bot cannot read your messages.</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 rounded-2xl bg-red-500/5 border border-red-500/20">
                <h3 className="text-lg font-bold text-red-200 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  API Key Troubleshooting
                </h3>
                <ul className="space-y-3 text-sm text-slate-400">
                  <li className="flex gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>If you see <strong>"API key not valid"</strong>, ensure you haven't manually set a broken key in the environment variables.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>The platform usually provides a free key automatically. If you are using a paid project, make sure billing is enabled.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-red-400 font-bold">•</span>
                    <span>Try clicking the <strong>"Test AI Connection"</strong> button above to see the raw error from Google.</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Developer Info Section */}
            <section className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Settings className="w-6 h-6 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Developer Info</h2>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Current Environment (Node.js)</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      This bot is built using <span className="text-indigo-400 font-mono">discord.js</span> and <span className="text-indigo-400 font-mono">TypeScript</span>. 
                      It runs on a Node.js server.
                    </p>
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                      <code className="text-xs text-emerald-400">npm install discord.js</code>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Python Equivalent</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      If you were building this in Python, you would use the <span className="text-amber-400 font-mono">discord.py</span> library.
                    </p>
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                      <code className="text-xs text-amber-400">pip install discord.py</code>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-200">
                    <strong>Note:</strong> Since this project is already set up with Node.js, we are using the JavaScript version. 
                    The commands and logic are very similar to the Python version!
                  </p>
                </div>
              </div>
            </section>

            {/* Logs Section */}
            <section className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-indigo-400" />
                  <h2 className="text-2xl font-bold text-white">Activity Logs</h2>
                </div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Real-time</span>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {status?.logs && status.logs.length > 0 ? (
                  status.logs.map((log, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 font-mono text-xs">
                      <span className="text-slate-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                      </span>
                      <span className={cn(
                        "font-bold shrink-0",
                        log.level === 'ERROR' ? "text-red-400" : 
                        log.level === 'WARN' ? "text-amber-400" : "text-indigo-400"
                      )}>
                        [{log.level}]
                      </span>
                      <span className="text-slate-300 break-all">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500 italic text-sm">
                    No activity logs yet. Interactions will appear here.
                  </div>
                )}
              </div>
            </section>

            {/* Setup Instructions */}
            <section className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <Settings className="w-6 h-6 text-indigo-400" />
                <h2 className="text-2xl font-bold text-white">Setup Instructions</h2>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-indigo-400 border border-slate-700">1</div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">Create a Discord Application</h4>
                    <p className="text-sm text-slate-400">Go to the <a href="https://discord.com/developers/applications" target="_blank" className="text-indigo-400 hover:underline inline-flex items-center gap-1">Discord Developer Portal <ExternalLink className="w-3 h-3" /></a> and create a new application.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-indigo-400 border border-slate-700">2</div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">Configure Bot Token</h4>
                    <p className="text-sm text-slate-400">Navigate to the "Bot" tab, reset the token, and copy it. Add it as <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">DISCORD_TOKEN</code> in your environment variables.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-indigo-400 border border-slate-700">3</div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">Set Client ID</h4>
                    <p className="text-sm text-slate-400">Copy the "Application ID" from the "General Information" tab and add it as <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">DISCORD_CLIENT_ID</code>.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-indigo-400 border border-slate-700">5</div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-white">Optional: Auto-Reply Channel</h4>
                    <p className="text-sm text-slate-400">To make the bot reply to <em>every</em> message in a specific channel, copy that channel's ID and add it as <code className="text-indigo-300 bg-indigo-500/10 px-1 rounded">DISCORD_AUTO_REPLY_CHANNEL_ID</code>. (Enable Developer Mode in Discord settings to copy IDs).</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar / Status */}
          <aside className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                System Status
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <span className="text-sm text-slate-400">Gemini API</span>
                  <div className="flex items-center gap-2">
                    {status?.geminiMissing ? (
                      <>
                        <span className="text-xs font-medium text-red-400">Missing Key</span>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-emerald-400">Active</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <span className="text-sm text-slate-400">OpenAI API</span>
                  <div className="flex items-center gap-2">
                    {status?.openaiMissing ? (
                      <>
                        <span className="text-xs font-medium text-red-400">Missing Key</span>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-emerald-400">Active</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <span className="text-sm text-slate-400">Discord Connection</span>
                  <div className="flex items-center gap-2">
                    {status?.configMissing ? (
                      <>
                        <span className="text-xs font-medium text-amber-400">Pending Config</span>
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      </>
                    ) : status?.status === 'Online' ? (
                      <>
                        <span className="text-xs font-medium text-emerald-400">Connected</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-slate-500">Disconnected</span>
                        <div className="w-2 h-2 rounded-full bg-slate-600" />
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 border border-slate-700">
                  <span className="text-sm text-slate-400">Auto-Reply</span>
                  <div className="flex items-center gap-2">
                    {status?.isAutoReplyEnabled ? (
                      <>
                        <span className="text-xs font-medium text-emerald-400">Enabled</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-slate-500">Disabled</span>
                        <div className="w-2 h-2 rounded-full bg-slate-600" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {status?.configMissing && (
                <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    <AlertCircle className="w-4 h-4 inline mr-1 mb-1" />
                    Missing <code className="bg-amber-500/20 px-1 rounded">DISCORD_TOKEN</code> or <code className="bg-amber-500/20 px-1 rounded">DISCORD_CLIENT_ID</code>. Please check your environment variables.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 rounded-2xl bg-indigo-600/10 border border-indigo-500/20">
              <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-3">Quick Tip</h4>
              <p className="text-xs text-indigo-200/70 leading-relaxed">
                Slash commands are registered globally. It might take a few minutes for them to appear in your Discord client after the bot starts.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-5xl mx-auto px-6 py-12 border-t border-slate-800 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-slate-500">
            <Bot className="w-4 h-4" />
            <span className="text-sm">Gemini Discord Bot Dashboard</span>
          </div>
          <p className="text-xs text-slate-600">
            Powered by Google Gemini AI & Discord.js
          </p>
        </div>
      </footer>
    </div>
  );
}
