import Link from 'next/link';
import { getServerSession } from 'next-auth';
import Image from 'next/image';
import { authOptions } from "@/lib/server/auth";
import {
  LockClosedIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  CloudArrowUpIcon,
  SparklesIcon,
  BoltIcon,
  KeyIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="fixed inset-0 grid-pattern pointer-events-none opacity-50" />

      {/* Background mesh gradient */}
      <div className="fixed inset-0 mesh-gradient pointer-events-none" />

      {/* ─── NAVIGATION ─── */}
      <nav className="sticky top-0 z-50 glass-effect">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-1 group">
            <Image src="/logo.png" alt="Logo" width={36} height={36} className="mt-1" />
            <span className="text-xl font-semibold text-white tracking-tight">SecurioX</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">How It Works</a>
            <a href="#security" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">Security</a>
          </div>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <Link href="/dashboard" className="cta-button !text-sm !px-5 !py-2.5 !rounded-xl">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors px-3 py-2">
                  Sign In
                </Link>
                <Link href="/signup" className="cta-button !text-sm !px-5 !py-2.5 !rounded-xl">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28">
        {/* Giant green glow behind hero */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-radial from-green-500/[0.12] via-green-500/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/20 bg-green-500/[0.06] text-sm text-green-400 mb-8">
              <SparklesIcon className="w-4 h-4" />
              AI-Powered Encrypted Cloud Vault
            </div>
          </div>

          <h1 className="text-7xl md:text-5xl lg:text-7xl font-bold text-white mb-8 leading-[0.95] tracking-tight animate-fade-in-up-delay-1">
            Your files.
            <br />
            <span className="gradient-text">Encrypted. Searchable.</span>
            <br />
            <span className="text-gray-400">Conversational.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delay-2">
            Securio encrypts your files client-side with AES-256 + RSA-2048,
            then lets you <span className="text-white font-medium">search by meaning</span> and{' '}
            <span className="text-white font-medium">chat with your documents</span> using AI.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up-delay-3">
            <Link href="/signup" className="cta-button flex items-center gap-2 text-base">
              Start Encrypting for Free
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
            <a href="#features" className="text-gray-400 hover:text-white text-sm font-medium transition-colors px-6 py-4 border border-white/[0.08] rounded-2xl hover:bg-white/[0.03]">
              See How It Works ↓
            </a>
          </div>
        </div>
      </section>

      {/* ─── PRODUCT SHOWCASE (BENTO GRID) ─── */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 animate-fade-in-up">
            <p className="text-sm text-green-400 font-semibold tracking-wider uppercase mb-3">What makes Securio different</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Not just storage. An <span className="gradient-text">intelligent vault.</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Traditional cloud storage just holds your files. Securio encrypts them, understands them, and lets you talk to them.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {/* Card 1: AI Search — LARGE */}
            <div className="bento-card lg:col-span-2 group">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center mb-5">
                    <MagnifyingGlassIcon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Semantic Search</h3>
                  <p className="text-gray-400 leading-relaxed mb-4">
                    Search your vault by <span className="text-white font-medium">meaning, not keywords</span>.
                    Upload a PDF and later find it by asking "that document about quarterly revenue"
                    — Securio uses <span className="text-blue-400 font-medium">Gemini AI embeddings + Pinecone</span> to
                    understand your content.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-blue-400/80">
                    <SparklesIcon className="w-4 h-4" />
                    Powered by Gemini + Pinecone vector search
                  </div>
                </div>
                {/* Mini search mockup */}
                <div className="w-full md:w-64 flex-shrink-0">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-gray-500">
                      <MagnifyingGlassIcon className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-400">"passport scan"</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/[0.05] border border-green-500/10 rounded-lg">
                        <span className="text-xs">📄</span>
                        <div>
                          <p className="text-xs text-white font-medium">passport_front.jpg</p>
                          <p className="text-[10px] text-green-400">92% match</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border border-white/[0.04] rounded-lg">
                        <span className="text-xs">📄</span>
                        <div>
                          <p className="text-xs text-gray-400">id_documents.pdf</p>
                          <p className="text-[10px] text-gray-600">67% match</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Upload & Encrypt */}
            <div className="bento-card group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20 flex items-center justify-center mb-5">
                <CloudArrowUpIcon className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Upload & Encrypt</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Drag & drop any file. It's encrypted in your browser with{' '}
                <span className="text-green-400 font-medium">AES-256-GCM</span> before it ever touches
                our servers. Upload PDFs, docs, images, and more.
              </p>
              <div className="mt-5 border-2 border-dashed border-white/[0.06] rounded-xl p-4 text-center group-hover:border-green-500/20 transition-colors">
                <CloudArrowUpIcon className="w-8 h-8 text-gray-700 mx-auto mb-1" />
                <p className="text-[11px] text-gray-600">PDF · TXT · DOC · JPG · PNG</p>
              </div>
            </div>

            {/* Card 3: AI Chat — LARGE */}
            <div className="bento-card lg:col-span-2 group">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center mb-5">
                    <ChatBubbleLeftRightIcon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Talk to Your Files</h3>
                  <p className="text-gray-400 leading-relaxed mb-4">
                    Ask questions in plain English and get intelligent responses drawn from
                    <span className="text-white font-medium"> your actual documents</span>.
                    Need to find a specific detail buried in a 50-page PDF? Just ask.
                    Powered by <span className="text-purple-400 font-medium">Pinecone context retrieval + Groq LLM</span>.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-purple-400/80">
                    <SparklesIcon className="w-4 h-4" />
                    RAG-powered with your own documents as context
                  </div>
                </div>
                {/* Mini chat mockup */}
                <div className="w-full md:w-72 flex-shrink-0">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                    {/* User */}
                    <div className="flex justify-end">
                      <div className="bg-white/[0.06] border border-white/[0.08] px-3 py-2 rounded-xl rounded-tr-sm max-w-[85%]">
                        <p className="text-xs text-white">What's my Aadhaar number?</p>
                      </div>
                    </div>
                    {/* Bot */}
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-md bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <SparklesIcon className="w-3 h-3 text-purple-400" />
                      </div>
                      <div className="bg-white/[0.03] border border-white/[0.05] px-3 py-2 rounded-xl rounded-tl-sm">
                        <div className="flex gap-1 mb-1">
                          <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/15">📄 aadhaar_card.pdf</span>
                        </div>
                        <p className="text-xs text-gray-300">Based on your uploaded Aadhaar card, your number is XXXX XXXX 4523.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Zero-Knowledge */}
            <div className="bento-card group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/20 flex items-center justify-center mb-5">
                <ShieldCheckIcon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Zero-Knowledge</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                We <span className="text-white font-medium underline">never</span> see your files, keys, or passphrase.
                Your RSA private key is encrypted client-side.
                Even if our servers are compromised, your data is safe.
              </p>
              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-gray-600">
                  <LockClosedIcon className="w-3 h-3 text-amber-500/60" />
                  <span>Private key encrypted with PBKDF2 + AES-GCM</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-600">
                  <LockClosedIcon className="w-3 h-3 text-amber-500/60" />
                  <span>All crypto runs in the browser (Web Crypto API)</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/[0.02] to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="text-center mb-16">
            <p className="text-sm text-green-400 font-semibold tracking-wider uppercase mb-3">Under the hood</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              How your data stays safe
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Every step is designed so we can never access your data — even if we wanted to.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                step: 1,
                icon: <CloudArrowUpIcon className="w-5 h-5" />,
                title: "Upload",
                desc: "You drop a file. AES-256 key is generated in your browser.",
                color: "text-green-400 bg-green-500/10 border-green-500/20"
              },
              {
                step: 2,
                icon: <LockClosedIcon className="w-5 h-5" />,
                title: "Encrypt",
                desc: "File encrypted with AES. AES key wrapped with your RSA public key.",
                color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
              },
              {
                step: 3,
                icon: <SparklesIcon className="w-5 h-5" />,
                title: "Index",
                desc: "Text extracted and embedded by Gemini AI. Vectors stored in Pinecone.",
                color: "text-purple-400 bg-purple-500/10 border-purple-500/20"
              },
              {
                step: 4,
                icon: <ChatBubbleLeftRightIcon className="w-5 h-5" />,
                title: "Search & Chat",
                desc: "Find files by meaning. Ask questions. Get answers from YOUR data.",
                color: "text-amber-400 bg-amber-500/10 border-amber-500/20"
              },
            ].map((item) => (
              <div key={item.step} className="relative group">
                <div className="feature-card text-center h-full">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mx-auto mb-4 ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Step {item.step}</div>
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECURITY / TRUST SECTION ─── */}
      <section id="security" className="py-24 relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm text-green-400 font-semibold tracking-wider uppercase mb-3">Military-Grade Cryptography</p>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
              Built on battle-tested standards
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: <KeyIcon className="w-5 h-5 text-green-400" />,
                title: "AES-256-GCM",
                desc: "Each file gets a unique symmetric key. The same encryption used by governments and military.",
                tag: "Symmetric",
                tagColor: "text-green-400 border-green-500/20 bg-green-500/[0.06]"
              },
              {
                icon: <LockClosedIcon className="w-5 h-5 text-blue-400" />,
                title: "RSA-2048 OAEP",
                desc: "Your AES keys are wrapped with your RSA public key. Private key never leaves your browser.",
                tag: "Asymmetric",
                tagColor: "text-blue-400 border-blue-500/20 bg-blue-500/[0.06]"
              },
              {
                icon: <ShieldCheckIcon className="w-5 h-5 text-purple-400" />,
                title: "PBKDF2 + AES-GCM",
                desc: "Your private key is encrypted with your passphrase → 100,000 PBKDF2 iterations → AES-GCM.",
                tag: "Key Protection",
                tagColor: "text-purple-400 border-purple-500/20 bg-purple-500/[0.06]"
              },
            ].map((item, i) => (
              <div key={i} className="feature-card">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                    {item.icon}
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${item.tagColor}`}>
                    {item.tag}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2 font-mono">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI TECH STACK ─── */}
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/[0.02] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 relative">
          <div className="bento-card text-center">
            <p className="text-sm text-purple-400 font-semibold tracking-wider uppercase mb-3">The AI Stack</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
              Intelligence meets privacy
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
              Securio uses cutting-edge AI models while maintaining zero-knowledge encryption.
              Text is extracted locally, embedded server-side, and indexed for semantic retrieval.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: "Gemini AI", desc: "Embeddings", color: "text-blue-400" },
                { name: "Pinecone", desc: "Vector DB", color: "text-green-400" },
                { name: "Groq", desc: "LLM Inference", color: "text-amber-400" },
                { name: "Web Crypto", desc: "Client Encryption", color: "text-purple-400" },
              ].map((t, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center hover:border-white/[0.12] transition-all">
                  <p className={`text-sm font-bold ${t.color}`}>{t.name}</p>
                  <p className="text-[10px] text-gray-600 mt-1">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ─── */}
      <section className="py-24 relative">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bento-card text-center relative overflow-hidden">
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-radial from-green-500/[0.1] to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight">
                Ready to take control
                <br />
                of your data?
              </h2>
              <p className="text-gray-400 text-lg mb-10 max-w-lg mx-auto">
                Encrypt, search, and chat with your documents — all while maintaining complete privacy.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link href="/signup" className="cta-button flex items-center gap-2 text-base">
                  Get Started Free
                  <ArrowRightIcon className="w-5 h-5" />
                </Link>
                <Link href="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors px-6 py-4">
                  Already have an account? Sign in →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center space-x-1 mb-4">
                <Image src="/logo.png" alt="Logo" width={28} height={28} className="mt-0.5" />
                <span className="text-lg font-semibold text-white tracking-tight">SecurioX</span>
              </Link>
              <p className="text-gray-600 text-sm max-w-xs leading-relaxed mb-4">
                The AI-powered encrypted vault. Upload, encrypt, search by meaning, and chat with
                your documents — all with zero-knowledge privacy.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {['AES-256', 'RSA-2048', 'Gemini AI', 'Pinecone', 'Groq'].map(t => (
                  <span key={t} className="text-[10px] px-2 py-1 rounded-full border border-white/[0.06] text-gray-600">{t}</span>
                ))}
              </div>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><Link href="/signup" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Get Started</Link></li>
                <li><Link href="/login" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Sign In</Link></li>
                <li><Link href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Technology</h4>
              <ul className="space-y-2.5">
                <li><span className="text-gray-500 text-sm">Hybrid Encryption</span></li>
                <li><span className="text-gray-500 text-sm">Semantic Search</span></li>
                <li><span className="text-gray-500 text-sm">AI Document Chat</span></li>
                <li><span className="text-gray-500 text-sm">Zero-Knowledge</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/[0.06] mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-700 text-xs">
              © {new Date().getFullYear()} Securio. All rights reserved.
            </p>
            <p className="text-gray-700 text-xs">
              Built with zero-knowledge cryptography & AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}