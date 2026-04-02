/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Trash2, Download, Upload, MoveUp, MoveDown, FileText, Image as ImageIcon, X, Rocket, CheckSquare, Square, Check, Grid, AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown, GripVertical, Settings, Folder } from 'lucide-react';
import { get, set } from 'idb-keyval';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';

import { motion, AnimatePresence } from 'motion/react';

interface TextStyle {
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
}

interface PricelistItem {
  id: string;
  sku: string;
  description: string;
  normalPrice: string;
  promoPrice: string;
  isCategory: boolean;
  image?: string | null;
  styles: {
    sku: TextStyle;
    description: TextStyle;
    normalPrice: TextStyle;
    promoPrice: TextStyle;
  };
}

const DEFAULT_STYLE: TextStyle = {
  color: '#0f172a',
  fontSize: 10.5,
  bold: false,
  italic: false,
  underline: false,
  fontFamily: '"Inter", sans-serif',
  align: 'left',
};

const CATEGORY_STYLE: TextStyle = {
  color: '#124e8f',
  fontSize: 11,
  bold: true,
  italic: false,
  underline: false,
  fontFamily: '"Inter", sans-serif',
  align: 'left',
};

const AutoFitText = ({ 
  text, 
  style, 
  className = "", 
  align = "left", 
  minScale = 0.75,
  isEditing = false,
  onChange
}: { 
  text: string, 
  style: TextStyle, 
  className?: string, 
  align?: "left" | "right" | "center", 
  minScale?: number,
  isEditing?: boolean,
  onChange?: (val: string) => void
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);

  const effectiveAlign = style.align || align;

  useEffect(() => {
    const span = spanRef.current;
    if (!span) return;

    const checkFit = () => {
      const parent = span.parentElement?.parentElement;
      if (!parent) return;
      
      const parentWidth = parent.clientWidth - 8; // Padding margin
      const contentWidth = span.scrollWidth;
      
      if (contentWidth > parentWidth && contentWidth > 0) {
        setScale(Math.max(minScale, parentWidth / contentWidth));
      } else {
        setScale(1);
      }
    };

    checkFit();
    const observer = new ResizeObserver(checkFit);
    if (span.parentElement?.parentElement) {
      observer.observe(span.parentElement.parentElement);
    }
    return () => observer.disconnect();
  }, [text, style.fontSize, minScale]);

  const originClass = effectiveAlign === "right" ? "origin-right" : effectiveAlign === "center" ? "origin-center" : "origin-left";
  const justifyClass = effectiveAlign === "right" ? "justify-end" : effectiveAlign === "center" ? "justify-center" : "justify-start";

  return (
    <div 
      className={`relative w-full h-full flex items-start overflow-hidden ${justifyClass}`}
      onClick={() => {
        if (isEditing && inputRef.current) {
          inputRef.current.focus();
        }
      }}
    >
      <div
        className={`whitespace-nowrap transition-transform duration-200 ${originClass} ${className} relative min-w-full`}
        style={{
          transform: `scale(${scale})`,
          color: style.color,
          fontSize: `${style.fontSize}px`,
          fontWeight: style.bold ? '900' : 'normal',
          fontStyle: style.italic ? 'italic' : 'normal',
          textDecoration: style.underline ? 'underline' : 'none',
          fontFamily: style.fontFamily || 'inherit',
          textAlign: effectiveAlign as any,
          textOverflow: scale <= minScale ? 'ellipsis' : 'clip',
          overflow: scale <= minScale ? 'hidden' : 'visible',
          width: scale <= minScale ? `${(1/minScale) * 100}%` : 'auto',
        }}
      >
        <span ref={spanRef} style={{ display: 'inline-block', opacity: isEditing ? 0 : 1, minWidth: '100%' }}>{text || " "}</span>
        {isEditing && onChange && (
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full bg-transparent border-none p-0 m-0 focus:outline-none caret-blue-500 selection:bg-blue-500/30 cursor-text uppercase"
            style={{
               textAlign: effectiveAlign as any,
               fontFamily: 'inherit',
               fontSize: 'inherit',
               fontWeight: 'inherit',
               fontStyle: 'inherit',
               textDecoration: 'inherit',
               color: 'inherit',
               lineHeight: 'inherit'
            }}
          />
        )}
      </div>
    </div>
  );
};

