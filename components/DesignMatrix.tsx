
import React, { useState, useEffect, useMemo } from 'react';
import type { AIMessage, ChatMessageImage } from '../types';
import { IconComponents } from './IconComponents';
import { generateDesignMatrixCategories, generateOptionsForCategory } from '../services/geminiService';
import { useImageLoader } from '../hooks/useImageLoader';


interface DesignMatrixProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => void;
  imageToEdit: ChatMessageImage | null;
  chatHistory: AIMessage[];
}

interface CategoryState {
  id: number;
  name: string;
  options: string[];
}

interface CustomCategoryState {
    name: string;
    options: string[];
    isLoading: boolean;
    error: string | null;
}

const MatrixError: React.FC<{ message: string }> = ({ message }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 rounded-lg text-center p-4">
        <IconComponents.Close className="w-10 h-10 text-red-400 mb-4" />
        <p className="text-sm text-red-400">{message}</p>
    </div>
);


export const DesignMatrix: React.FC<DesignMatrixProps> = ({ isOpen, onClose, onGenerate, imageToEdit, chatHistory }) => {
  const [categories, setCategories] = useState<CategoryState[]>([]);
  const [customCategory, setCustomCategory] = useState<CustomCategoryState>({
      name: '',
      options: [],
      isLoading: false,
      error: null
  });
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const { loadedImage, isLoading: isImageLoading } = useImageLoader(imageToEdit || undefined);
  
  const imageToEditUrl = useMemo(() => {
    if (!loadedImage?.data) return null;
    return `data:${loadedImage.mimeType};base64,${loadedImage.data}`;
  }, [loadedImage]);

  useEffect(() => {
    const fetchMatrixData = async () => {
      if (!loadedImage?.data) return;

      setIsMatrixLoading(true);
      setMatrixError(null);
      setCategories([]);
      setSelections({});
      setCustomCategory({ name: '', options: [], isLoading: false, error: null });

      try {
        const matrixData = await generateDesignMatrixCategories(loadedImage, chatHistory); 
        if (matrixData && matrixData.length > 0) {
          setCategories(matrixData.map((cat, i) => ({
            id: i,
            name: cat.name,
            options: cat.options,
          })));
        } else {
          throw new Error('AI failed to generate design categories.');
        }
      } catch (error) {
        console.error(error);
        setMatrixError('Sorry, there was an error generating design options. Please try again.');
      } finally {
        setIsMatrixLoading(false);
      }
    };

    if (isOpen && !isImageLoading) {
      fetchMatrixData();
    }
  }, [isOpen, loadedImage, isImageLoading, chatHistory]);

  const handleSelect = (categoryKey: string, option: string) => {
    if (selections[categoryKey] === option) {
        const newSelections = { ...selections };
        delete newSelections[categoryKey];
        setSelections(newSelections);
    } else {
        setSelections(prev => ({ ...prev, [categoryKey]: option }));
    }
  };

  const handleCustomInputChange = (categoryKey: string, value: string) => {
    setSelections(prev => ({ ...prev, [categoryKey]: value }));
  };

  const handleCustomCategoryNameKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          const name = e.currentTarget.value.trim();
          if (!name || !loadedImage?.data) return;

          setCustomCategory({ name, options: [], isLoading: true, error: null });
          try {
              const options = await generateOptionsForCategory(loadedImage, chatHistory, name);
              if (options && options.length > 0) {
                  setCustomCategory({ name, options, isLoading: false, error: null });
              } else {
                  throw new Error('AI failed to generate options for this category.');
              }
          } catch (error) {
              console.error(error);
              setCustomCategory({ name, options: [], isLoading: false, error: 'Failed to get options.' });
          }
      }
  };


  const handleGenerateClick = () => {
    const selectedOptions = Object.entries(selections)
        .map(([key, option]) => {
            let categoryName;
            if (key === 'custom') {
                categoryName = customCategory.name;
            } else {
                const index = parseInt(key, 10);
                categoryName = categories[index]?.name;
            }
            return { category: categoryName, option };
        })
        .filter(item => item.category?.trim() && (typeof item.option === 'string' && item.option.trim()));

    if (selectedOptions.length === 0) return;

    const promptIntro = "Update the design with the following changes: ";
    const promptParts = selectedOptions.map(({ category, option }) => 
      `${category.toLowerCase()} changed to '${option}'`
    );
    
    const fullPrompt = promptIntro + promptParts.join(', ') + '.';
    onGenerate(fullPrompt);
  };
  
  const hasSelections = Object.values(selections).some(option => typeof option === 'string' && option.trim() !== '');

  if (!isOpen) {
    return null;
  }
  
  return (
    <div 
      className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-[90rem] h-auto max-h-[90vh] flex flex-col p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center">
            <IconComponents.Wand className="w-6 h-6 mr-3 text-indigo-400" />
            Interactive Design Matrix
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-700">
            <IconComponents.Close className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div className="w-full max-h-52 flex-shrink-0 flex items-center justify-center bg-black/20 rounded-lg p-2">
                {isImageLoading ? (
                    <div className="w-full h-full flex items-center justify-center animate-pulse bg-gray-800 rounded-md"></div>
                ) : imageToEditUrl ? (
                    <img src={imageToEditUrl} alt="Design to edit" className="max-w-full max-h-full object-contain rounded-md" />
                ) : (
                    <div className="text-xs text-gray-500">Could not load image.</div>
                )}
            </div>
            
            {(isMatrixLoading || isImageLoading) && (
              <div className="w-full flex-shrink-0 flex items-center justify-center bg-black/20 rounded-lg p-4 text-sm">
                <IconComponents.Sparkles className="w-5 h-5 mr-3 text-indigo-400 animate-pulse" />
                <span className="text-gray-400">{isImageLoading ? 'Loading image...' : 'Analyzing your design to generate relevant categories...'}</span>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto pr-2 relative">
                {matrixError && <MatrixError message={matrixError} />}
                {!isMatrixLoading && !matrixError && !isImageLoading && categories.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
                        {categories.map((category, index) => (
                            <div key={category.id} className="flex flex-col space-y-2">
                                <h3 className="font-semibold text-sm w-full p-2 text-gray-200 h-[42px] flex items-center">
                                    {category.name}
                                </h3>
                                
                                <div className="flex flex-col space-y-2">
                                    {category.options.map((option) => {
                                        const isSelected = selections[String(index)] === option;
                                        return (
                                            <button
                                                key={option}
                                                onClick={() => handleSelect(String(index), option)}
                                                className={`p-2 text-xs text-left rounded-md transition-colors duration-200 ${
                                                    isSelected
                                                    ? 'bg-indigo-600 text-white font-medium'
                                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        );
                                    })}
                                </div>

                                <input
                                    type="text"
                                    placeholder="Or type a custom option..."
                                    value={
                                        selections[String(index)] && !category.options.includes(selections[String(index)])
                                            ? selections[String(index)]
                                            : ''
                                    }
                                    onChange={(e) => handleCustomInputChange(String(index), e.target.value)}
                                    className="mt-auto p-2 text-xs w-full bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-200 placeholder-gray-500"
                                />
                            </div>
                        ))}
                        {/* Custom 6th Column */}
                        <div className="flex flex-col space-y-2">
                           <input
                                type="text"
                                placeholder="Custom category..."
                                onKeyDown={handleCustomCategoryNameKeyDown}
                                disabled={customCategory.isLoading}
                                className="font-semibold text-sm w-full p-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-200 placeholder-gray-500 disabled:opacity-50 h-[42px]"
                            />
                             <div className="flex flex-col space-y-2 min-h-[200px] relative">
                                {customCategory.isLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <IconComponents.Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                                    </div>
                                )}
                                {customCategory.error && (
                                     <div className="text-xs text-red-400 p-2 text-center">{customCategory.error}</div>
                                )}
                                {!customCategory.isLoading && !customCategory.error && customCategory.options.map((option) => {
                                    const isSelected = selections['custom'] === option;
                                    return (
                                        <button
                                            key={option}
                                            onClick={() => handleSelect('custom', option)}
                                            className={`p-2 text-xs text-left rounded-md transition-colors duration-200 ${
                                                isSelected
                                                ? 'bg-indigo-600 text-white font-medium'
                                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    );
                                })}
                            </div>

                            <input
                                type="text"
                                placeholder="Or type a custom option..."
                                value={
                                    selections['custom'] && !customCategory.options.includes(selections['custom'])
                                        ? selections['custom']
                                        : ''
                                }
                                onChange={(e) => handleCustomInputChange('custom', e.target.value)}
                                disabled={!customCategory.name}
                                className="mt-auto p-2 text-xs w-full bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-200 placeholder-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex justify-end flex-shrink-0">
            <button
                onClick={handleGenerateClick}
                disabled={!hasSelections || isMatrixLoading || isImageLoading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-md font-semibold disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center"
            >
                <IconComponents.Send className="w-5 h-5 mr-2"/>
                Apply & Generate
            </button>
        </div>
      </div>
    </div>
  );
};
