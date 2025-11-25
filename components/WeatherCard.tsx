import React from 'react';
import { motion } from 'framer-motion';
import { WeatherData } from '../types';

const MotionSvg = motion.svg as any;
const MotionLine = motion.line as any;
const MotionDiv = motion.div as any;

// --- Animated SVG Icons ---
const SunnyIcon = () => (
    <MotionSvg 
        className="w-20 h-20 text-yellow-300 drop-shadow-lg" 
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
    >
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </MotionSvg>
);

const NightClearIcon = () => (
     <MotionSvg 
        className="w-20 h-20 text-slate-300 drop-shadow-lg" 
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        initial={{ scale: 0.95, opacity: 0.9, rotate: -15 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 4, ease: 'easeInOut' }}
     >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </MotionSvg>
);

const CloudyIcon = () => (
    <div className="relative w-20 h-20">
        <MotionSvg 
            className="absolute w-full h-full text-gray-300/80 drop-shadow-lg" 
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            initial={{ x: -10 }} animate={{ x: 10 }} 
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 5, ease: 'easeInOut' }}
        >
            <path d="M18 10h-1.26A8.003 8.003 0 0 0 9 6a8.005 8.005 0 0 0-7.75 6.09"></path>
        </MotionSvg>
        <MotionSvg 
            className="absolute w-full h-full text-gray-200 drop-shadow-lg" 
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            initial={{ x: 5, y: 5 }} animate={{ x: -5 }} 
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 6, ease: 'easeInOut' }}
        >
            <path d="M17.5 18H7a5 5 0 0 1 0-10h.2A8.005 8.005 0 0 1 15 6a8.003 8.003 0 0 1 7.26 6H22a4.5 4.5 0 0 1 0 9h-4.5"></path>
        </MotionSvg>
    </div>
);

const RainyIcon = () => (
    <div className="relative w-20 h-20">
        <CloudyIcon />
        <MotionSvg 
            className="absolute w-full h-full text-blue-300/80" 
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
        >
            {[...Array(3)].map((_, i) => (
                <MotionLine 
                    key={i}
                    x1={8 + i * 4} y1="12" x2={6 + i * 4} y2="18"
                    initial={{ y: -5, opacity: 0 }} 
                    animate={{ y: 0, opacity: [0, 1, 1, 0] }} 
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }} 
                />
            ))}
        </MotionSvg>
    </div>
);

const DefaultIcon = () => (
    <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
);


const getWeatherStyle = (iconCode?: string) => {
    if (!iconCode) return { gradient: 'from-gray-700 to-gray-800', Icon: DefaultIcon };

    const code = iconCode.substring(0, 2);
    const isDay = iconCode.endsWith('d');

    switch(code) {
        case '01': // clear
            return isDay 
                ? { gradient: 'from-sky-500 to-indigo-500', Icon: SunnyIcon }
                : { gradient: 'from-slate-900 to-indigo-900', Icon: NightClearIcon };
        case '02': // few clouds
        case '03': // scattered clouds
        case '04': // broken clouds
             return isDay 
                ? { gradient: 'from-sky-600 to-gray-500', Icon: CloudyIcon }
                : { gradient: 'from-slate-800 to-gray-700', Icon: CloudyIcon };
        case '09': // shower rain
        case '10': // rain
             return isDay 
                ? { gradient: 'from-slate-500 to-blue-800', Icon: RainyIcon }
                : { gradient: 'from-slate-900 to-blue-900', Icon: RainyIcon };
        case '11': // thunderstorm
            return { gradient: 'from-gray-800 to-purple-900', Icon: RainyIcon }; // Placeholder
        case '13': // snow
            return { gradient: 'from-slate-400 to-cyan-600', Icon: DefaultIcon }; // Placeholder
        case '50': // mist
            return { gradient: 'from-gray-500 to-gray-700', Icon: CloudyIcon };
        default:
            return { gradient: 'from-gray-700 to-gray-800', Icon: DefaultIcon };
    }
}


const WeatherCard: React.FC<{ data: WeatherData }> = ({ data }) => {
    const { gradient, Icon } = getWeatherStyle(data.icon);
    
    return (
        <MotionDiv
            className={`w-full max-w-sm rounded-2xl p-6 text-white overflow-hidden relative shadow-2xl shadow-black/30 border border-white/10`}
            style={{
                background: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))`,
            }}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ 
                opacity: 1, y: 0, scale: 1, 
                '--tw-gradient-from': `var(--tw-color-${gradient.split(' ')[0]})`, 
                '--tw-gradient-to': `var(--tw-color-${gradient.split(' ')[1]})`
            }}
            whileHover={{ scale: 1.03, y: -5 }}
            transition={{ type: "spring", stiffness: 150, damping: 20 }}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-2xl font-bold">{data.city}</h3>
                    <p className="text-sm opacity-80">{data.country}</p>
                </div>
                <div className="flex-shrink-0">
                    <Icon />
                </div>
            </div>
            <div className="mt-4 flex justify-between items-end">
                <p className="text-6xl font-extrabold tracking-tighter">{data.temperature}</p>
                <p className="text-lg font-medium capitalize text-right">{data.description}</p>
            </div>
        </MotionDiv>
    );
};

export default WeatherCard;