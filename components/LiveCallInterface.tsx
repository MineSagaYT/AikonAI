import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { aikonPersonaInstruction, getLiveFunctionDeclarations, generateImage } from '../services/geminiService';
import { fetchWeather } from '../services/weatherService';

interface LiveCallInterfaceProps {
    onClose: () => void;
    userProfile: any;
}

const MotionDiv = motion.div as any;

const LiveCallInterface: React.FC<LiveCallInterfaceProps> = ({ onClose, userProfile }) => {
    const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);
    const [volume, setVolume] = useState(0);
    const [activeCard, setActiveCard] = useState<{ type: 'image' | 'weather' | 'search'; data: any } | null>(null);

    // Audio Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sessionRef = useRef<any>(null); // Holds the active session object

    // Video Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoStreamRef = useRef<MediaStream | null>(null);
    const videoIntervalRef = useRef<any>(null); // Changed from NodeJS.Timeout to any

    useEffect(() => {
        startSession();
        return () => {
            stopSession();
            stopVideo();
        };
    }, []);

    // --- Audio & Session Management ---

    const startSession = async () => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            // Get Microphone
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Setup Visualizer logic
            const analyser = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            source.connect(analyser);
            analyser.fftSize = 256;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const updateVolume = () => {
                // If muted, force volume to 0 visually
                if (isMuted) {
                    setVolume(0);
                    requestAnimationFrame(updateVolume);
                    return;
                }

                if (!streamRef.current) return;
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setVolume(avg);
                requestAnimationFrame(updateVolume);
            };
            updateVolume();

            // Connect to Gemini Live
            const config = {
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    systemInstruction: aikonPersonaInstruction + "\n\nIMPORTANT: You are in a VOICE CALL. Keep responses concise, conversational, and friendly. Do not use markdown formatting in speech. If the user turns on their camera, you will receive image frames. Use them to answer questions about what you see.",
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } // Male voice
                    },
                    tools: [{ functionDeclarations: getLiveFunctionDeclarations() }, { googleSearch: {} }]
                }
            };

            const sessionPromise = ai.live.connect({
                ...config,
                callbacks: {
                    onopen: () => {
                        setStatus('connected');
                        // Start Audio Input Stream
                        const ctx = audioContextRef.current!;
                        inputSourceRef.current = ctx.createMediaStreamSource(streamRef.current!);
                        processorRef.current = ctx.createScriptProcessor(4096, 1, 1);
                        
                        processorRef.current.onaudioprocess = (e) => {
                            if (isMuted) return; // LOGICAL MUTE: Don't send data
                            
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmData = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) {
                                pcmData[i] = inputData[i] * 32768;
                            }
                            
                            // Convert to base64
                            let binary = '';
                            const bytes = new Uint8Array(pcmData.buffer);
                            const len = bytes.byteLength;
                            for (let i = 0; i < len; i++) {
                                binary += String.fromCharCode(bytes[i]);
                            }
                            const base64 = btoa(binary);

                            sessionPromise.then(session => {
                                session.sendRealtimeInput({
                                    media: {
                                        mimeType: 'audio/pcm;rate=16000',
                                        data: base64
                                    }
                                });
                            });
                        };
                        
                        inputSourceRef.current.connect(processorRef.current);
                        processorRef.current.connect(ctx.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        // Handle Audio Output
                        const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            playAudioChunk(audioData);
                        }

                        // Handle Tool Calls
                        if (msg.toolCall) {
                            handleToolCall(msg.toolCall, sessionPromise);
                        }
                    },
                    onclose: () => console.log("Session closed"),
                    onerror: (e) => console.error("Session error", e)
                }
            });
            
            // Store the session for video usage
            sessionRef.current = sessionPromise;

        } catch (e) {
            console.error("Failed to start call", e);
            setStatus('error');
        }
    };

    const stopSession = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close();
    };

    const playAudioChunk = async (base64: string) => {
        if (!audioContextRef.current) return;
        
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const pcmData = new Int16Array(bytes.buffer);
            const audioBuffer = audioContextRef.current.createBuffer(1, pcmData.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < pcmData.length; i++) {
                channelData[i] = pcmData[i] / 32768.0;
            }

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            
            const currentTime = audioContextRef.current.currentTime;
            const startTime = Math.max(currentTime, nextStartTimeRef.current);
            source.start(startTime);
            nextStartTimeRef.current = startTime + audioBuffer.duration;
        } catch (e) {
            console.error("Audio playback error", e);
        }
    };

    // --- Video Management ---

    const toggleVideo = async () => {
        if (isVideoOn) {
            stopVideo();
        } else {
            startVideo();
        }
    };

    const startVideo = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            videoStreamRef.current = stream;
            setIsVideoOn(true);
            
            // Wait for ref to attach
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }
            }, 100);

            // Start sending frames
            videoIntervalRef.current = setInterval(sendVideoFrame, 500); // 2 FPS is efficient for Live API
        } catch (e) {
            console.error("Failed to access camera", e);
        }
    };

    const stopVideo = () => {
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach(track => track.stop());
            videoStreamRef.current = null;
        }
        if (videoIntervalRef.current) {
            clearInterval(videoIntervalRef.current);
            videoIntervalRef.current = null;
        }
        setIsVideoOn(false);
    };

    const sendVideoFrame = () => {
        if (!videoRef.current || !canvasRef.current || !sessionRef.current || status !== 'connected') return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Draw video frame to canvas
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);

        // Get base64 string (remove data prefix)
        const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.6).split(',')[1];

        // Send to Gemini
        sessionRef.current.then((session: any) => {
            session.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            });
        });
    };


    // --- Tool Handling ---

    const handleToolCall = async (toolCall: any, sessionPromise: Promise<any>) => {
        for (const fc of toolCall.functionCalls) {
            let result: any = { result: "ok" };
            
            if (fc.name === 'generate_image') {
                setActiveCard({ type: 'image', data: { prompt: fc.args.prompt, loading: true } });
                
                try {
                     const imageUrl = await generateImage(fc.args.prompt);
                     if (imageUrl) {
                        setActiveCard({ type: 'image', data: { prompt: fc.args.prompt, url: imageUrl } });
                        result = { result: "Image generated successfully." };
                     } else {
                         setActiveCard({ type: 'image', data: { prompt: fc.args.prompt, url: 'https://placehold.co/600x400?text=Generation+Failed' } });
                         result = { error: "Failed to generate image." };
                     }
                } catch(e) {
                    console.error(e);
                    result = { error: "Failed to generate image." };
                }
            } else if (fc.name === 'fetch_weather') {
                setActiveCard({ type: 'weather', data: { loading: true } });
                const weather = await fetchWeather(fc.args.location);
                setActiveCard({ type: 'weather', data: weather });
                result = weather;
            }

            sessionPromise.then(session => {
                session.sendToolResponse({
                    functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result }
                    }
                });
            });
        }
    };

    return (
        <MotionDiv 
            className="fixed inset-0 z-50 bg-[#0F172A] text-white flex flex-col items-center justify-between p-8 overflow-hidden"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
        >
            {/* Hidden Canvas for Video Processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
            </div>

            {/* Header */}
            <div className="w-full flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
                        <i className="ph-fill ph-brain text-xl text-indigo-400"></i>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Aikon Live</h3>
                        <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></span>
                            <span className="text-xs text-white/60 uppercase tracking-widest">{status}</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition"><i className="ph-bold ph-arrows-out-simple-light"></i></button>
            </div>

            {/* Main Visualizer Area */}
            <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10">
                
                {/* Active Card Overlay */}
                <AnimatePresence>
                    {activeCard && (
                        <MotionDiv 
                            className="absolute top-10 z-20 w-full max-w-sm"
                            initial={{ scale: 0.8, opacity: 0, y: -20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: -20 }}
                        >
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 shadow-2xl">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-white/70">{activeCard.type}</span>
                                    <button onClick={() => setActiveCard(null)} className="text-white/50 hover:text-white"><i className="ph-bold ph-x"></i></button>
                                </div>
                                
                                {activeCard.type === 'image' && (
                                    <div className="aspect-square rounded-xl bg-black/20 flex items-center justify-center overflow-hidden">
                                        {activeCard.data.loading ? (
                                            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <img src={activeCard.data.url} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                )}

                                {activeCard.type === 'weather' && (
                                    activeCard.data.loading ? (
                                        <div className="h-32 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div></div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <div className="text-4xl font-bold">{activeCard.data.temperature}</div>
                                            <div className="text-xl">{activeCard.data.city}</div>
                                            <div className="text-sm opacity-70 capitalize">{activeCard.data.description}</div>
                                        </div>
                                    )
                                )}
                            </div>
                        </MotionDiv>
                    )}
                </AnimatePresence>

                {/* Orb */}
                <div className="relative">
                    {/* Ripple Effects */}
                    {[1, 2, 3].map(i => (
                        <motion.div 
                            key={i}
                            className="absolute inset-0 rounded-full border border-indigo-500/30"
                            animate={{ scale: [1, 1.5 + (volume/50)], opacity: [0.5, 0] }}
                            transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 }}
                        />
                    ))}
                    
                    {/* Core Orb */}
                    <motion.div 
                        className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_50px_rgba(99,102,241,0.5)] flex items-center justify-center relative overflow-hidden"
                        animate={{ scale: 1 + (volume / 100) }}
                    >
                         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay"></div>
                         <div className="w-full h-full bg-gradient-to-t from-black/20 to-transparent"></div>
                    </motion.div>
                </div>
                
                {/* Self View (Video) */}
                <AnimatePresence>
                    {isVideoOn && (
                        <MotionDiv 
                            className="absolute bottom-4 right-4 w-32 h-44 bg-black rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            drag
                            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                        >
                             <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                             <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        </MotionDiv>
                    )}
                </AnimatePresence>

                <p className="mt-8 text-white/50 font-medium tracking-wide animate-pulse">
                    {status === 'connecting' ? 'Connecting Secure Channel...' : 'Listening...'}
                </p>
            </div>

            {/* Controls */}
            <div className="w-full max-w-md grid grid-cols-3 gap-6 z-10">
                <button 
                    onClick={() => setIsMuted(!isMuted)} 
                    className={`h-16 rounded-full flex items-center justify-center text-2xl transition ${isMuted ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                    <i className={`ph-fill ${isMuted ? 'ph-microphone-slash' : 'ph-microphone'}`}></i>
                </button>
                
                <button 
                    onClick={onClose} 
                    className="h-16 rounded-full bg-red-500 text-white flex items-center justify-center text-3xl shadow-lg shadow-red-500/40 hover:scale-105 transition"
                >
                    <i className="ph-fill ph-phone-disconnect"></i>
                </button>

                <button 
                    onClick={toggleVideo}
                    className={`h-16 rounded-full flex items-center justify-center text-2xl transition ${isVideoOn ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                    <i className={`ph-fill ${isVideoOn ? 'ph-video-camera-slash' : 'ph-video-camera'}`}></i>
                </button>
            </div>
        </MotionDiv>
    );
};

export default LiveCallInterface;