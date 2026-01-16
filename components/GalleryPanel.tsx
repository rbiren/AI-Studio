
import React from 'react';
import type { ChatMessageImage } from '../types';
import { IconComponents } from './IconComponents';
import { useImageLoader } from '../hooks/useImageLoader';

interface GalleryPanelProps {
  images: ChatMessageImage[];
  onImageClick: (image: ChatMessageImage) => void;
}

const GalleryImageItem: React.FC<{ image: ChatMessageImage; onClick: (image: ChatMessageImage) => void; }> = ({ image, onClick }) => {
    const { loadedImage, isLoading } = useImageLoader(image);

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!loadedImage?.data) {
             console.error("No image data to download");
             return;
        }
        const link = document.createElement('a');
        link.href = `data:${loadedImage.mimeType};base64,${loadedImage.data}`;
        const fileExtension = loadedImage.mimeType.split('/')[1] || 'jpeg';
        link.download = `rv-design-${loadedImage.id}.${fileExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    if (isLoading) {
        return <div className="rounded-lg bg-gray-800 animate-pulse aspect-video w-full"></div>
    }
    
    if (!loadedImage?.data) {
        return null; // Don't show an item if the image failed to load
    }

    return (
        <div 
            className="rounded-lg overflow-hidden group relative cursor-pointer"
            onClick={() => onClick(loadedImage)}
        >
            <img
              src={`data:${loadedImage.mimeType};base64,${loadedImage.data}`}
              alt="Generated RV design"
              className="w-full h-auto object-cover"
            />
            <button
                onClick={handleDownload}
                aria-label="Download image"
                className="absolute bottom-2 right-2 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
                <IconComponents.Download className="w-5 h-5" />
            </button>
        </div>
    );
};


export const GalleryPanel: React.FC<GalleryPanelProps> = ({ images, onImageClick }) => {
  return (
    <aside className="w-72 bg-gray-900 p-4 border-l border-gray-800 flex-col hidden lg:flex">
      <h2 className="text-lg font-semibold mb-4 text-gray-200 flex items-center">
        <IconComponents.Image className="w-5 h-5 mr-2" />
        Recent Creations
      </h2>
      {images.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
            <IconComponents.Image className="w-12 h-12 mb-2" />
            <p className="text-sm">Your generated RV designs will appear here.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {images.map((image) => (
                <GalleryImageItem key={image.id} image={image} onClick={onImageClick} />
            ))}
        </div>
      )}
    </aside>
  );
};
