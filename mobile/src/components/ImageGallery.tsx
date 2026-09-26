import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { StorefrontImage } from '../types/shopify';
import type { BrandTheme } from '../types/domain';

const GALLERY_HEIGHT = 380;
const SWIPE_VELOCITY_THRESHOLD = 800;

interface ImageGalleryProps {
  images: StorefrontImage[];
  theme: BrandTheme;
}

/**
 * Paged image gallery driven by react-native-gesture-handler + reanimated
 * (not a plain horizontal ScrollView -- required for real pan control over
 * the snap animation and to keep the drag on the UI thread with no bridge
 * hop per frame). One shared value drives the whole row's transform; the
 * only thing that crosses onto the JS thread is the settled page index,
 * for the dot indicator.
 */
export function ImageGallery({ images, theme }: ImageGalleryProps) {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const translateX = useSharedValue(0);
  const currentIndex = useSharedValue(0);
  const dragStartX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStartX.value = translateX.value;
    })
    .onUpdate((event) => {
      translateX.value = dragStartX.value + event.translationX;
    })
    .onEnd((event) => {
      const maxIndex = images.length - 1;
      const threshold = width / 3;
      let nextIndex = currentIndex.value;

      if (event.translationX < -threshold || event.velocityX < -SWIPE_VELOCITY_THRESHOLD) {
        nextIndex = Math.min(currentIndex.value + 1, maxIndex);
      } else if (event.translationX > threshold || event.velocityX > SWIPE_VELOCITY_THRESHOLD) {
        nextIndex = Math.max(currentIndex.value - 1, 0);
      }

      currentIndex.value = nextIndex;
      translateX.value = withSpring(-nextIndex * width, { damping: 22, stiffness: 220 });
      runOnJS(setActiveIndex)(nextIndex);
    });

  const animatedRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (images.length === 0) {
    return <View style={[styles.container, { height: GALLERY_HEIGHT, backgroundColor: theme.surfaceColor }]} />;
  }

  // A single image needs no gesture at all -- skip the detector entirely
  // rather than wiring up a pan that can never move anywhere.
  if (images.length === 1) {
    return (
      <View style={[styles.container, { width, height: GALLERY_HEIGHT }]}>
        <Image source={{ uri: images[0].url }} style={{ width, height: GALLERY_HEIGHT }} contentFit="cover" cachePolicy="memory-disk" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height: GALLERY_HEIGHT }]}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.row, animatedRowStyle]}>
          {images.map((image, index) => (
            <Image
              key={`${image.url}-${index}`}
              source={{ uri: image.url }}
              style={{ width, height: GALLERY_HEIGHT }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={image.url}
            />
          ))}
        </Animated.View>
      </GestureDetector>
      <View style={styles.dots}>
        {images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index === activeIndex ? theme.primaryColor : `${theme.primaryColor}40`,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
