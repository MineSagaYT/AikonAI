
import React from 'react';
import { motion } from 'framer-motion';

const MotionDiv = motion.div as any;

interface LandingPageProps {
    onStart: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
    return (
        <div className="bg-white text-text-main overflow-x-hidden relative selection:bg-brand-primary/20">
            {/* Animated Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="soft-blob bg-purple-300 w-96 h-96 top-0 left-0 mix-blend-multiply filter blur-3xl opacity-30"></div>
                <div className="soft-blob bg-blue-300 w-96 h-96 top-0 right-0 mix-blend-multiply animation-delay-2000 filter blur-3xl opacity-30"></div>
                <div className="soft-blob bg-pink-300 w-96 h-96 -bottom-32 left-1/2 mix-blend-multiply animation-delay-4000 filter blur-3xl opacity-30"></div>
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 nav-glass transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white shadow-lg">
                            <i className="ph-bold ph-brain text-xl"></i>
                        </div>
                        <span className="font-heading text-2xl font-bold tracking-tight text-text-main">Aikon<span className="text-brand-secondary">Ai</span></span>
                    </div>

                    <div className="hidden md:flex items-center gap-8 font-medium text-sm text-text-muted">
                        <a href="#features" className="hover:text-brand-primary transition">Features</a>
                        <a href="#mastermind" className="hover:text-brand-primary transition">The Architect</a>
                    </div>

                    <button 
                        onClick={onStart}
                        className="px-6 py-2.5 rounded-full bg-text-main text-white font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition flex items-center gap-2 group"
                    >
                        Get Started <i className="ph-bold ph-arrow-right group-hover:translate-x-1 transition-transform"></i>
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="min-h-screen flex flex-col items-center justify-center pt-24 px-4 relative">
                <div className="text-center max-w-4xl z-10 animate-fade-up">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-sm font-semibold text-text-muted mb-8 hover:border-brand-primary/50 transition cursor-default">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        <span>The Future is Agentic</span>
                    </div>

                    <h1 className="font-heading text-6xl md:text-8xl font-extrabold leading-[1.1] mb-6 tracking-tight text-text-main">
                        Your Idea. <br />
                        <span className="gradient-text">Built by Agentic AI.</span>
                    </h1>

                    <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto leading-relaxed mb-10 font-light">
                        AikonAi isn't just a chatbot. It's an intelligent companion that speaks <span className="text-text-main font-semibold">Hinglish</span>, executes real-world tasks, and brings your creative visions to life.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                        <button 
                            onClick={onStart}
                            className="px-8 py-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-2xl font-bold text-lg shadow-xl shadow-brand-primary/20 hover:shadow-2xl hover:scale-105 transition flex items-center gap-2"
                        >
                            <i className="ph-fill ph-chat-circle-dots"></i> Chat with Aikon
                        </button>
                    </div>
                </div>

                {/* Hero Visual */}
                <div className="mt-16 w-full max-w-5xl relative z-10 animate-float">
                    <div className="bg-white rounded-[2.5rem] p-3 shadow-2xl border border-gray-100">
                        <div className="bg-surface-light rounded-[2rem] overflow-hidden border border-gray-200 aspect-[16/9] md:aspect-[21/9] relative flex flex-col items-center justify-center group bg-opacity-50 backdrop-blur-sm">
                            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#4F46E5 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                            
                            <div className="flex flex-col gap-4 w-full max-w-lg px-4 relative z-10">
                                <MotionDiv 
                                    initial={{ opacity: 0, x: 20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="self-end bg-brand-primary text-white px-6 py-4 rounded-3xl rounded-tr-sm shadow-lg text-sm md:text-base font-medium"
                                >
                                    Bhai, ek coffee shop ke liye logo aur website design kardo. ☕️
                                </MotionDiv>
                                <MotionDiv 
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.8 }}
                                    className="self-start bg-white text-text-main border border-gray-200 px-6 py-5 rounded-3xl rounded-tl-sm shadow-lg flex flex-col gap-3"
                                >
                                    <div className="flex items-center gap-2 text-sm font-bold text-brand-secondary uppercase tracking-wider">
                                        <i className="ph-fill ph-sparkle"></i> AikonAi
                                    </div>
                                    <p className="text-sm md:text-base text-gray-700">Bilkul! Maine 3 logo variations generate kar diye hain aur website ka structure neeche hai.</p>
                                    <div className="flex gap-3 mt-1">
                                        <div className="h-16 w-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center text-2xl shadow-sm hover:scale-105 transition-transform">☕️</div>
                                        <div className="h-16 w-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center text-2xl shadow-sm hover:scale-105 transition-transform">🎨</div>
                                        <div className="h-16 w-16 bg-gradient-to-br from-pink-100 to-rose-100 rounded-xl flex items-center justify-center text-2xl shadow-sm hover:scale-105 transition-transform animate-pulse">✨</div>
                                    </div>
                                </MotionDiv>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="font-heading text-4xl font-bold mb-4">Innovation that feels <span className="text-brand-secondary">Natural</span></h2>
                    <p className="text-text-muted text-lg">14 powerful capabilities wrapped in one friendly interface.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: 'ph-translate', color: 'blue', title: 'Hinglish Fluency', desc: 'Chat just like you do with friends. "Apna" tone, local context, and seamless language switching.' },
                        { icon: 'ph-rocket-launch', color: 'purple', title: 'Real-World Action', desc: 'Need to navigate? Book something? AikonAi connects to the web to get actual tasks done for you.' },
                        { icon: 'ph-paint-brush-broad', color: 'pink', title: 'Visual Creativity', desc: 'Generate posters, videos, and storyboards. Perfect for creators needing instant assets.' },
                        { icon: 'ph-code', color: 'green', title: 'Code Sandbox', desc: 'A secure environment for devs to run Python, visualize data, and test scripts live.' },
                        { icon: 'ph-file-text', color: 'orange', title: 'Document Master', desc: 'Create PPTs, Excels, and Word docs instantly. Summarize 100-page PDFs in seconds.' },
                    ].map((f, i) => (
                        <div key={i} className="feature-card p-8 group bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                            <div className={`w-14 h-14 rounded-2xl bg-${f.color}-50 text-${f.color}-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition duration-300`}>
                                <i className={`ph-duotone ${f.icon}`}></i>
                            </div>
                            <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                            <p className="text-text-muted leading-relaxed">{f.desc}</p>
                        </div>
                    ))}

                    <div 
                        onClick={onStart}
                        className="feature-card p-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-brand-primary to-brand-secondary text-white border-none rounded-3xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group"
                    >
                        <div className="text-5xl font-bold mb-2 group-hover:scale-110 transition-transform">+9</div>
                        <p className="font-medium opacity-90">More Capabilities</p>
                        <button className="mt-6 px-5 py-2.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-bold hover:bg-white/30 transition flex items-center gap-2">
                            Try Them Now <i className="ph-bold ph-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </section>

            {/* The Architect */}
            <section id="mastermind" className="py-24 bg-surface-light border-y border-gray-100 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
                    <div className="lg:w-1/2 relative z-10">
                        <div className="inline-flex items-center gap-2 text-brand-primary font-bold text-sm tracking-widest uppercase mb-4">
                            <i className="ph-fill ph-crown"></i> The Mastermind
                        </div>
                        <h2 className="font-heading text-4xl md:text-5xl font-bold mb-6 text-text-main">Building the <br />Digital Ecosystem.</h2>
                        <p className="text-lg text-text-muted leading-relaxed mb-8">
                            Behind every innovation is a vision. AikonAi is the flagship intelligence model designed by <span className="text-text-main font-bold">Aditya Jain</span> to empower the next generation of creators.
                        </p>

                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 transition cursor-default hover:border-brand-primary/30">
                                <div className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center text-xl shadow-md">
                                    <i className="ph-fill ph-buildings"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-text-main">AikonStudios</h4>
                                    <p className="text-sm text-text-muted">The Parent Company & Innovation Lab.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 transition cursor-default hover:border-brand-primary/30">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary text-white flex items-center justify-center text-xl shadow-md">
                                    <i className="ph-fill ph-brain"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-text-main">AikonAi</h4>
                                    <p className="text-sm text-text-muted">The Intelligent Core & Flagship Model.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:w-1/2 relative">
                        <div className="absolute -top-10 -right-10 w-64 h-64 bg-brand-accent/20 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl"></div>
                        
                        <div className="relative bg-white p-3 rounded-[2rem] shadow-2xl rotate-3 hover:rotate-0 transition duration-500 ease-out group">
                            <div className="overflow-hidden rounded-[1.5rem] h-[500px] relative bg-gray-100">
                                {/* Placeholder for founder image if link breaks */}
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-400">
                                    <i className="ph-fill ph-user text-6xl"></i>
                                </div>
                                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&h=800" alt="Aditya Jain" className="w-full h-full object-cover relative z-10 transition-transform duration-700 group-hover:scale-105" />
                            </div>
                            <div className="absolute bottom-8 left-8 right-8 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white z-20">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h3 className="text-2xl font-bold text-text-main">Aditya Jain</h3>
                                        <p className="text-brand-primary font-medium">Founder & Lead Architect</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-brand-primary transition-colors">
                                        <i className="ph-fill ph-linkedin-logo"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 mb-12 flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                             <div className="w-8 h-8 rounded-lg bg-text-main text-white flex items-center justify-center font-bold">A</div>
                            <span className="text-xl font-bold text-text-main">AikonStudios</span>
                        </div>
                        <p className="text-sm text-text-muted">Creating intelligent solutions for a happier future.</p>
                    </div>
                    <div className="mt-8 md:mt-0 flex gap-4">
                         <a href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-text-muted hover:bg-brand-primary hover:text-white transition"><i className="ph-fill ph-twitter-logo"></i></a>
                         <a href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-text-muted hover:bg-brand-primary hover:text-white transition"><i className="ph-fill ph-instagram-logo"></i></a>
                         <a href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-text-muted hover:bg-brand-primary hover:text-white transition"><i className="ph-fill ph-linkedin-logo"></i></a>
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