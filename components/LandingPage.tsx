
import React from 'react';
import { motion } from 'framer-motion';

interface LandingPageProps {
    onStart: () => void;
}

const MotionDiv = motion.div as any;
const MotionSection = motion.section as any;
const MotionButton = motion.button as any;

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
    return (
        <div className="relative min-h-screen font-sans text-[#1E293B] bg-[#F8FAFC]">
            {/* Animated Background Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="soft-blob bg-purple-300 w-96 h-96 top-0 left-0 mix-blend-multiply"></div>
                <div className="soft-blob bg-blue-300 w-96 h-96 top-0 right-0 mix-blend-multiply animation-delay-2000"></div>
                <div className="soft-blob bg-pink-300 w-96 h-96 -bottom-32 left-1/2 mix-blend-multiply animation-delay-4000"></div>
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 nav-glass transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    {/* Brand */}
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-accent-500 flex items-center justify-center text-white shadow-lg">
                            <i className="ph-bold ph-brain text-xl"></i>
                        </div>
                        <span className="font-heading text-2xl font-bold tracking-tight text-text-main">Aikon<span className="text-brand-600">Ai</span></span>
                    </div>

                    {/* Links */}
                    <div className="hidden md:flex items-center gap-8 font-medium text-sm text-text-muted">
                        <a href="#features" className="hover:text-brand-600 transition">Features</a>
                        <a href="#mastermind" className="hover:text-brand-600 transition">The Architect</a>
                        <a href="#" className="hover:text-brand-600 transition">Community</a>
                    </div>

                    {/* CTA */}
                    <button onClick={onStart} className="px-6 py-2.5 rounded-full bg-text-main text-white font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition flex items-center gap-2 cursor-pointer">
                        Get Started <i className="ph-bold ph-arrow-right"></i>
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="min-h-screen flex flex-col items-center justify-center pt-24 px-4 relative">
                <div className="text-center max-w-4xl z-10 animate-fade-up">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-sm font-semibold text-text-muted mb-8 hover:border-brand-600/50 transition cursor-default">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span>The Future is Agentic</span>
                    </div>

                    <h1 className="font-heading text-6xl md:text-8xl font-bold leading-[1.1] mb-6 tracking-tight text-text-main">
                        Your Idea. <br />
                        <span className="gradient-text">Built by Agentic AI.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed mb-10">
                        AikonAi isn't just a chatbot. It's an intelligent companion that speaks <span className="text-text-main font-bold">Hinglish</span>, executes real-world tasks, and brings your creative visions to life.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                        <button onClick={onStart} className="px-8 py-4 bg-gradient-to-r from-brand-600 to-accent-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-brand-600/20 hover:shadow-2xl hover:scale-105 transition flex items-center gap-2 cursor-pointer">
                            <i className="ph-fill ph-chat-circle-dots"></i> Chat with Aikon
                        </button>
                        <button className="px-8 py-4 bg-white text-text-main border border-gray-200 rounded-2xl font-bold text-lg shadow-sm hover:border-accent-500 hover:text-accent-500 transition flex items-center gap-2 cursor-pointer">
                            <i className="ph-fill ph-play-circle"></i> Watch Demo
                        </button>
                    </div>
                </div>

                {/* Hero Visual / Floating UI Mockup */}
                <div className="mt-16 w-full max-w-5xl relative z-10 animate-float">
                    <div className="bg-white rounded-[2.5rem] p-4 shadow-2xl border border-gray-100">
                        <div className="bg-surface-light rounded-[2rem] overflow-hidden border border-gray-200 aspect-[16/9] md:aspect-[21/9] relative flex flex-col items-center justify-center group">
                            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4F46E5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                            <div className="flex flex-col gap-4 w-full max-w-lg px-4">
                                <div className="self-end bg-brand-600 text-white px-6 py-3 rounded-2xl rounded-tr-sm shadow-md text-sm md:text-base">
                                    Bhai, ek coffee shop ke liye logo aur website design kardo. ☕️
                                </div>
                                <div className="self-start bg-white text-text-main border border-gray-200 px-6 py-4 rounded-2xl rounded-tl-sm shadow-sm flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-accent-500">
                                        <i className="ph-fill ph-sparkle"></i> AikonAi
                                    </div>
                                    <p className="text-sm md:text-base">Bilkul! Maine 3 logo variations generate kar diye hain aur website ka structure neeche hai.</p>
                                    <div className="flex gap-2 mt-1">
                                        <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center text-xl">☕️</div>
                                        <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center text-xl">🎨</div>
                                        <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center text-xl animate-pulse">✨</div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute -top-6 -right-6 w-20 h-20 bg-yellow-400 rounded-full blur-xl opacity-20"></div>
                            <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-accent-500 rounded-full blur-xl opacity-20"></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="font-heading text-4xl font-bold mb-4">Innovation that feels <span className="text-accent-500">Natural</span></h2>
                    <p className="text-text-muted text-lg">14 powerful capabilities wrapped in one friendly interface.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: 'ph-translate', color: 'blue', title: 'Hinglish Fluency', desc: 'Chat just like you do with friends. "Apna" tone, local context, and seamless language switching.' },
                        { icon: 'ph-rocket-launch', color: 'purple', title: 'Real-World Action', desc: 'Need to navigate? Book something? AikonAi connects to the web to get actual tasks done for you.' },
                        { icon: 'ph-paint-brush-broad', color: 'pink', title: 'Visual Creativity', desc: 'Generate posters, videos, and storyboards. Perfect for creators needing instant assets.' },
                        { icon: 'ph-code', color: 'green', title: 'Code Sandbox', desc: 'A secure environment for devs to run Python, visualize data, and test scripts live.' },
                        { icon: 'ph-file-text', color: 'orange', title: 'Document Master', desc: 'Create PPTs, Excels, and Word docs instantly. Summarize 100-page PDFs in seconds.' },
                    ].map((feat, i) => (
                        <div key={i} className="feature-card p-8 group">
                            <div className={`w-14 h-14 rounded-2xl bg-${feat.color}-50 text-${feat.color}-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition duration-300`}>
                                <i className={`ph-duotone ${feat.icon}`}></i>
                            </div>
                            <h3 className="text-xl font-bold mb-3">{feat.title}</h3>
                            <p className="text-text-muted leading-relaxed">{feat.desc}</p>
                        </div>
                    ))}
                    <div className="feature-card p-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-brand-600 to-accent-500 text-white border-none cursor-pointer hover:shadow-2xl transition" onClick={onStart}>
                        <div className="text-5xl font-bold mb-2">+9</div>
                        <p className="font-medium opacity-90">More Capabilities</p>
                        <button className="mt-6 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold hover:bg-white/30 transition">Try Them Now</button>
                    </div>
                </div>
            </section>

            {/* THE ARCHITECT SECTION */}
            <section id="mastermind" className="py-24 bg-surface-light border-y border-gray-100 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
                    {/* Text Side */}
                    <div className="lg:w-1/2">
                        <div className="inline-flex items-center gap-2 text-brand-600 font-bold text-sm tracking-widest uppercase mb-4">
                            <i className="ph-fill ph-crown"></i> The Mastermind
                        </div>
                        <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6 text-text-main">Building the <br />Digital Ecosystem.</h2>
                        <p className="text-lg text-text-muted leading-relaxed mb-8">
                            Behind every innovation is a vision. AikonAi is the flagship intelligence model designed by <span className="text-text-main font-bold">Aditya Jain</span> to empower the next generation of creators, deeply rooted in <span className="text-brand-600 font-medium">Sanatan values</span> and modern tech.
                        </p>

                        {/* Connections */}
                        <div className="flex flex-col gap-4">
                            {[
                                { icon: 'ph-buildings', title: 'AikonStudios', desc: 'The Parent Company & Innovation Lab.', color: 'gray-900' },
                                { icon: 'ph-brain', title: 'AikonAi', desc: 'The Intelligent Core & Flagship Model.', color: 'brand-600', active: true },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-brand-600/30 transition">
                                    <div className={`w-12 h-12 rounded-xl ${item.active ? 'bg-gradient-to-br from-brand-600 to-accent-500' : 'bg-gray-900'} text-white flex items-center justify-center text-xl`}>
                                        <i className={`ph-fill ${item.icon}`}></i>
                                    </div>
                                    <div><h4 className="font-bold text-text-main">{item.title}</h4><p className="text-sm text-text-muted">{item.desc}</p></div>
                                    {item.active && <span className="ml-auto text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Abstract Digital Identity */}
                    <div className="lg:w-1/2 relative flex justify-center">
                        <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-brand-600/20 rounded-full blur-3xl"></div>

                        <div className="relative w-full max-w-md bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-[2rem] shadow-2xl flex flex-col items-center text-center animate-float">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 to-accent-500 p-1 mb-6 shadow-lg relative group">
                                <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                                    <span className="font-heading text-4xl font-bold bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">AJ</span>
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-text-main text-white text-xs px-3 py-1 rounded-full shadow-md">Founder</div>
                            </div>

                            <h3 className="text-3xl font-heading font-bold text-text-main mb-1">Aditya Jain</h3>
                            <p className="text-brand-600 font-medium mb-6">Lead Architect & Visionary</p>

                            <div className="flex gap-3 mb-8">
                                <span className="px-3 py-1 bg-white/60 rounded-lg text-xs font-bold text-text-muted border border-white">AI Research</span>
                                <span className="px-3 py-1 bg-white/60 rounded-lg text-xs font-bold text-text-muted border border-white">Sanatan Dharma</span>
                                <span className="px-3 py-1 bg-white/60 rounded-lg text-xs font-bold text-text-muted border border-white">Full Stack</span>
                            </div>

                            <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-6"></div>

                            <div className="flex gap-4">
                                <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-text-muted hover:bg-brand-600 hover:text-white transition shadow-sm"><i className="ph-fill ph-twitter-logo"></i></a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-text-muted hover:bg-brand-600 hover:text-white transition shadow-sm"><i className="ph-fill ph-linkedin-logo"></i></a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-text-muted hover:bg-brand-600 hover:text-white transition shadow-sm"><i className="ph-fill ph-github-logo"></i></a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="col-span-1 md:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-text-main text-white flex items-center justify-center font-bold">A</div>
                            <span className="text-xl font-bold text-text-main">AikonStudios</span>
                        </div>
                        <p className="text-sm text-text-muted">Creating intelligent solutions for a happier future.</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-text-main mb-4">Product</h4>
                        <ul class="space-y-2 text-sm text-text-muted">
                            <li><a href="#" className="hover:text-brand-600">Features</a></li>
                            <li><a href="#" className="hover:text-brand-600">Pricing</a></li>
                            <li><a href="#" className="hover:text-brand-600">API</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-text-main mb-4">Company</h4>
                        <ul class="space-y-2 text-sm text-text-muted">
                            <li><a href="#" className="hover:text-brand-600">About Aditya</a></li>
                            <li><a href="#" className="hover:text-brand-600">Careers</a></li>
                            <li><a href="#" className="hover:text-brand-600">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-text-main mb-4">Connect</h4>
                        <div class="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-text-muted hover:bg-brand-600 hover:text-white transition"><i class="ph-fill ph-twitter-logo"></i></a>
                            <a href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-text-muted hover:bg-brand-600 hover:text-white transition"><i class="ph-fill ph-instagram-logo"></i></a>
                        </div>
                    </div>
                </div>
                <div className="text-center text-text-muted text-sm border-t border-gray-100 pt-8">
                    &copy; 2025 AikonStudios. Built with ❤️ by Aditya Jain.
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
