
import { useState, useEffect } from 'react';
import { getImage } from '../services/db';
import type { ChatMessageImage } from '../types';

export const useImageLoader = (image: ChatMessageImage | undefined) => {
    const [loadedImage, setLoadedImage] = useState<ChatMessageImage | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!image) {
            setIsLoading(false);
            setLoadedImage(null);
            return;
        }

        if (image.data) {
            setLoadedImage(image);
            setIsLoading(false);
            return;
        }

        let isMounted = true;
        const fetchImage = async () => {
            setIsLoading(true);
            try {
                const storedImage = await getImage(image.id);
                if (isMounted) {
                    if (storedImage) {
                        setLoadedImage({ ...image, data: storedImage.data });
                    } else {
                        setLoadedImage(image); // Image not found in DB
                    }
                    setIsLoading(false);
                }
            } catch (error) {
                console.error(`Failed to load image ${image.id} from DB`, error);
                if (isMounted) {
                    setLoadedImage(image);
                    setIsLoading(false);
                }
            }
        };

        fetchImage();

        return () => {
            isMounted = false;
        };
    }, [image]);

    return { loadedImage, isLoading };
};