const ColumnResizer = ({ onResize, width, onWidthChange }: { onResize: (delta: number) => void, width: number, onWidthChange: (w: number) => void }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [inputValue, setInputValue] = useState(Math.round(width).toString());
  const startX = useRef(0);

  useEffect(() => {
    setInputValue(Math.round(width).toString());
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX.current;
      onResize(delta);
      startX.current = e.clientX;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlurOrEnter = () => {
    const val = parseInt(inputValue);
    if (!isNaN(val) && val > 10) {
      onWidthChange(val);
    } else {
      setInputValue(Math.round(width).toString());
    }
  };

  return (
    <div
      className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize z-20 print:hidden group/resizer flex justify-center"
      onMouseDown={(e) => {
        e.preventDefault();
        startX.current = e.clientX;
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
      }}
    >
      <div className="w-1.5 h-full group-hover/resizer:bg-blue-400/50 transition-colors" />
      <div 
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-neutral-800 text-white text-[10px] rounded px-2 py-1 flex items-center gap-1 opacity-0 group-hover/resizer:opacity-100 transition-opacity pointer-events-none group-hover/resizer:pointer-events-auto z-50 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-neutral-400">W:</span>
        <input 
          type="number" 
          value={inputValue} 
          onChange={handleInputChange}
          onBlur={handleInputBlurOrEnter}
          onKeyDown={(e) => e.key === 'Enter' && handleInputBlurOrEnter()}
          className="w-10 bg-transparent border-b border-neutral-500 text-center outline-none focus:border-white appearance-none m-0 p-0"
        />
        <span className="text-neutral-400">px</span>
      </div>
    </div>
  );
};

const RowResizer = ({ onResize, height, onHeightChange }: { onResize: (delta: number) => void, height: number, onHeightChange: (h: number) => void }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [inputValue, setInputValue] = useState(Math.round(height).toString());
  const startY = useRef(0);

  useEffect(() => {
    setInputValue(Math.round(height).toString());
  }, [height]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - startY.current;
      onResize(delta);
      startY.current = e.clientY;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onResize]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlurOrEnter = () => {
    const val = parseInt(inputValue);
    if (!isNaN(val) && val > 10) {
      onHeightChange(val);
    } else {
      setInputValue(Math.round(height).toString());
    }
  };

  return (
    <div
      className="absolute -bottom-2 left-0 right-0 h-4 cursor-row-resize z-20 print:hidden group/resizer flex flex-col justify-center"
      onMouseDown={(e) => {
        e.preventDefault();
        startY.current = e.clientY;
        setIsResizing(true);
        document.body.style.cursor = 'row-resize';
      }}
    >
      <div className="h-1.5 w-full group-hover/resizer:bg-blue-400/50 transition-colors" />
      <div 
        className="absolute bottom-full right-4 mb-1 bg-neutral-800 text-white text-[10px] rounded px-2 py-1 flex items-center gap-1 opacity-0 group-hover/resizer:opacity-100 transition-opacity pointer-events-none group-hover/resizer:pointer-events-auto z-50 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-neutral-400">H:</span>
        <input 
          type="number" 
          value={inputValue} 
          onChange={handleInputChange}
          onBlur={handleInputBlurOrEnter}
          onKeyDown={(e) => e.key === 'Enter' && handleInputBlurOrEnter()}
          className="w-10 bg-transparent border-b border-neutral-500 text-center outline-none focus:border-white appearance-none m-0 p-0"
        />
        <span className="text-neutral-400">px</span>
      </div>
    </div>
  );
};

const WEB_SAFE_FONTS = [
  { name: 'Inter', value: '"Inter", sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Roboto', value: '"Roboto", sans-serif' },
  { name: 'Open Sans', value: '"Open Sans", sans-serif' },
  { name: 'Montserrat', value: '"Montserrat", sans-serif' },
  { name: 'Lato', value: '"Lato", sans-serif' },
  { name: 'Poppins', value: '"Poppins", sans-serif' },
  { name: 'Playfair Display', value: '"Playfair Display", serif' },
  { name: 'Merriweather', value: '"Merriweather", serif' },
  { name: 'Oswald', value: '"Oswald", sans-serif' },
  { name: 'Raleway', value: '"Raleway", sans-serif' },
  { name: 'Nunito', value: '"Nunito", sans-serif' },
  { name: 'Ubuntu', value: '"Ubuntu", sans-serif' },
  { name: 'PT Sans', value: '"PT Sans", sans-serif' },
  { name: 'PT Serif', value: '"PT Serif", serif' },
  { name: 'Quicksand', value: '"Quicksand", sans-serif' },
  { name: 'Josefin Sans', value: '"Josefin Sans", sans-serif' },
  { name: 'Bebas Neue', value: '"Bebas Neue", cursive' },
  { name: 'Cormorant Garamond', value: '"Cormorant Garamond", serif' },
  { name: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
  { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const CustomSelect = ({ 
  value, 
  onChange, 
  options, 
  className = "" 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  options: { label: string, value: string, style?: React.CSSProperties }[],
  className?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div 
        className="flex items-center justify-between text-[10px] font-semibold bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:bg-neutral-100 transition-colors min-w-[110px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={selectedOption?.style} className="truncate mr-2">{selectedOption?.label}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-xl z-[200] py-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {options.map(opt => (
            <div
              key={opt.value}
              className={`px-3 py-2 text-[10px] cursor-pointer hover:bg-[#124e8f]/5 hover:text-[#124e8f] transition-colors ${value === opt.value ? 'bg-[#124e8f]/10 text-[#124e8f] font-bold' : 'text-neutral-700 font-medium'}`}
              style={opt.style}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StyleToolbar = ({ 
  style, 
  onChange, 
  onClose, 
  showFontSelector = true,
  className = ""
}: { 
  style: TextStyle, 
  onChange: (newStyle: TextStyle) => void,
  onClose: () => void,
  showFontSelector?: boolean,
  className?: string
}) => {
  return (
    <div 
      className={`bg-white border border-neutral-200 rounded-xl p-2 flex items-center gap-4 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 print:hidden ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">Color</span>
        <input 
          type="color" 
          value={style.color} 
          onChange={(e) => onChange({ ...style, color: e.target.value })}
          className="w-7 h-7 rounded-lg cursor-pointer border border-neutral-200 p-0.5 bg-white"
        />
      </div>
      
      {showFontSelector && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">Font</span>
          <CustomSelect 
            value={style.fontFamily || '"Inter", sans-serif'}
            onChange={(val) => onChange({ ...style, fontFamily: val })}
            options={WEB_SAFE_FONTS.map(font => ({
              label: font.name,
              value: font.value,
              style: { fontFamily: font.value }
            }))}
          />
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">Size</span>
        <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-lg p-0.5">
          <button 
            onClick={() => onChange({ ...style, fontSize: Math.max(6, style.fontSize - 1) })}
            className="w-6 h-6 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md text-[10px] font-bold transition-all"
          >-</button>
          <span className="px-2 text-[10px] font-mono w-7 text-center font-bold">{style.fontSize}</span>
          <button 
            onClick={() => onChange({ ...style, fontSize: Math.min(100, style.fontSize + 1) })}
            className="w-6 h-6 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-md text-[10px] font-bold transition-all"
          >+</button>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">Format</span>
        <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-0.5">
          <button 
            onClick={() => onChange({ ...style, bold: !style.bold })}
            className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-bold transition-all ${style.bold ? 'bg-neutral-900 text-white shadow-md' : 'hover:bg-white hover:shadow-sm'}`}
            title="Bold"
          >B</button>
          <button 
            onClick={() => onChange({ ...style, italic: !style.italic })}
            className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] italic transition-all ${style.italic ? 'bg-neutral-900 text-white shadow-md' : 'hover:bg-white hover:shadow-sm'}`}
            title="Italic"
          >I</button>
          <button 
            onClick={() => onChange({ ...style, underline: !style.underline })}
            className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] underline transition-all ${style.underline ? 'bg-neutral-900 text-white shadow-md' : 'hover:bg-white hover:shadow-sm'}`}
            title="Underline"
          >U</button>
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider">Align</span>
        <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg p-0.5">
          <button 
            onClick={() => onChange({ ...style, align: 'left' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${style.align === 'left' ? 'bg-neutral-900 text-white shadow-md' : 'hover:bg-white hover:shadow-sm'}`}
            title="Align Left"
          ><AlignLeft size={12} /></button>
          <button 
            onClick={() => onChange({ ...style, align: 'center' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${style.align === 'center' ? 'bg-neutral-900 text-white shadow-md' : 'hover:bg-white hover:shadow-sm'}`}
            title="Align Center"
          ><AlignCenter size={12} /></button>
          <button 
            onClick={() => onChange({ ...style, align: 'right' })}
            className={`w-6 h-6 flex items-center justify-center rounded-md transition-all ${style.align === 'right' ? 'bg-neutral-900 text-white shadow-md' : 'hover:bg-white hover:shadow-sm'}`}
            title="Align Right"
          ><AlignRight size={12} /></button>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 ml-2">
        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-wider opacity-0">Close</span>
        <button 
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-red-50 hover:text-red-600 transition-all"
          title="Close Toolbar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

const LaunchGuide = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-8 relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-blue-50 rounded-full opacity-50 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-48 h-48 bg-yellow-50 rounded-full opacity-50 blur-3xl"></div>

        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <h3 className="text-3xl font-black text-[#124e8f] flex items-center gap-3">
              <Rocket className="text-[#f6c344] animate-bounce" size={32} /> 
              Launch to the World
            </h3>
            <p className="text-neutral-500 mt-1 font-medium">Follow these steps to deploy your professional pricelist builder.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X size={24} className="text-neutral-400" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8 relative z-10">
          <div className="space-y-6">
            <Step 
              number="01" 
              title="Export Your Code" 
              description="Download your project as a ZIP file. This contains all the files needed for your website."
              icon={<Download className="text-blue-500" size={20} />}
            />
            <Step 
              number="02" 
              title="Push to GitHub" 
              description="Create a repository on GitHub and upload your files. This is where your code lives."
              icon={<Upload className="text-purple-500" size={20} />}
            />
            <Step 
              number="03" 
              title="Connect to Vercel" 
              description="Import your GitHub repository into Vercel. It will automatically build your app."
              icon={<Rocket className="text-orange-500" size={20} />}
            />
            <Step 
              number="04" 
              title="Go Live!" 
              description="Vercel gives you a public URL. Your pricelist builder is now ready for your team!"
              icon={<ImageIcon className="text-green-500" size={20} />}
            />
            <Step 
              number="05" 
              title="Get Android APK" 
              description="Go to pwabuilder.com, paste your Vercel URL, and download your Android APK!"
              icon={<Download className="text-blue-500" size={20} />}
            />
          </div>

          <div className="bg-neutral-50 rounded-2xl p-6 flex flex-col items-center justify-center border border-neutral-100">
            <AnimatedIllustration />
            <div className="mt-8 w-full space-y-3">
              <h4 className="font-bold text-neutral-800 text-sm uppercase tracking-wider">Pro Tips for Success:</h4>
              <ul className="space-y-2 text-xs text-neutral-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f6c344] mt-1 shrink-0"></div>
                  <span><strong>Automatic Updates:</strong> Every time you push code to GitHub, Vercel updates your site automatically.</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f6c344] mt-1 shrink-0"></div>
                  <span><strong>PWA Ready:</strong> Your app is a Progressive Web App. Users can install it directly from the browser!</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f6c344] mt-1 shrink-0"></div>
                  <span><strong>Custom Domains:</strong> You can connect your own domain (e.g., pricelist.yourcompany.com) in Vercel settings.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex justify-end relative z-10">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-[#124e8f] text-white font-black rounded-xl shadow-lg shadow-blue-200 hover:bg-[#0d3a6b] transition-all active:scale-95"
          >
            LET'S GET STARTED!
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Step = ({ number, title, description, icon }: { number: string, title: string, description: string, icon: React.ReactNode }) => (
  <motion.div 
    whileHover={{ x: 5 }}
    className="flex gap-4 p-3 rounded-xl hover:bg-neutral-50 transition-colors"
  >
    <div className="flex flex-col items-center">
      <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-neutral-100 flex items-center justify-center text-[10px] font-black text-[#124e8f]">
        {number}
      </div>
      <div className="flex-1 w-px bg-neutral-100 my-2"></div>
    </div>
    <div>
      <h4 className="font-bold text-neutral-900 flex items-center gap-2">
        {icon} {title}
      </h4>
      <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

const AnimatedIllustration = () => (
  <div className="relative w-48 h-48">
    <motion.div 
      animate={{ 
        y: [0, -10, 0],
        rotate: [0, 2, -2, 0]
      }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <div className="w-32 h-40 bg-white rounded-xl shadow-2xl border border-neutral-100 p-4 flex flex-col gap-3">
        <div className="w-full h-4 bg-blue-100 rounded"></div>
        <div className="w-3/4 h-3 bg-neutral-100 rounded"></div>
        <div className="w-full h-20 bg-neutral-50 rounded-lg border border-dashed border-neutral-200 flex items-center justify-center">
          <ImageIcon className="text-neutral-300" size={24} />
        </div>
        <div className="mt-auto flex justify-between items-center">
          <div className="w-12 h-4 bg-[#f6c344] rounded"></div>
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <Download size={12} className="text-white" />
          </div>
        </div>
      </div>
    </motion.div>

    <motion.div
      animate={{ 
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.6, 0.3]
      }}
      transition={{ duration: 2, repeat: Infinity }}
      className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-8 bg-blue-400/20 blur-xl rounded-full"
    ></motion.div>
    
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 100, opacity: [0, 1, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      className="absolute top-1/4 left-0"
    >
      <div className="w-8 h-1 bg-blue-200 rounded-full"></div>
    </motion.div>
  </div>
);

export default function App() {
  const [header, setHeader] = useState('PRICE LIST');
  const [headerStyle, setHeaderStyle] = useState<TextStyle>({ ...DEFAULT_STYLE, fontSize: 30, bold: true, color: '#124e8f' });
  const [subHeader, setSubHeader] = useState('FALCO PRICELIST JANUARY 2026');
  const [subHeaderStyle, setSubHeaderStyle] = useState<TextStyle>({ ...DEFAULT_STYLE, fontSize: 14, bold: true, color: '#124e8f' });
  const [date, setDate] = useState('JANUARY 2026');
  const [dateStyle, setDateStyle] = useState<TextStyle>({ ...DEFAULT_STYLE, fontSize: 14, bold: true, color: '#ffffff' });
  const [brand, setBrand] = useState('FALCO');
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const loadHandle = async () => {
      try {
        const savedHandle = await get('pricelist-root-folder');
        if (savedHandle) {
          setRootHandle(savedHandle);
        }
      } catch (err) {
        console.error('Failed to load saved folder handle:', err);
      }
    };
    loadHandle();

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function verifyPermission(handle: FileSystemHandle, readWrite: boolean) {
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    try {
      if ((await (handle as any).queryPermission(options)) === 'granted') {
        return true;
      }
      if ((await (handle as any).requestPermission(options)) === 'granted') {
        return true;
      }
    } catch (err) {
      console.error('Error verifying permission:', err);
    }
    return false;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const [activeStyleField, setActiveStyleField] = useState<{ id: string, field: string } | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [items, setItems] = useState<PricelistItem[]>([
    { 
      id: '1', sku: '', description: '45CM', normalPrice: '', promoPrice: '', isCategory: true, image: null,
      styles: { sku: DEFAULT_STYLE, description: CATEGORY_STYLE, normalPrice: DEFAULT_STYLE, promoPrice: DEFAULT_STYLE }
    },
    { 
      id: '2', sku: 'FAL-45-SQS', description: 'FALCO EXTRACTOR 45CM SQ WALL MOUNTED S/S', normalPrice: '5,500', promoPrice: '5,000', isCategory: false, image: null,
      styles: { sku: DEFAULT_STYLE, description: DEFAULT_STYLE, normalPrice: DEFAULT_STYLE, promoPrice: DEFAULT_STYLE }
    },
  ]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'with-images' | 'without-images' | 'without-image-promo'>('with-images');
  const [showLaunchGuide, setShowLaunchGuide] = useState(false);
  const [showGridLines, setShowGridLines] = useState(false);
  const [headerImage, setHeaderImage] = useState<string | null>(null);

  const [footerText, setFooterText] = useState('Modern Living - Quality Extractors & Appliances');
  const [footerStyle, setFooterStyle] = useState<TextStyle>({ ...DEFAULT_STYLE, fontSize: 10, color: '#94a3b8' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(['img', 'sku', 'description', 'normal', 'promo']);
  const [bulkEditValues, setBulkEditValues] = useState({ 
    sku: '', 
    description: '', 
    normalPrice: '', 
    promoPrice: '',
    applyStyle: false,
    styleTarget: 'all',
    style: { ...DEFAULT_STYLE }
  });
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [columnWidths, setColumnWidths] = useState({
    select: 32,
    img: 64,
    sku: 120,
    description: 300,
    normal: 100,
    promo: 100
  });
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  const previewRef = useRef<HTMLDivElement>(null);

  const handleColumnResize = (col: keyof typeof columnWidths, delta: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [col]: Math.max(20, prev[col] + delta)
    }));
  };

  const handleRowResize = (id: string, delta: number) => {
    setRowHeights(prev => ({
      ...prev,
      [id]: Math.max(30, (prev[id] || 0) + delta)
    }));
  };

  const getGridTemplate = (isHeader: boolean = false) => {
    const widths = [];
    if (!isExporting) {
      widths.push('32px'); // Actions/Handle column
      widths.push(`${columnWidths.select}px`);
    }
    
    columnOrder.forEach(col => {
      if (col === 'img' && viewMode === 'with-images') widths.push(`${columnWidths.img}px`);
      if (col === 'sku') widths.push(`${columnWidths.sku}px`);
      if (col === 'description') widths.push(`minmax(${columnWidths.description}px, 1fr)`);
      if (col === 'normal') widths.push(`${columnWidths.normal}px`);
      if (col === 'promo' && viewMode !== 'without-image-promo') widths.push(`${columnWidths.promo}px`);
    });
    
    return widths.join(' ');
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.filter(i => !i.isCategory).length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.filter(i => !i.isCategory).map(i => i.id)));
    }
  };

  const applyBulkChanges = () => {
    setItems(items.map(item => {
      if (selectedIds.has(item.id)) {
        let newStyles = { ...item.styles };
        
        if (bulkEditValues.applyStyle) {
          if (bulkEditValues.styleTarget === 'all') {
            newStyles = {
              sku: { ...newStyles.sku, ...bulkEditValues.style },
              description: { ...newStyles.description, ...bulkEditValues.style },
              normalPrice: { ...newStyles.normalPrice, ...bulkEditValues.style },
              promoPrice: { ...newStyles.promoPrice, ...bulkEditValues.style },
            };
          } else {
            const field = bulkEditValues.styleTarget as keyof PricelistItem['styles'];
            newStyles[field] = { ...newStyles[field], ...bulkEditValues.style };
          }
        }

        return {
          ...item,
          sku: bulkEditValues.sku || item.sku,
          description: bulkEditValues.description || item.description,
          normalPrice: bulkEditValues.normalPrice || item.normalPrice,
          promoPrice: bulkEditValues.promoPrice || item.promoPrice,
          styles: newStyles
        };
      }
      return item;
    }));
    setSelectedIds(new Set());
    setShowBulkEdit(false);
    setBulkEditValues({ 
      sku: '', description: '', normalPrice: '', promoPrice: '', 
      applyStyle: false, styleTarget: 'all', style: { ...DEFAULT_STYLE } 
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHeaderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addItem = (isCategory: boolean = false) => {
    const newItem: PricelistItem = {
      id: Math.random().toString(36).substr(2, 9),
      sku: '',
      description: isCategory ? 'NEW CATEGORY' : '',
      normalPrice: '',
      promoPrice: '',
      isCategory,
      image: null,
      styles: {
        sku: DEFAULT_STYLE,
        description: isCategory ? CATEGORY_STYLE : DEFAULT_STYLE,
        normalPrice: DEFAULT_STYLE,
        promoPrice: DEFAULT_STYLE,
      }
    };
    setItems([...items, newItem]);
  };

  const updateItemStyle = (id: string, field: string, newStyle: TextStyle) => {
    setItems(items.map(item => item.id === id ? {
      ...item,
      styles: { ...item.styles, [field]: newStyle }
    } : item));
  };

  const handleItemImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateItem(id, 'image', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateItem = (id: string, field: keyof PricelistItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const confirmDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedColumn) {
      const idx = columnOrder.indexOf(selectedColumn);
      if (idx > 0) {
        const newOrder = [...columnOrder];
        [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
        setColumnOrder(newOrder);
      }
    } else if (selectedIds.size > 0) {
      const newItems = [...items];
      // Get selected indices in ascending order
      const indices = Array.from(selectedIds)
        .map(id => newItems.findIndex(item => item.id === id))
        .sort((a, b) => a - b);
      
      // Can only move if the first selected item is not at the top
      if (indices.length > 0 && indices[0] > 0) {
        indices.forEach(idx => {
          [newItems[idx], newItems[idx - 1]] = [newItems[idx - 1], newItems[idx]];
        });
        setItems(newItems);
      }
    }
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedColumn) {
      const idx = columnOrder.indexOf(selectedColumn);
      if (idx >= 0 && idx < columnOrder.length - 1) {
        const newOrder = [...columnOrder];
        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
        setColumnOrder(newOrder);
      }
    } else if (selectedIds.size > 0) {
      const newItems = [...items];
      // Get selected indices in descending order
      const indices = Array.from(selectedIds)
        .map(id => newItems.findIndex(item => item.id === id))
        .sort((a, b) => b - a);
      
      // Can only move if the last selected item is not at the bottom
      if (indices.length > 0 && indices[0] < newItems.length - 1) {
        indices.forEach(idx => {
          [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]];
        });
        setItems(newItems);
      }
    }
  };

  const handleDeleteSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedColumn) {
      if (selectedColumn === 'promo') {
        setViewMode('without-image-promo');
      } else if (selectedColumn === 'img') {
        setViewMode('without-images');
      }
      setSelectedColumn(null);
    } else if (selectedIds.size > 0) {
      setDeleteConfirmId('bulk');
    }
  };

  const deleteItem = () => {
    if (deleteConfirmId === 'bulk') {
      setItems(items.filter(item => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      setDeleteConfirmId(null);
    } else if (deleteConfirmId) {
      setItems(items.filter(item => item.id !== deleteConfirmId));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deleteConfirmId);
        return next;
      });
      setDeleteConfirmId(null);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newItems.length) {
      [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
      setItems(newItems);
    }
  };

  const downloadFile = (blobOrUrl: Blob | string, filename: string) => {
    const a = document.createElement('a');
    a.href = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof blobOrUrl !== 'string') {
      URL.revokeObjectURL(a.href);
    }
  };

  const pages = useMemo(() => {
    const result = [];
    let currentPage = [];
    let currentUnits = 0;
    
    // Exact height calculations based on A4 (1122px) with 24px padding top/bottom
    // Inner height = 1074px
    // Table Header = 34px
    // Footer = 60px
    const footerHeight = 60;
    const tableHeaderHeight = 34;
    
    // Available for rows on other pages = 1074 - 34 - 60 - 1 (border-b) = 979
    const OTHER_PAGE_MAX = 1074 - tableHeaderHeight - footerHeight - 1;
    
    // First page header:
    // Logo section = 140px + 32px (mb-8) = 172px
    // Custom Header Image = 96px (h-24) + 16px (mb-4) = 112px
    const headerImageHeight = headerImage ? 112 : 0;
    const FIRST_PAGE_MAX = OTHER_PAGE_MAX - 172 - headerImageHeight;

    items.forEach((item, index) => {
      const itemWithIndex = { ...item, originalIndex: index };
      const defaultHeight = item.isCategory ? 32 : (viewMode === 'with-images' ? 72 : 36);
      const units = rowHeights[item.id] || defaultHeight;
      const maxUnitsForThisPage = result.length === 0 ? FIRST_PAGE_MAX : OTHER_PAGE_MAX;

      if (currentUnits + units > maxUnitsForThisPage && currentPage.length > 0) {
        result.push(currentPage);
        currentPage = [itemWithIndex];
        currentUnits = units;
      } else {
        currentPage.push(itemWithIndex);
        currentUnits += units;
      }
    });

    if (currentPage.length > 0) {
      result.push(currentPage);
    }

    return result.length > 0 ? result : [[]];
  }, [items, viewMode, headerImage, rowHeights, isExporting]);

  const exportDocument = async (format: 'pdf' | 'jpg') => {
    setIsExporting(true);
    
    // Give state time to update and hide UI elements
    setTimeout(async () => {
      try {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const zip = new JSZip();
        
        for (let i = 0; i < pages.length; i++) {
          const pageEl = document.getElementById(`page-${i}`);
          if (!pageEl) continue;
          
          const dataUrl = await toPng(pageEl, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            style: { transform: 'scale(1)', transformOrigin: 'top left' }
          });
          
          if (format === 'pdf') {
            if (i > 0) pdf.addPage();
            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
          } else {
            if (pages.length === 1) {
              downloadFile(dataUrl, 'pricelist.jpg');
              setIsExporting(false);
              return;
            } else {
              const base64Data = dataUrl.split(',')[1];
              zip.file(`pricelist-page-${i + 1}.jpg`, base64Data, { base64: true });
            }
          }
        }
        
        if (format === 'pdf') {
          pdf.save('pricelist.pdf');
        } else if (format === 'jpg' && pages.length > 1) {
          const content = await zip.generateAsync({ type: 'blob' });
          downloadFile(content, 'pricelist.zip');
        }
      } catch (error) {
        console.error(`Error generating ${format.toUpperCase()}:`, error);
        alert(`There was an error generating the ${format.toUpperCase()}. Please try again.`);
      }
      setIsExporting(false);
    }, 500);
  };

  const handleSaveToLocalFolder = async (forceNewFolder = false) => {
    if (!('showDirectoryPicker' in window)) {
      alert('Your browser does not support the File System Access API. Please use Chrome or Edge.');
      return;
    }
    
    setIsExporting(true);
    
    try {
      let currentHandle = rootHandle;
      
      if (forceNewFolder || !currentHandle) {
        currentHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        setRootHandle(currentHandle);
        await set('pricelist-root-folder', currentHandle);
      } else {
        const hasPermission = await verifyPermission(currentHandle, true);
        if (!hasPermission) {
          currentHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite'
          });
          setRootHandle(currentHandle);
          await set('pricelist-root-folder', currentHandle);
        }
      }

      if (!currentHandle) {
        setIsExporting(false);
        return;
      }
      
      // Parse date
      const [monthStr, yearStr] = date.split(' ');
      const month = monthStr || 'JANUARY';
      const year = yearStr || '2026';
      
      // Create folder structure: Brand / Year / Month
      const brandHandle = await currentHandle.getDirectoryHandle(brand || 'UNBRANDED', { create: true });
      const yearHandle = await brandHandle.getDirectoryHandle(year, { create: true });
      const monthHandle = await yearHandle.getDirectoryHandle(month, { create: true });
      
      // Generate PDF
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (let i = 0; i < pages.length; i++) {
        const pageEl = document.getElementById(`page-${i}`);
        if (!pageEl) continue;
        const dataUrl = await toPng(pageEl, { quality: 1.0, pixelRatio: 2, backgroundColor: '#ffffff' });
        if (i > 0) pdf.addPage();
        const imgProps = pdf.getImageProperties(dataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }
      const pdfBlob = pdf.output('blob');
      const pdfFileHandle = await monthHandle.getFileHandle(`${brand}_${month}_${year}.pdf`, { create: true });
      const pdfWritable = await pdfFileHandle.createWritable();
      await pdfWritable.write(pdfBlob);
      await pdfWritable.close();

      // Save JSON data
      const dataFileHandle = await monthHandle.getFileHandle(`${brand}_${month}_${year}.json`, { create: true });
      const writable = await dataFileHandle.createWritable();
      const data = {
        header, subHeader, date, brand, items, logo, headerImage, footerText,
        headerStyle, subHeaderStyle, dateStyle, footerStyle, viewMode, columnOrder, columnWidths
      };
      await writable.write(JSON.stringify(data, null, 2));
      await writable.close();

      alert(`Pricelist saved successfully to: ${currentHandle.name}/${brand}/${year}/${month}`);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled
      } else {
        console.error('Error saving to local folder:', error);
        alert('Error saving to local folder. Please make sure you have granted permission.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleLoadPricelist = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.header) setHeader(data.header);
        if (data.subHeader) setSubHeader(data.subHeader);
        if (data.date) setDate(data.date);
        if (data.brand) setBrand(data.brand);
        if (data.items) setItems(data.items);
        if (data.logo) setLogo(data.logo);
        if (data.headerImage) setHeaderImage(data.headerImage);
        if (data.footerText) setFooterText(data.footerText);
        if (data.headerStyle) setHeaderStyle(data.headerStyle);
        if (data.subHeaderStyle) setSubHeaderStyle(data.subHeaderStyle);
        if (data.dateStyle) setDateStyle(data.dateStyle);
        if (data.footerStyle) setFooterStyle(data.footerStyle);
        if (data.viewMode) setViewMode(data.viewMode);
        if (data.columnOrder) setColumnOrder(data.columnOrder);
        if (data.columnWidths) setColumnWidths(data.columnWidths);
        alert('Pricelist loaded successfully!');
      } catch (error) {
        console.error('Error loading pricelist:', error);
        alert('Error loading pricelist. Please make sure it is a valid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const getActiveStyleContext = () => {
    if (!activeStyleField) return null;
    
    if (activeStyleField.id === 'header') {
      return { style: headerStyle, onChange: setHeaderStyle, showFontSelector: true };
    }
    if (activeStyleField.id === 'subheader') {
      return { style: subHeaderStyle, onChange: setSubHeaderStyle, showFontSelector: true };
    }
    if (activeStyleField.id === 'date') {
      return { style: dateStyle, onChange: setDateStyle, showFontSelector: true };
    }
    if (activeStyleField.id === 'footer') {
      return { style: footerStyle, onChange: setFooterStyle, showFontSelector: true };
    }
    
    const item = items.find(i => i.id === activeStyleField.id);
    if (item) {
      const field = activeStyleField.field as keyof PricelistItem['styles'];
      return {
        style: item.styles[field],
        onChange: (s: TextStyle) => updateItemStyle(item.id, field, s),
        showFontSelector: true
      };
    }
    
    return null;
  };

  const activeContext = getActiveStyleContext();

  return (
    <div 
      className="min-h-screen bg-neutral-100 flex flex-col font-sans text-neutral-900 overflow-x-clip print:bg-white bg-cover bg-center bg-fixed"
      style={{ backgroundImage: 'url("https://i.ibb.co/spWLBSV5/Whats-App-Image-2026-03-31-at-09-28-00.jpg")' }}
      onClick={() => { setActiveStyleField(null); setSelectedIds(new Set()); setSelectedColumn(null); }}
    >
      {/* Top Bar */}
      <div className="sticky top-0 w-full bg-white/90 backdrop-blur-md border-b border-neutral-200 z-40 shadow-sm print:hidden">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://i.ibb.co/LDj74m2t/maskable-icon-1.png" 
              alt="App Logo" 
              className="w-10 h-10 rounded-xl shadow-sm border border-neutral-200 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="hidden sm:flex flex-col justify-center">
              <h1 className="text-base font-black tracking-tight text-[#124e8f] leading-none">PriceList</h1>
              <span className="text-[10px] font-bold text-[#f6c344] uppercase tracking-widest mt-0.5">Editor</span>
            </div>
            {isInstallable && (
              <button 
                onClick={handleInstallClick}
                className="text-[10px] font-bold uppercase tracking-wider bg-green-500/10 hover:bg-green-500/20 text-green-600 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ml-4 border border-green-500/20"
                title="Install App to your device"
              >
                <Download size={12} /> Install App
              </button>
            )}
            <button 
              onClick={() => setShowLaunchGuide(true)}
              className="text-[10px] font-bold uppercase tracking-wider bg-[#124e8f]/10 hover:bg-[#124e8f]/20 text-[#124e8f] px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ml-2 border border-[#124e8f]/20"
              title="How to launch on Vercel"
            >
              <Rocket size={12} /> Launch Guide
            </button>
            <button 
              onClick={() => setShowGridLines(!showGridLines)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ml-2 border ${showGridLines ? 'bg-[#124e8f] text-white border-[#124e8f]' : 'bg-[#124e8f]/10 hover:bg-[#124e8f]/20 text-[#124e8f] border-[#124e8f]/20'}`}
              title="Toggle alignment grid lines"
            >
              <Grid size={12} /> {showGridLines ? 'Hide Grid' : 'Show Grid'}
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center bg-[#124e8f]/5 p-1 rounded-md border border-[#124e8f]/10 mr-2">
              <button
                onClick={() => setViewMode('with-images')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${viewMode === 'with-images' ? 'bg-[#124e8f] text-white shadow-sm' : 'text-[#124e8f]/70 hover:text-[#124e8f]'}`}
                title="Include Images: Show product photos in the PDF"
              >
                With Images
              </button>
              <button
                onClick={() => setViewMode('without-images')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${viewMode === 'without-images' ? 'bg-[#124e8f] text-white shadow-sm' : 'text-[#124e8f]/70 hover:text-[#124e8f]'}`}
                title="Without Images: Compact layout without photos"
              >
                Without Images
              </button>
              <button
                onClick={() => setViewMode('without-image-promo')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${viewMode === 'without-image-promo' ? 'bg-[#124e8f] text-white shadow-sm' : 'text-[#124e8f]/70 hover:text-[#124e8f]'}`}
                title="Without Image & Promo: Minimal layout"
              >
                Without Image & Promo
              </button>
            </div>

            {/* Selection Actions */}
            {(selectedIds.size > 0 || selectedColumn) && (
              <div className="flex items-center gap-1 bg-[#124e8f]/5 px-2 py-1 rounded-lg border border-[#124e8f]/20 mr-2 animate-in fade-in zoom-in duration-200">
                <div className="text-[9px] font-black text-[#124e8f] uppercase tracking-widest px-2 border-r border-[#124e8f]/20 mr-1">
                  {selectedColumn ? `COL: ${selectedColumn}` : `${selectedIds.size} SELECTED`}
                </div>
                <button 
                  onClick={handleMoveUp}
                  className="p-1.5 hover:bg-white rounded text-[#124e8f] transition-colors"
                  title="Move Up"
                >
                  <ChevronUp size={16} />
                </button>
                <button 
                  onClick={handleMoveDown}
                  className="p-1.5 hover:bg-white rounded text-[#124e8f] transition-colors"
                  title="Move Down"
                >
                  <ChevronDown size={16} />
                </button>
                <button 
                  onClick={handleDeleteSelection}
                  className="p-1.5 hover:bg-white rounded text-red-600 transition-colors"
                  title="Delete Selection"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set()); setSelectedColumn(null); }}
                  className="p-1.5 hover:bg-white rounded text-neutral-400 transition-colors ml-1"
                  title="Clear Selection"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <button
              onClick={() => addItem(true)}
              className="text-xs bg-[#124e8f]/5 hover:bg-[#124e8f]/10 text-[#124e8f] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 font-semibold"
            >
              <Plus size={14} /> Category
            </button>
            <button
              onClick={() => addItem(false)}
              className="text-xs bg-[#124e8f]/5 hover:bg-[#124e8f]/10 text-[#124e8f] px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 font-semibold"
            >
              <Plus size={14} /> Item
            </button>
            <div className="w-px h-4 bg-neutral-200 mx-1"></div>
            <button
              onClick={() => exportDocument('pdf')}
              className="text-xs bg-[#124e8f] hover:bg-[#0d3a6b] text-white px-4 py-1.5 rounded-md transition-all flex items-center gap-1.5 font-bold shadow-sm active:scale-95"
            >
              <Download size={14} /> PDF
            </button>
            <button
              onClick={() => exportDocument('jpg')}
              className="text-xs bg-[#f6c344] hover:bg-[#e5b233] text-[#124e8f] px-4 py-1.5 rounded-md transition-all flex items-center gap-1.5 font-bold shadow-sm active:scale-95"
            >
              <Download size={14} /> JPG
            </button>
            <div className="flex items-center">
              <button
                onClick={() => handleSaveToLocalFolder(false)}
                className={`text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 ${rootHandle ? 'rounded-l-md border-r border-emerald-500/30' : 'rounded-md'} transition-all flex items-center gap-1.5 font-bold shadow-sm active:scale-95`}
                title={rootHandle ? `Save to ${rootHandle.name}` : "Save to local folder (Brand/Year/Month)"}
              >
                <Folder size={14} /> {rootHandle ? rootHandle.name : 'Save to Folder'}
              </button>
              {rootHandle && (
                <button
                  onClick={() => handleSaveToLocalFolder(true)}
                  className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1.5 rounded-r-md transition-all flex items-center justify-center font-bold shadow-sm active:scale-95"
                  title="Change Folder"
                >
                  <Settings size={12} />
                </button>
              )}
            </div>
            <label
              className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-1.5 rounded-md transition-all flex items-center gap-1.5 font-bold shadow-sm active:scale-95 cursor-pointer"
              title="Load pricelist from JSON file"
            >
              <Upload size={14} /> Load
              <input type="file" className="hidden" onChange={handleLoadPricelist} accept=".json" />
            </label>
          </div>
        </div>

        {activeContext && (
          <div className="px-6 py-2 border-t border-neutral-100 bg-[#f8fafc] flex items-center justify-center animate-in slide-in-from-top-2 duration-300">
            <StyleToolbar 
              style={activeContext.style} 
              onChange={activeContext.onChange} 
              onClose={() => setActiveStyleField(null)} 
              showFontSelector={activeContext.showFontSelector}
              className="border-none bg-transparent p-0 shadow-none"
            />
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Confirm Deletion</h3>
            <p className="text-neutral-600 mb-6 text-sm">Are you sure you want to delete this item? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={deleteItem}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-lg shadow-red-200"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vercel Launch Guide Modal */}
      <AnimatePresence>
        {showLaunchGuide && (
          <LaunchGuide onClose={() => setShowLaunchGuide(false)} />
        )}
      </AnimatePresence>

      {/* Bulk Edit Toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && !isExporting && (
          <motion.div 
            initial={{ y: 100, x: '-50%' }}
            animate={{ y: 0, x: '-50%' }}
            exit={{ y: 100, x: '-50%' }}
            className="fixed bottom-6 left-1/2 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-neutral-200 rounded-2xl p-5 flex flex-col gap-4 z-50 w-full max-w-4xl"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="bg-[#124e8f] text-white px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                  <CheckSquare size={12} /> {selectedIds.size} SELECTED
                </div>
                <h3 className="text-sm font-black text-neutral-800 uppercase tracking-tight">Bulk Edit Items</h3>
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="p-1.5 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 transition-colors"><X size={18} /></button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">New SKU</label>
                <input 
                  type="text" 
                  value={bulkEditValues.sku} 
                  onChange={(e) => setBulkEditValues({...bulkEditValues, sku: e.target.value.toUpperCase()})}
                  placeholder="Leave blank to keep original..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs focus:ring-4 focus:ring-[#124e8f]/5 focus:border-[#124e8f] outline-none transition-all placeholder:text-neutral-300 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">New Description</label>
                <input 
                  type="text" 
                  value={bulkEditValues.description} 
                  onChange={(e) => setBulkEditValues({...bulkEditValues, description: e.target.value.toUpperCase()})}
                  placeholder="Leave blank to keep original..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs focus:ring-4 focus:ring-[#124e8f]/5 focus:border-[#124e8f] outline-none transition-all placeholder:text-neutral-300 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">New Normal Price</label>
                <input 
                  type="text" 
                  value={bulkEditValues.normalPrice} 
                  onChange={(e) => setBulkEditValues({...bulkEditValues, normalPrice: e.target.value.toUpperCase()})}
                  placeholder="Leave blank to keep original..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs focus:ring-4 focus:ring-[#124e8f]/5 focus:border-[#124e8f] outline-none transition-all placeholder:text-neutral-300 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">New Promo Price</label>
                <input 
                  type="text" 
                  value={bulkEditValues.promoPrice} 
                  onChange={(e) => setBulkEditValues({...bulkEditValues, promoPrice: e.target.value.toUpperCase()})}
                  placeholder="Leave blank to keep original..."
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs focus:ring-4 focus:ring-[#124e8f]/5 focus:border-[#124e8f] outline-none transition-all placeholder:text-neutral-300 uppercase"
                />
              </div>
            </div>
            
            <div className="border-t border-neutral-100 pt-3">
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-xs font-bold text-neutral-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={bulkEditValues.applyStyle}
                    onChange={(e) => setBulkEditValues({...bulkEditValues, applyStyle: e.target.checked})}
                    className="rounded text-[#124e8f] focus:ring-[#124e8f]"
                  />
                  Apply Style Changes
                </label>
                {bulkEditValues.applyStyle && (
                  <CustomSelect
                    value={bulkEditValues.styleTarget}
                    onChange={(val) => setBulkEditValues({...bulkEditValues, styleTarget: val})}
                    options={[
                      { label: "All Fields", value: "all" },
                      { label: "SKU Only", value: "sku" },
                      { label: "Description Only", value: "description" },
                      { label: "Normal Price Only", value: "normalPrice" },
                      { label: "Promo Price Only", value: "promoPrice" }
                    ]}
                  />
                )}
              </div>
              
              {bulkEditValues.applyStyle && (
                <StyleToolbar 
                  style={bulkEditValues.style} 
                  onChange={(style) => setBulkEditValues({...bulkEditValues, style})} 
                  onClose={() => setBulkEditValues({...bulkEditValues, applyStyle: false})} 
                  className="border-none bg-neutral-50 shadow-inner p-3"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="px-5 py-2.5 text-xs font-bold text-neutral-500 hover:bg-neutral-50 rounded-xl transition-colors"
              >
                CLEAR SELECTION
              </button>
              <button 
                onClick={applyBulkChanges}
                className="px-8 py-2.5 text-xs font-black text-white bg-[#124e8f] hover:bg-[#0d3a6b] rounded-xl transition-all shadow-xl shadow-blue-100 active:scale-95 flex items-center gap-2"
              >
                <Check size={14} /> APPLY BULK CHANGES
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exporting Overlay */}
      {isExporting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Generating Document</h2>
          <p className="text-white/80">Please wait while we process your pages...</p>
        </div>
      )}

      {/* Main Sheet Container */}
      <div className="flex-1 p-4 sm:p-8 lg:p-12 sm:px-24 overflow-visible flex flex-col items-center gap-8 print:p-0">
        {pages.map((pageItems, pageIndex) => (
          <div 
            key={pageIndex}
            id={`page-${pageIndex}`}
            className="bg-[#ffffff] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] w-[794px] h-[1122px] p-6 flex flex-col relative group/sheet print:shadow-none print:max-w-none print:w-full print:h-auto print:min-h-0 print:p-0 shrink-0"
            style={{ fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif" }}
          >
            {/* Grid Lines Overlay */}
            {showGridLines && !isExporting && (
              <div className="absolute inset-0 pointer-events-none z-0 opacity-10" style={{ 
                backgroundImage: 'linear-gradient(#124e8f 1px, transparent 1px), linear-gradient(90deg, #124e8f 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}></div>
            )}

            {/* Custom Header Image */}
            {pageIndex === 0 && (
              <>
                {headerImage && (
                  <div className="relative group/header-img mb-4">
                    <img src={headerImage} alt="Header" className="w-full h-24 object-cover rounded-lg shadow-sm" referrerPolicy="no-referrer" />
                    {!isExporting && (
                      <button onClick={() => setHeaderImage(null)} className="absolute top-2 right-2 p-1.5 bg-white/80 hover:bg-white rounded-full text-red-500 shadow-sm opacity-0 group-hover/header-img:opacity-100 transition-opacity">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                )}
                {!headerImage && !isExporting && (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/sheet:opacity-100 transition-opacity">
                    <label className="cursor-pointer bg-white shadow-md border border-[#e2e8f0] rounded-full px-4 py-2 text-xs font-bold text-[#124e8f] flex items-center gap-2 hover:bg-[#f1f5f9] transition-colors">
                      <ImageIcon size={14} /> Add Header Image
                      <input type="file" className="hidden" onChange={handleHeaderImageUpload} accept="image/*" />
                    </label>
                  </div>
                )}
              </>
            )}

            {/* PDF Header */}
            {pageIndex === 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8 h-[140px]">
                <div className="space-y-4 w-full sm:w-auto">
                  <div className="relative group/logo w-fit">
                    {logo ? (
                      <img src={logo} alt="Brand Logo" className="h-12 sm:h-16 object-contain mx-auto sm:mx-0 drop-shadow-md" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-16 w-32 bg-[#f1f5f9] rounded flex items-center justify-center text-[#94a3b8] text-xs italic mx-auto sm:mx-0 border-2 border-dashed border-[#e2e8f0]">
                        Logo
                      </div>
                    )}
                    {!isExporting && (
                      <div className="absolute inset-0 bg-[#000000]/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded">
                        <label className="cursor-pointer p-2 hover:bg-white/20 rounded transition-colors" title="Upload Logo">
                          <Upload size={16} className="text-[#ffffff]" />
                          <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                        </label>
                        {logo && (
                          <button onClick={() => setLogo(null)} className="p-2 hover:bg-white/20 rounded transition-colors text-red-400 hover:text-red-300" title="Remove Logo">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-center sm:text-left">
                    <div className="relative group/field" onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: 'header', field: 'header' }); }}>
                      <input
                        type="text"
                        value={header}
                        onChange={(e) => setHeader(e.target.value)}
                        className={`w-full bg-transparent border-none focus:outline-none p-0 transition-colors ${!isExporting ? 'hover:bg-[#124e8f]/5 cursor-text' : ''}`}
                        style={{
                          color: headerStyle.color,
                          fontSize: `${headerStyle.fontSize}px`,
                          fontWeight: headerStyle.bold ? '900' : 'normal',
                          fontStyle: headerStyle.italic ? 'italic' : 'normal',
                          textDecoration: headerStyle.underline ? 'underline' : 'none',
                          fontFamily: headerStyle.fontFamily || 'inherit',
                          textAlign: headerStyle.align || 'left',
                        }}
                        placeholder="PRICE LIST"
                      />
                    </div>

                    <div className="relative group/field" onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: 'subheader', field: 'subheader' }); }}>
                      <input
                        type="text"
                        value={subHeader}
                        onChange={(e) => setSubHeader(e.target.value)}
                        className={`w-full bg-transparent border-none focus:outline-none p-0 transition-colors ${!isExporting ? 'hover:bg-[#124e8f]/5 cursor-text' : ''}`}
                        style={{
                          color: subHeaderStyle.color,
                          fontSize: `${subHeaderStyle.fontSize}px`,
                          fontWeight: subHeaderStyle.bold ? '900' : 'normal',
                          fontStyle: subHeaderStyle.italic ? 'italic' : 'normal',
                          textDecoration: subHeaderStyle.underline ? 'underline' : 'none',
                          fontFamily: subHeaderStyle.fontFamily || 'inherit',
                          textAlign: subHeaderStyle.align || 'left',
                        }}
                        placeholder="SUBHEADER"
                      />
                    </div>
                    {!isExporting && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Brand:</span>
                        <input
                          type="text"
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                          className="text-[10px] font-bold text-[#124e8f] bg-white border border-neutral-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-[#124e8f]/50"
                          placeholder="BRAND NAME"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="w-full sm:w-auto">
                  <div className="relative group/field" onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: 'date', field: 'date' }); }}>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={`px-6 py-2 w-full text-center border-none focus:outline-none transition-colors ${!isExporting ? 'hover:opacity-80 cursor-text' : ''}`}
                      style={{
                        backgroundColor: activeStyleField?.id === 'date' ? '#1e293b' : '#0f172a',
                        color: dateStyle.color,
                        fontSize: `${dateStyle.fontSize}px`,
                        fontWeight: dateStyle.bold ? '900' : 'normal',
                        fontStyle: dateStyle.italic ? 'italic' : 'normal',
                        textDecoration: dateStyle.underline ? 'underline' : 'none',
                        fontFamily: dateStyle.fontFamily || 'inherit',
                        textAlign: dateStyle.align || 'center',
                      }}
                      placeholder="DATE"
                    />
                  </div>
                </div>
              </div>
            )}

          {/* Table Header */}
          <div 
            className="hidden sm:grid bg-[#124e8f] text-[#ffffff] text-[11px] font-bold uppercase tracking-wider border-x border-t border-[#124e8f] h-[34px] sticky top-[65px] z-20 shadow-sm print:shadow-none print:relative print:top-auto"
            style={{ gridTemplateColumns: getGridTemplate(true) }}
            onClick={(e) => { e.stopPropagation(); setSelectedColumn(null); }}
          >
            {!isExporting && (
              <>
                <div className="py-2 px-1 border-r border-[#ffffff]/20 flex items-center justify-center">
                  <Settings size={14} className="opacity-40" />
                </div>
                <div className="py-2 px-1 border-r border-[#ffffff]/20 flex items-center justify-center relative group">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                    className="text-[#ffffff]/60 hover:text-[#ffffff] transition-colors"
                    title="Select All"
                  >
                    {selectedIds.size === items.filter(i => !i.isCategory).length && selectedIds.size > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <ColumnResizer 
                    onResize={(d) => handleColumnResize('select', d)} 
                    width={columnWidths['select']}
                    onWidthChange={(w) => setColumnWidths(prev => ({ ...prev, select: w }))}
                  />
                </div>
              </>
            )}
            {columnOrder.map(col => {
              if (col === 'img' && viewMode === 'with-images') return (
                <div 
                  key="img"
                  className={`py-2 px-1 border-r border-[#ffffff]/20 text-center relative group cursor-pointer transition-colors ${selectedColumn === 'img' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedColumn('img'); setSelectedIds(new Set()); }}
                >
                  IMG
                  <ColumnResizer 
                    onResize={(d) => handleColumnResize('img', d)} 
                    width={columnWidths['img']}
                    onWidthChange={(w) => setColumnWidths(prev => ({ ...prev, img: w }))}
                  />
                </div>
              );
              if (col === 'sku') return (
                <div 
                  key="sku"
                  className={`py-2 px-4 border-r border-[#ffffff]/20 relative group cursor-pointer transition-colors ${selectedColumn === 'sku' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedColumn('sku'); setSelectedIds(new Set()); }}
                >
                  SKU
                  <ColumnResizer 
                    onResize={(d) => handleColumnResize('sku', d)} 
                    width={columnWidths['sku']}
                    onWidthChange={(w) => setColumnWidths(prev => ({ ...prev, sku: w }))}
                  />
                </div>
              );
              if (col === 'description') return (
                <div 
                  key="description"
                  className={`py-2 px-4 border-r border-[#ffffff]/20 relative group cursor-pointer transition-colors ${selectedColumn === 'description' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedColumn('description'); setSelectedIds(new Set()); }}
                >
                  DESCRIPTION
                  <ColumnResizer 
                    onResize={(d) => handleColumnResize('description', d)} 
                    width={columnWidths['description']}
                    onWidthChange={(w) => setColumnWidths(prev => ({ ...prev, description: w }))}
                  />
                </div>
              );
              if (col === 'normal') return (
                <div 
                  key="normal"
                  className={`py-2 px-4 ${viewMode !== 'without-image-promo' ? 'border-r border-[#ffffff]/20' : ''} text-right relative group cursor-pointer transition-colors ${selectedColumn === 'normal' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedColumn('normal'); setSelectedIds(new Set()); }}
                >
                  NORMAL
                  <ColumnResizer 
                    onResize={(d) => handleColumnResize('normal', d)} 
                    width={columnWidths['normal']}
                    onWidthChange={(w) => setColumnWidths(prev => ({ ...prev, normal: w }))}
                  />
                </div>
              );
              if (col === 'promo' && viewMode !== 'without-image-promo') return (
                <div 
                  key="promo"
                  className={`py-2 px-4 text-right relative group cursor-pointer transition-colors ${selectedColumn === 'promo' ? 'bg-white/20' : 'hover:bg-white/10'}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedColumn('promo'); setSelectedIds(new Set()); }}
                >
                  PROMO
                  <ColumnResizer 
                    onResize={(d) => handleColumnResize('promo', d)} 
                    width={columnWidths['promo']}
                    onWidthChange={(w) => setColumnWidths(prev => ({ ...prev, promo: w }))}
                  />
                </div>
              );
              return null;
            })}
          </div>

          {/* Table Body */}
          <div className="flex-1 border-x border-b border-[#e2e8f0] flex flex-col min-h-0 overflow-hidden">
            {pageItems.map((item) => {
              const index = item.originalIndex;
              return (
                <div key={item.id} className="relative group/row">
                {item.isCategory ? (
                  <div 
                    className="bg-[#124e8f]/10 border-b border-[#e2e8f0] relative group/field flex" 
                    onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: item.id, field: 'description' }); const input = e.currentTarget.querySelector('input, textarea') as HTMLElement; if (input) input.focus(); }}
                    style={{ height: rowHeights[item.id] ? `${rowHeights[item.id]}px` : '32px' }}
                  >
                    {!isExporting && (
                      <div className="w-8 flex items-center justify-center border-r border-[#e2e8f0]/30 shrink-0">
                        <button onClick={() => confirmDelete(item.id)} className="p-1 rounded hover:bg-red-50 text-red-300 hover:text-red-500 transition-colors" title="Delete Category"><Trash2 size={12} /></button>
                      </div>
                    )}
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value.toUpperCase())}
                      className={`w-full bg-transparent py-1 px-4 uppercase border-none focus:outline-none transition-colors ${!isExporting ? 'hover:bg-[#124e8f]/10 cursor-text' : ''}`}
                      style={{
                        color: item.styles.description.color,
                        fontSize: `${item.styles.description.fontSize}px`,
                        fontWeight: item.styles.description.bold ? '900' : 'normal',
                        fontStyle: item.styles.description.italic ? 'italic' : 'normal',
                        textDecoration: item.styles.description.underline ? 'underline' : 'none',
                        fontFamily: item.styles.description.fontFamily || 'inherit',
                        textAlign: item.styles.description.align || 'left',
                      }}
                      placeholder="CATEGORY NAME"
                    />
                    {!isExporting && (
                      <RowResizer 
                        onResize={(d) => handleRowResize(item.id, d)} 
                        height={rowHeights[item.id] || 32}
                        onHeightChange={(h) => setRowHeights(prev => ({ ...prev, [item.id]: h }))}
                      />
                    )}
                  </div>
                ) : (
                  <div 
                    className="grid grid-cols-1 text-[10.5px] border-b border-[#e2e8f0] hover:bg-[#124e8f]/5 transition-colors group/item relative"
                    style={{ 
                      gridTemplateColumns: getGridTemplate(),
                      height: rowHeights[item.id] ? `${rowHeights[item.id]}px` : (viewMode === 'with-images' ? '72px' : '36px')
                    }}
                  >
                    {!isExporting && (
                      <div className="flex flex-col items-center justify-center border-r border-[#e2e8f0] py-0.5 bg-neutral-50/30">
                        <GripVertical size={12} className="text-neutral-300" />
                      </div>
                    )}
                    {!isExporting && (
                      <div className="flex items-center justify-center border-r border-[#e2e8f0] py-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                          className={`transition-colors ${selectedIds.has(item.id) ? 'text-[#124e8f]' : 'text-[#94a3b8] hover:text-[#64748b]'}`}
                        >
                          {selectedIds.has(item.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                        </button>
                      </div>
                    )}
                    {columnOrder.map(col => {
                      if (col === 'img' && viewMode === 'with-images') return (
                        <div key="img" className="flex items-center justify-center border-r border-[#e2e8f0] relative group/item-img py-1">
                          {item.image ? (
                            <img src={item.image} alt="Product" className="w-14 h-14 object-cover rounded" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-14 h-14 bg-[#f1f5f9] rounded flex items-center justify-center text-[#94a3b8]">
                              <ImageIcon size={20} />
                            </div>
                          )}
                          {!isExporting && (
                            <div className="absolute inset-0 bg-[#000000]/40 opacity-0 group-hover/item-img:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded">
                              <label className="cursor-pointer p-1.5 hover:bg-white/20 rounded transition-colors" title="Upload Image">
                                <Upload size={12} className="text-[#ffffff]" />
                                <input type="file" className="hidden" onChange={(e) => handleItemImageUpload(item.id, e)} accept="image/*" />
                              </label>
                              {item.image && (
                                <button onClick={() => updateItem(item.id, 'image', null)} className="p-1.5 hover:bg-white/20 rounded transition-colors text-red-400 hover:text-red-300" title="Remove Image">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                      if (col === 'sku') return (
                        <div key="sku" className="text-[#64748b] font-medium flex justify-between sm:flex sm:items-start sm:border-r border-[#e2e8f0] relative group/field" onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: item.id, field: 'sku' }); const input = e.currentTarget.querySelector('input, textarea') as HTMLElement; if (input) input.focus(); }}>
                          <span className="sm:hidden font-bold uppercase text-[8px] text-[#94a3b8] px-4 pt-1">SKU</span>
                          <div className="w-full h-full px-4 py-1 pt-2">
                            <AutoFitText 
                              text={item.sku} 
                              style={item.styles.sku} 
                              align="left" 
                              minScale={0.8} 
                              className="uppercase" 
                              isEditing={!isExporting}
                              onChange={(val) => updateItem(item.id, 'sku', val.toUpperCase())}
                            />
                          </div>
                        </div>
                      );
                      if (col === 'description') return (
                        <div key="description" className="text-[#0f172a] font-bold uppercase pr-4 sm:pl-0 sm:border-r border-[#e2e8f0] relative group/field" onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: item.id, field: 'description' }); const input = e.currentTarget.querySelector('input, textarea') as HTMLElement; if (input) input.focus(); }}>
                          <span className="sm:hidden block font-bold uppercase text-[8px] text-[#94a3b8] mb-0.5 px-4 pt-1">Description</span>
                          <div className="w-full h-full px-4 sm:px-2 py-1 flex items-start pt-2">
                            <div className="w-full h-full relative">
                              <div 
                                className="break-words whitespace-pre-wrap w-full uppercase"
                                style={{
                                  color: item.styles.description.color,
                                  fontSize: `${item.styles.description.fontSize}px`,
                                  fontWeight: item.styles.description.bold ? '900' : 'normal',
                                  fontStyle: item.styles.description.italic ? 'italic' : 'normal',
                                  textDecoration: item.styles.description.underline ? 'underline' : 'none',
                                  fontFamily: item.styles.description.fontFamily || 'inherit',
                                  textAlign: item.styles.description.align || 'left',
                                  lineHeight: '1.2',
                                  opacity: !isExporting ? 0 : 1
                                }}
                              >
                                {item.description || " "}
                              </div>
                              {!isExporting && (
                                <textarea
                                  value={item.description}
                                  onChange={(e) => updateItem(item.id, 'description', e.target.value.toUpperCase())}
                                  className="absolute inset-0 caret-blue-500 selection:bg-blue-500/30 bg-transparent focus:outline-none cursor-text resize-none w-full h-full uppercase p-0 m-0 border-none whitespace-pre-wrap break-words"
                                  style={{ 
                                    textAlign: item.styles.description.align || 'left',
                                    fontSize: `${item.styles.description.fontSize}px`,
                                    fontWeight: item.styles.description.bold ? '900' : 'normal',
                                    fontStyle: item.styles.description.italic ? 'italic' : 'normal',
                                    fontFamily: item.styles.description.fontFamily || 'inherit',
                                    color: item.styles.description.color,
                                    lineHeight: '1.2'
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      if (col === 'normal') return (
                        <div key="normal" className={`text-left sm:text-right text-[#334155] flex justify-between sm:block ${viewMode !== 'without-image-promo' ? 'sm:border-r border-[#e2e8f0]' : ''} relative group/field`} onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: item.id, field: 'normalPrice' }); const input = e.currentTarget.querySelector('input, textarea') as HTMLElement; if (input) input.focus(); }}>
                          <span className="sm:hidden font-bold uppercase text-[8px] text-[#94a3b8] px-4 pt-1">Normal</span>
                          <div className="flex items-start justify-end h-full px-1 pt-2">
                            <span className="pl-4 sm:pl-0 text-[9px] opacity-70 mr-1 mt-0.5">R</span>
                            <div className="flex-1 h-full">
                              <AutoFitText 
                                text={item.normalPrice} 
                                style={item.styles.normalPrice} 
                                align="right" 
                                className="text-right uppercase" 
                                isEditing={!isExporting}
                                onChange={(val) => updateItem(item.id, 'normalPrice', val.toUpperCase())}
                              />
                            </div>
                          </div>
                        </div>
                      );
                      if (col === 'promo' && viewMode !== 'without-image-promo') return (
                        <div key="promo" className="text-left sm:text-right text-[#0f172a] font-black flex justify-between sm:block relative group/field" onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: item.id, field: 'promoPrice' }); const input = e.currentTarget.querySelector('input, textarea') as HTMLElement; if (input) input.focus(); }}>
                          <span className="sm:hidden font-bold uppercase text-[8px] text-[#94a3b8] px-4 pt-1">Promo</span>
                          <div className="flex items-start justify-end h-full px-1 pt-2">
                            <span className="pl-4 sm:pl-0 text-[9px] opacity-70 mr-1 mt-0.5">R</span>
                            <div className="flex-1 h-full">
                              <AutoFitText 
                                text={item.promoPrice} 
                                style={item.styles.promoPrice} 
                                align="right" 
                                className="text-right uppercase" 
                                isEditing={!isExporting}
                                onChange={(val) => updateItem(item.id, 'promoPrice', val.toUpperCase())}
                              />
                            </div>
                          </div>
                        </div>
                      );
                      return null;
                    })}
                    {!isExporting && (
                      <RowResizer 
                        onResize={(d) => handleRowResize(item.id, d)} 
                        height={rowHeights[item.id] || (viewMode === 'with-images' ? 72 : 36)}
                        onHeightChange={(h) => setRowHeights(prev => ({ ...prev, [item.id]: h }))}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
            {/* Filler to extend borders to the bottom */}
            <div 
              className="flex-1 w-full grid min-h-0"
              style={{ 
                gridTemplateColumns: getGridTemplate(),
                backgroundImage: viewMode === 'with-images' ? 'linear-gradient(to bottom, transparent 71px, #e2e8f0 71px, #e2e8f0 72px)' : 'linear-gradient(to bottom, transparent 35px, #e2e8f0 35px, #e2e8f0 36px)',
                backgroundSize: viewMode === 'with-images' ? '100% 72px' : '100% 36px'
              }}
            >
              {!isExporting && <div className="hidden sm:block border-r border-[#e2e8f0] bg-neutral-50/30 h-full"></div>}
              {!isExporting && <div className="hidden sm:block border-r border-[#e2e8f0] h-full"></div>}
              {columnOrder.map(col => {
                if (col === 'img' && viewMode === 'with-images') return <div key="filler-img" className="hidden sm:block border-r border-[#e2e8f0] h-full"></div>;
                if (col === 'sku') return <div key="filler-sku" className="hidden sm:block border-r border-[#e2e8f0] h-full"></div>;
                if (col === 'description') return <div key="filler-description" className="hidden sm:block border-r border-[#e2e8f0] h-full"></div>;
                if (col === 'normal') return <div key="filler-normal" className={`hidden sm:block h-full ${viewMode !== 'without-image-promo' ? 'border-r border-[#e2e8f0]' : ''}`}></div>;
                if (col === 'promo' && viewMode !== 'without-image-promo') return <div key="filler-promo" className="hidden sm:block h-full"></div>;
                return null;
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="h-[60px] border-t border-[#f1f5f9] flex flex-col justify-end pb-4">
            <div className="text-[8px] text-[#94a3b8] flex justify-between items-center px-1">
              <div className="flex items-center gap-3">
                <div className="uppercase tracking-[0.2em] font-bold">{date}</div>
                <span className="opacity-30">|</span>
                <div className="relative group/field" onClick={(e) => { e.stopPropagation(); setActiveStyleField({ id: 'footer', field: 'footer' }); }}>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    className={`bg-transparent border-none focus:outline-none p-0 transition-colors uppercase tracking-widest font-medium ${!isExporting ? 'hover:bg-[#124e8f]/5 cursor-text' : ''}`}
                    style={{
                      color: footerStyle.color,
                      fontSize: `${footerStyle.fontSize}px`,
                      fontWeight: footerStyle.bold ? '900' : 'normal',
                      fontStyle: footerStyle.italic ? 'italic' : 'normal',
                      textDecoration: footerStyle.underline ? 'underline' : 'none',
                      fontFamily: footerStyle.fontFamily || 'inherit',
                      textAlign: footerStyle.align || 'left',
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="opacity-30">|</span>
                <div className="font-bold tracking-widest uppercase">Page {pageIndex + 1} of {pages.length}</div>
              </div>
            </div>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}
