/**
 * Google Photos Picker Component
 * Provides UI for connecting Google Photos and selecting photos
 */

'use client';

import { useEffect } from 'react';
import { useGooglePhotos } from '@/hooks/use-google-photos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface GooglePhotosPickerProps {
  onPhotosSelected?: (photos: Array<{
    id: string;
    baseUrl: string;
    mimeType: string;
    filename?: string;
  }>) => void;
  buttonText?: string;
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  showSelectedCount?: boolean;
}

export function GooglePhotosPicker({
  onPhotosSelected,
  buttonText = 'Select from Google Photos',
  buttonVariant = 'default',
  showSelectedCount = true,
}: GooglePhotosPickerProps) {
  const {
    isLoading,
    error,
    selectedPhotos,
    openPhotoPicker,
    reset,
  } = useGooglePhotos();

  // Notify parent when photos are selected
  useEffect(() => {
    if (selectedPhotos.length > 0 && onPhotosSelected) {
      onPhotosSelected(selectedPhotos);
    }
  }, [selectedPhotos, onPhotosSelected]);

  return (
    <div className="space-y-4">
      <Button
        onClick={openPhotoPicker}
        disabled={isLoading}
        variant={buttonVariant}
        className="w-full sm:w-auto"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Opening Google Photos...
          </>
        ) : (
          <>
            <ImageIcon className="mr-2 h-4 w-4" />
            {buttonText}
          </>
        )}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showSelectedCount && selectedPhotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Selected Photos</CardTitle>
            <CardDescription>
              {selectedPhotos.length} photo{selectedPhotos.length !== 1 ? 's' : ''} selected from Google Photos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={reset} variant="outline" size="sm">
              Clear Selection
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Simple button-only version for minimal UI
 */
export function GooglePhotosButton({
  onPhotosSelected,
  buttonText,
  buttonVariant,
}: Omit<GooglePhotosPickerProps, 'showSelectedCount'>) {
  return (
    <GooglePhotosPicker
      onPhotosSelected={onPhotosSelected}
      buttonText={buttonText}
      buttonVariant={buttonVariant}
      showSelectedCount={false}
    />
  );
}
