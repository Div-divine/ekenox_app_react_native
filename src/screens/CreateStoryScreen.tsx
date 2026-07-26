import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { AppColors } from '../theme/colors';
import { storyService } from '../services/storyService';
import feedService from '../services/feedService';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';

const { width } = Dimensions.get('window');

const MUSIC_LIBRARY = [
  { id: '1', title: 'Nature Whispers', singer: 'Green Harmony', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: '2', title: 'Eco Beats', singer: 'DJ Earth', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: '3', title: 'Rainforest Ambient', singer: 'Forest Soundscape', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: '4', title: 'Ocean Waves', singer: 'Sea Breeze', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: '5', title: 'Solar Wind', singer: 'Future Sound', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
];

const getAiCuts = (duration: number) => {
  const segmentLength = 20;
  if (duration <= segmentLength) return [];

  const step = (duration - segmentLength) / 4;
  const cutNames = [
    " Highlight: Intro Hook",
    " Highlight: Key Moment",
    " Highlight: Action Center",
    " Highlight: Late Sequence",
    " Highlight: Natural Conclusion"
  ];

  return cutNames.map((name, i) => {
    const start = step * i;
    const end = start + segmentLength;
    return {
      name,
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
    };
  });
};

const validateCarouselMedia = (slides: SlideDraft[]) => {
  const numVideos = slides.filter(s => s.type === 'video').length;
  const numImages = slides.filter(s => s.type === 'image').length;

  if (numVideos === 0 && numImages > 5) {
    return { valid: false, reason: " Media Analyzer: Max 5 images allowed for carousel stories." };
  }
  if (numImages === 0 && numVideos > 3) {
    return { valid: false, reason: " Media Analyzer: Max 3 videos allowed for carousel stories." };
  }
  if (numVideos > 0 && numImages > 0) {
    if (numVideos === 2 && numImages > 1) {
      return { valid: false, reason: " Media Analyzer: Mixed media layouts allow at most 2 videos and 1 image." };
    }
    if (numVideos === 1 && numImages > 3) {
      return { valid: false, reason: " Media Analyzer: Mixed media layouts allow at most 1 video and 3 images." };
    }
    if (numVideos >= 2 && numImages > 1) {
      return { valid: false, reason: " Media Analyzer: Layout is too large! Maximum of 2 videos and 1 image is supported." };
    }
    if (numVideos >= 3) {
      return { valid: false, reason: " Media Analyzer: Max 3 videos allowed (you cannot mix with images when using 3 videos)." };
    }
  }
  return { valid: true };
};

interface SlideDraft {
  uri: string;
  type: 'image' | 'video';
  duration: number;
  trimStart?: number;
  trimDuration?: number;
  cutName?: string;
  altText?: string;
  linkUrl?: string;
  filter?: string;
  arEffect?: string;
  musicOffset?: number;
  stickers?: string[];
  textOverlay?: string;
  drawingLayers?: any;
}

export default function CreateStoryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  // Mode tab: 'single' | 'sequence'
  const [activeTab, setActiveTab] = useState<'single' | 'sequence'>('single');

  // Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedMusic, setSelectedMusic] = useState('');
  const [taggedUsers, setTaggedUsers] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'custom'>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [allowReactions, setAllowReactions] = useState(true);
  const [isDraft, setIsDraft] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [audienceAllowed, setAudienceAllowed] = useState('');
  const [audienceBlocked, setAudienceBlocked] = useState('');

  // Music list and preview states
  const [showMusicList, setShowMusicList] = useState(false);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);

  // Custom audio upload states
  const [uploadedMusicUri, setUploadedMusicUri] = useState<string | null>(null);
  const [uploadedMusicMimeType, setUploadedMusicMimeType] = useState('audio/mpeg');
  const [customMusicTitle, setCustomMusicTitle] = useState('');
  const [customMusicSinger, setCustomMusicSinger] = useState('');
  const [uploadedMusicUrl, setUploadedMusicUrl] = useState<string | null>(null);
  const [isUploadingMusic, setIsUploadingMusic] = useState(false);

  //  Video Trimming States
  const [trimModalVisible, setTrimModalVisible] = useState(false);
  const [trimmingMedia, setTrimmingMedia] = useState<{ uri: string; duration: number; isCarousel: boolean } | null>(null);
  const [selectedCutIndex, setSelectedCutIndex] = useState(0);

  // Players
  const musicPreviewPlayer = useVideoPlayer(null, (p) => {
    p.loop = false;
  });
  const trimPreviewPlayer = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  const { currentTime } = useEvent(trimPreviewPlayer, 'timeUpdate', { currentTime: trimPreviewPlayer.currentTime } as any) as any;

  useEffect(() => {
    if (trimModalVisible && trimmingMedia) {
      const cuts = getAiCuts(trimmingMedia.duration);
      const activeCut = cuts[selectedCutIndex];
      if (activeCut && currentTime >= activeCut.end) {
        trimPreviewPlayer.currentTime = activeCut.start;
      }
    }
  }, [currentTime, selectedCutIndex, trimModalVisible, trimmingMedia]);

  // Media state
  const [singleMedia, setSingleMedia] = useState<SlideDraft | null>(null);
  const [sequenceSlides, setSequenceSlides] = useState<SlideDraft[]>([]);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Request library permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Ekenox needs permission to access your media library to upload stories.');
      return false;
    }
    return true;
  };

  // Pick an audio file from device
  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      setUploadedMusicUri(asset.uri);
      setUploadedMusicMimeType(asset.mimeType || 'audio/mpeg');
      setUploadedMusicUrl(null); // reset

      // Auto-extract title and singer from filename
      let fileName = asset.name || '';
      // Remove extension
      const dotIdx = fileName.lastIndexOf('.');
      if (dotIdx > 0) {
        fileName = fileName.substring(0, dotIdx);
      }
      
      if (fileName.includes('-')) {
        const parts = fileName.split('-');
        setCustomMusicSinger(parts[0].trim());
        setCustomMusicTitle(parts[1].trim());
      } else if (fileName.includes('—')) {
        const parts = fileName.split('—');
        setCustomMusicSinger(parts[0].trim());
        setCustomMusicTitle(parts[1].trim());
      } else {
        setCustomMusicTitle(fileName.trim());
        setCustomMusicSinger('');
      }
      setSelectedMusic(fileName.trim()); // Set as selected music title
    } catch (e) {
      Alert.alert('Error', 'Could not pick audio file.');
    }
  };



  // Pick single media
  const handlePickSingleMedia = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const type = asset.type === 'video' ? 'video' : 'image';
        const duration = asset.duration ? Math.round(asset.duration / 1000) : 4; // default 4s for images

        if (type === 'video' && duration > 20) {
          setTrimmingMedia({ uri: asset.uri, duration, isCarousel: false });
          setSelectedCutIndex(0);
          setTrimModalVisible(true);
        } else {
          setSingleMedia({
            uri: asset.uri,
            type,
            duration,
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select media. Please try again.');
    }
  };

  // Add slide to carousel sequence
  const handleAddSequenceSlide = async () => {
    if (sequenceSlides.length >= 5) {
      Alert.alert('Limit Reached', 'Carousel stories support a maximum of 5 slides.');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const type: 'video' | 'image' = asset.type === 'video' ? 'video' : 'image';
        const duration = asset.duration ? Math.round(asset.duration / 1000) : 4;

        // Validate carousel limit
        const nextSlides: SlideDraft[] = [...sequenceSlides, { uri: asset.uri, type, duration }];
        const valResult = validateCarouselMedia(nextSlides);
        if (!valResult.valid) {
          Alert.alert(' Media Analyzer 🤖', valResult.reason);
          return;
        }

        if (type === 'video' && duration > 20) {
          setTrimmingMedia({ uri: asset.uri, duration, isCarousel: true });
          setSelectedCutIndex(0);
          setTrimModalVisible(true);
        } else {
          setSequenceSlides(nextSlides);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add slide.');
    }
  };

  const handleApplyTrim = () => {
    if (!trimmingMedia) return;
    const cuts = getAiCuts(trimmingMedia.duration);
    const cut = cuts[selectedCutIndex];

    const mediaItem: SlideDraft = {
      uri: trimmingMedia.uri,
      type: 'video',
      duration: 20,
      trimStart: cut.start,
      trimDuration: 20,
      cutName: cut.name,
    };

    if (trimmingMedia.isCarousel) {
      setSequenceSlides(prev => [...prev, mediaItem]);
    } else {
      setSingleMedia(mediaItem);
    }

    setTrimModalVisible(false);
    setTrimmingMedia(null);
    trimPreviewPlayer.pause();
  };

  // Sync player source on trim modal open
  useEffect(() => {
    if (trimModalVisible && trimmingMedia) {
      trimPreviewPlayer.replaceAsync(trimmingMedia.uri).then(() => {
        const cuts = getAiCuts(trimmingMedia.duration);
        const cut = cuts[selectedCutIndex] || { start: 0 };
        (trimPreviewPlayer as any).seekTo(cut.start);
        trimPreviewPlayer.play();
      });
    }
  }, [trimModalVisible, trimmingMedia]);

  // Remove slide from carousel
  const handleRemoveSlide = (index: number) => {
    setSequenceSlides(prev => prev.filter((_, i) => i !== index));
  };

  // Submit story
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Required Info', 'Please provide a title for your story.');
      return;
    }

    if (activeTab === 'single' && !singleMedia) {
      Alert.alert('Required Media', 'Please select an image or video for your story.');
      return;
    }

    if (activeTab === 'sequence' && sequenceSlides.length === 0) {
      Alert.alert('Required Media', 'Please add at least one slide for your carousel story.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      if (description) formData.append('description', description);
      if (location) formData.append('location', location);
      if (selectedMusic) formData.append('selected_music', selectedMusic);
      // Send uploaded real music fields at story creation time
      if (uploadedMusicUri) {
        const uriParts = uploadedMusicUri.split('/');
        const filename = uriParts[uriParts.length - 1] || 'music.mp3';
        const ext = filename.split('.').pop() || 'mp3';
        formData.append('audio', {
          uri: uploadedMusicUri,
          name: filename,
          type: `audio/${ext}`,
        } as any);
        if (customMusicTitle.trim()) formData.append('music_title', customMusicTitle.trim());
        if (customMusicSinger.trim()) formData.append('music_singer', customMusicSinger.trim());
      }
      if (taggedUsers) formData.append('tagged_users', taggedUsers);
      if (hashtags) formData.append('hashtags', hashtags);
      formData.append('visibility', visibility);
      formData.append('allow_comments', allowComments ? '1' : '0');
      formData.append('allow_reactions', allowReactions ? '1' : '0');
      formData.append('is_draft', isDraft ? '1' : '0');
      if (linkUrl) formData.append('link_url', linkUrl);
      if (audienceAllowed) formData.append('audience_allowed', audienceAllowed);
      if (audienceBlocked) formData.append('audience_blocked', audienceBlocked);

      if (activeTab === 'single' && singleMedia) {
        // Appending single file
        const uri = singleMedia.uri;
        const uriParts = uri.split('/');
        const filename = uriParts[uriParts.length - 1];
        const ext = filename.split('.').pop() || '';

        formData.append(singleMedia.type === 'video' ? 'video' : 'image', {
          uri,
          name: filename,
          type: singleMedia.type === 'video' ? `video/${ext}` : `image/${ext}`,
        } as any);

        formData.append('slide_duration', singleMedia.type === 'video' ? String(singleMedia.duration) : '4');

        if (singleMedia.trimStart !== undefined) {
          formData.append('trim_start', String(singleMedia.trimStart));
          formData.append('trim_duration', String(singleMedia.trimDuration));
        }

        await storyService.createSingleStory(formData);
      } else {
        const slidesMetadata = sequenceSlides.map((slide, index) => {
          return {
            position: index + 1,
            type: slide.type,
            duration: slide.type === 'video' ? slide.duration : 4,
            alt_text: slide.altText || slide.cutName || `Slide ${index + 1}`,
            trim_start: slide.trimStart,
            trim_duration: slide.trimDuration,
            link_url: slide.linkUrl || null,
            filters: slide.filter ? [slide.filter] : null,
            ar_effects: slide.arEffect ? [slide.arEffect] : null,
            music_offset: slide.musicOffset !== undefined ? Number(slide.musicOffset) : null,
            stickers: slide.stickers || null,
            text_overlays: slide.textOverlay ? [{ text: slide.textOverlay, x: 50, y: 50, color: '#FFFFFF', size: 24 }] : null,
            drawing_layers: slide.drawingLayers || null,
          };
        });

        formData.append('slides', JSON.stringify(slidesMetadata));
        formData.append('slide_duration', '20');

        sequenceSlides.forEach((slide) => {
          const uri = slide.uri;
          const uriParts = uri.split('/');
          const filename = uriParts[uriParts.length - 1];
          const ext = filename.split('.').pop() || '';

          formData.append('media[]', {
            uri,
            name: filename,
            type: slide.type === 'video' ? `video/${ext}` : `image/${ext}`,
          } as any);
        });

        await storyService.createCarouselStory(formData);
      }

      Alert.alert('Success 🎉', 'Your story has been shared with the Ekenox community!', [
        {
          text: 'Awesome',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message || 'An error occurred during story creation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={AppColors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={isLoading} style={[styles.headerBtn, styles.headerSubmit]}>
          {isLoading ? (
            <ActivityIndicator size="small" color={AppColors.primary} />
          ) : (
            <Text style={styles.headerSubmitText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        {/* Type selector tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'single' && styles.tabBtnActive]}
            onPress={() => setActiveTab('single')}
          >
            <Ionicons name="image-outline" size={16} color={activeTab === 'single' ? 'white' : AppColors.textMedium} />
            <Text style={[styles.tabText, activeTab === 'single' && styles.tabTextActive]}>Single Media</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'sequence' && styles.tabBtnActive]}
            onPress={() => setActiveTab('sequence')}
          >
            <Ionicons name="images-outline" size={16} color={activeTab === 'sequence' ? 'white' : AppColors.textMedium} />
            <Text style={[styles.tabText, activeTab === 'sequence' && styles.tabTextActive]}>Carousel Slides</Text>
          </TouchableOpacity>
        </View>

        {/* Media picker section */}
        {activeTab === 'single' ? (
          <View style={styles.pickerContainer}>
            {singleMedia ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: singleMedia.uri }} style={styles.previewImage} />
                <View style={styles.mediaBadge}>
                  <Ionicons
                    name={singleMedia.type === 'video' ? 'videocam' : 'image'}
                    size={14}
                    color="white"
                  />
                  <Text style={styles.mediaBadgeText}>
                    {singleMedia.type === 'video' ? `${singleMedia.duration}s` : 'Image'}
                  </Text>
                </View>
                {singleMedia.cutName && (
                  <View style={styles.aiCutAppliedBadge}>
                    <Ionicons name="sparkles" size={12} color="white" />
                    <Text style={styles.aiCutAppliedText}>{singleMedia.cutName}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setSingleMedia(null)}>
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.pickButton} onPress={handlePickSingleMedia}>
                <View style={styles.pickButtonInner}>
                  <Ionicons name="cloud-upload-outline" size={48} color={AppColors.primary} />
                  <Text style={styles.pickTitle}>Select Image or Video</Text>
                  <Text style={styles.pickSubtitle}>Upload photos or short ecological videos</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.pickerContainer}>
            <Text style={styles.carouselLabel}>Carousel Slides ({sequenceSlides.length}/5) — Tap a slide to edit details</Text>

            <View style={styles.slideList}>
              {sequenceSlides.map((slide, index) => (
                <View
                  key={index}
                  style={[
                    styles.slideThumbnailContainer,
                    editingSlideIndex === index && { borderColor: AppColors.primary, borderWidth: 2 }
                  ]}
                >
                  <TouchableOpacity onPress={() => setEditingSlideIndex(index)}>
                    <Image source={{ uri: slide.uri }} style={styles.slideThumbnail} />
                  </TouchableOpacity>
                  <View style={styles.slideBadge}>
                    <Text style={styles.slideBadgeText}>{index + 1}</Text>
                  </View>
                  {(slide.cutName || slide.altText || slide.linkUrl || slide.filter || slide.arEffect || slide.textOverlay) && (
                    <View style={styles.slideTrimDot}>
                      <Ionicons name="sparkles" size={8} color="white" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeSlideBtn} onPress={() => {
                    handleRemoveSlide(index);
                    if (editingSlideIndex === index) setEditingSlideIndex(null);
                  }}>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {sequenceSlides.length < 5 && (
                <TouchableOpacity style={styles.addSlideBtn} onPress={handleAddSequenceSlide}>
                  <Ionicons name="add" size={24} color={AppColors.primary} />
                  <Text style={styles.addSlideText}>Add Slide</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Per-slide Edit Card */}
            {editingSlideIndex !== null && sequenceSlides[editingSlideIndex] && (
              <View style={styles.slideEditorCard}>
                <View style={styles.slideEditorHeader}>
                  <Text style={styles.slideEditorTitle}>✏️ Edit Slide {editingSlideIndex + 1} Details</Text>
                  <TouchableOpacity onPress={() => setEditingSlideIndex(null)}>
                    <Ionicons name="close" size={20} color={AppColors.textDark} />
                  </TouchableOpacity>
                </View>

                {/* Alt Text / Caption */}
                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>Slide Caption / Description</Text>
                  <TextInput
                    style={styles.editorInput}
                    placeholder="Describe this photo/video (alt text)..."
                    placeholderTextColor={AppColors.textLight}
                    value={sequenceSlides[editingSlideIndex].altText || ''}
                    onChangeText={(val) => {
                      setSequenceSlides(prev => prev.map((s, idx) =>
                        idx === editingSlideIndex ? { ...s, altText: val } : s
                      ));
                    }}
                  />
                </View>

                {/* Swipe Up Link */}
                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>Slide Swipe Up Link (URL)</Text>
                  <TextInput
                    style={styles.editorInput}
                    placeholder="https://example.com"
                    placeholderTextColor={AppColors.textLight}
                    value={sequenceSlides[editingSlideIndex].linkUrl || ''}
                    onChangeText={(val) => {
                      setSequenceSlides(prev => prev.map((s, idx) =>
                        idx === editingSlideIndex ? { ...s, linkUrl: val } : s
                      ));
                    }}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>

                {/* Text Overlay */}
                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>Floating Text Overlay</Text>
                  <TextInput
                    style={styles.editorInput}
                    placeholder="Enter text to overlay on slide..."
                    placeholderTextColor={AppColors.textLight}
                    value={sequenceSlides[editingSlideIndex].textOverlay || ''}
                    onChangeText={(val) => {
                      setSequenceSlides(prev => prev.map((s, idx) =>
                        idx === editingSlideIndex ? { ...s, textOverlay: val } : s
                      ));
                    }}
                  />
                </View>

                {/* Music Offset */}
                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>Music Offset (seconds)</Text>
                  <TextInput
                    style={styles.editorInput}
                    placeholder="0"
                    placeholderTextColor={AppColors.textLight}
                    value={sequenceSlides[editingSlideIndex].musicOffset?.toString() || ''}
                    onChangeText={(val) => {
                      const num = parseInt(val, 10);
                      setSequenceSlides(prev => prev.map((s, idx) =>
                        idx === editingSlideIndex ? { ...s, musicOffset: isNaN(num) ? undefined : num } : s
                      ));
                    }}
                    keyboardType="numeric"
                  />
                </View>

                {/* Filters */}
                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>Apply Filter</Text>
                  <View style={styles.optionsRow}>
                    {['None', 'Vivid', 'Cool', 'Warm', 'Greyscale'].map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={[
                          styles.optionPill,
                          (sequenceSlides[editingSlideIndex].filter || 'None') === f && styles.optionPillActive
                        ]}
                        onPress={() => {
                          setSequenceSlides(prev => prev.map((s, idx) =>
                            idx === editingSlideIndex ? { ...s, filter: f === 'None' ? undefined : f } : s
                          ));
                        }}
                      >
                        <Text style={[
                          styles.optionPillText,
                          (sequenceSlides[editingSlideIndex].filter || 'None') === f && styles.optionPillTextActive
                        ]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* AR Effects */}
                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>AR Effect</Text>
                  <View style={styles.optionsRow}>
                    {['None', 'Blur BG', 'Eco Frame', 'Forest Glow'].map((ae) => (
                      <TouchableOpacity
                        key={ae}
                        style={[
                          styles.optionPill,
                          (sequenceSlides[editingSlideIndex].arEffect || 'None') === ae && styles.optionPillActive
                        ]}
                        onPress={() => {
                          setSequenceSlides(prev => prev.map((s, idx) =>
                            idx === editingSlideIndex ? { ...s, arEffect: ae === 'None' ? undefined : ae } : s
                          ));
                        }}
                      >
                        <Text style={[
                          styles.optionPillText,
                          (sequenceSlides[editingSlideIndex].arEffect || 'None') === ae && styles.optionPillTextActive
                        ]}>{ae}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Stickers Grid */}
                <View style={styles.editorField}>
                  <Text style={styles.editorLabel}>Attach Stickers</Text>
                  <View style={styles.optionsRow}>
                    {['🌲', '☀️', '🚗', '⚡', '🌱', '♻️'].map((emoji) => {
                      const list = sequenceSlides[editingSlideIndex].stickers || [];
                      const exists = list.includes(emoji);
                      return (
                        <TouchableOpacity
                          key={emoji}
                          style={[
                            styles.stickerOptionBtn,
                            exists && styles.stickerOptionBtnActive
                          ]}
                          onPress={() => {
                            const updatedList = exists
                              ? list.filter(e => e !== emoji)
                              : [...list, emoji];
                            setSequenceSlides(prev => prev.map((s, idx) =>
                              idx === editingSlideIndex ? { ...s, stickers: updatedList } : s
                            ));
                          }}
                        >
                          <Text style={{ fontSize: 20 }}>{emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setEditingSlideIndex(null)}
                >
                  <Text style={styles.doneBtnText}>Done Editing Slide</Text>
                </TouchableOpacity>
              </View>
            )}



            {/*  Media Analyzer Card */}
            <View style={styles.aiAnalyzerCard}>
              <View style={styles.aiAnalyzerHeader}>
                <Ionicons name="sparkles" size={14} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.aiAnalyzerTitle}> Media Layout Analyzer</Text>
              </View>
              <View style={styles.aiAnalyzerBody}>
                <Text style={styles.aiAnalyzerStatus}>
                  Current layout: {sequenceSlides.filter(s => s.type === 'video').length} Videos, {sequenceSlides.filter(s => s.type === 'image').length} Images
                </Text>
                <Text style={styles.aiAnalyzerRule}>
                  ℹ️ Rules: Max 5 images | Max 3 videos | Mixed layout limit: 1 video with max 3 images, or 2 videos with max 1 image.
                </Text>
              </View>
            </View>

            <View style={styles.infoBanner}>
              <Ionicons name="sparkles" size={14} color={AppColors.primary} />
              <Text style={styles.infoBannerText}>
                Combine up to 5 photos/videos. Long videos are automatically cut to 20s.
              </Text>
            </View>
          </View>
        )}

        {/* Inputs */}
        <View style={styles.inputsSection}>
          <Text style={styles.sectionTitle}>Story Details</Text>

          <TextInput
            style={styles.textInput}
            placeholder="Story Title (e.g. Clean Beach Drive) *"
            placeholderTextColor={AppColors.textLight}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Tell us more about this action... (optional)"
            placeholderTextColor={AppColors.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <View style={styles.rowInput}>
            <Ionicons name="location-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.iconedInput}
              placeholder="Add Location"
              placeholderTextColor={AppColors.textLight}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <View style={styles.rowInput}>
            <Ionicons name="link-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.iconedInput}
              placeholder="Swipe Up Link (URL)"
              placeholderTextColor={AppColors.textLight}
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={styles.musicSection}>
            <TouchableOpacity
              style={styles.rowInput}
              onPress={() => setShowMusicList(!showMusicList)}
            >
              <Ionicons name="musical-notes-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
              <Text style={[styles.iconedInput, { color: selectedMusic ? AppColors.textDark : AppColors.textLight }]}>
                {selectedMusic ? `🎵 ${selectedMusic}` : 'Choose Background Music'}
              </Text>
              <Ionicons name={showMusicList ? "chevron-up" : "chevron-down"} size={16} color={AppColors.textMedium} />
            </TouchableOpacity>

            {showMusicList && (
              <View style={styles.musicDropdown}>
                {MUSIC_LIBRARY.map((track) => {
                  const isSelected = selectedMusic === track.title;
                  const isPreviewing = previewingTrackId === track.id;

                  const togglePreviewTrack = () => {
                    if (previewingTrackId === track.id) {
                      musicPreviewPlayer.pause();
                      setPreviewingTrackId(null);
                    } else {
                      musicPreviewPlayer.replaceAsync(track.url).then(() => {
                        musicPreviewPlayer.play();
                        setPreviewingTrackId(track.id);
                      });
                    }
                  };

                  return (
                    <View key={track.id} style={[styles.musicTrackItem, isSelected && styles.musicTrackItemActive]}>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                        onPress={() => {
                          setSelectedMusic(track.title);
                          setShowMusicList(false);
                          musicPreviewPlayer.pause();
                          setPreviewingTrackId(null);
                        }}
                      >
                        <View style={styles.musicIconCircle}>
                          <Ionicons name="musical-note" size={14} color={isSelected ? 'white' : AppColors.primary} />
                        </View>
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.musicTrackTitle}>{track.title}</Text>
                          <Text style={styles.musicTrackSinger}>{track.singer}</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.previewBtn}
                        onPress={togglePreviewTrack}
                      >
                        <Ionicons
                          name={isPreviewing ? "pause" : "play"}
                          size={14}
                          color={AppColors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Custom Audio Upload Section */}
            <View style={styles.customAudioSection}>
              <Text style={styles.customAudioLabel}>📤 Upload Your Own Music</Text>
              <TouchableOpacity style={styles.audioPickBtn} onPress={handlePickAudio}>
                <Ionicons name="cloud-upload-outline" size={16} color={AppColors.primary} />
                <Text style={styles.audioPickBtnText}>
                  {uploadedMusicUri ? '✅ Audio selected — change' : 'Pick audio from device (mp3, m4a, wav)'}
                </Text>
              </TouchableOpacity>
              {uploadedMusicUri && (
                <View style={styles.customAudioMeta}>
                  <TextInput
                    style={styles.customAudioInput}
                    placeholder="Music Title *"
                    placeholderTextColor={AppColors.textLight}
                    value={customMusicTitle}
                    onChangeText={setCustomMusicTitle}
                  />
                  <TextInput
                    style={styles.customAudioInput}
                    placeholder="Singer / Artist"
                    placeholderTextColor={AppColors.textLight}
                    value={customMusicSinger}
                    onChangeText={setCustomMusicSinger}
                  />
                  <Text style={{ fontSize: 11, color: AppColors.primary, marginTop: 4, fontWeight: '600' }}>
                    ℹ️ Audio will be uploaded automatically when you share your story.
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.rowInput}>
            <Ionicons name="at-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.iconedInput}
              placeholder="Tag Users (comma separated)"
              placeholderTextColor={AppColors.textLight}
              value={taggedUsers}
              onChangeText={setTaggedUsers}
            />
          </View>

          <View style={styles.rowInput}>
            <Ionicons name="pricetag-outline" size={20} color={AppColors.textMedium} style={styles.inputIcon} />
            <TextInput
              style={styles.iconedInput}
              placeholder="Hashtags (e.g. green, carshare)"
              placeholderTextColor={AppColors.textLight}
              value={hashtags}
              onChangeText={setHashtags}
            />
          </View>
        </View>

        {/* Advanced Accordion */}
        <TouchableOpacity style={styles.advancedHeader} onPress={() => setShowAdvanced(!showAdvanced)}>
          <Text style={styles.advancedTitle}>Advanced Settings</Text>
          <Ionicons
            name={showAdvanced ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={AppColors.textMedium}
          />
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.advancedBody}>
            {/* Visibility Selection */}
            <View style={styles.settingsRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.settingsLabel}>Who can view this?</Text>
                <Text style={styles.settingsSub}>Choose story visibility level</Text>
              </View>
              <View style={styles.visibilityOptions}>
                {(['public', 'friends', 'custom'] as const).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.visibilityBtn, visibility === lvl && styles.visibilityBtnActive]}
                    onPress={() => setVisibility(lvl)}
                  >
                    <Text style={[styles.visibilityText, visibility === lvl && styles.visibilityTextActive]}>
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {visibility === 'custom' && (
              <>
                <View style={styles.settingsRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.settingsLabel}>Allowed Users</Text>
                    <Text style={styles.settingsSub}>Comma-separated usernames/IDs who CAN see this</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { flex: 1, height: 38 }]}
                    placeholder="e.g. alice, bob"
                    placeholderTextColor={AppColors.textLight}
                    value={audienceAllowed}
                    onChangeText={setAudienceAllowed}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.settingsRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.settingsLabel}>Blocked Users</Text>
                    <Text style={styles.settingsSub}>Comma-separated usernames/IDs who CANNOT see this</Text>
                  </View>
                  <TextInput
                    style={[styles.textInput, { flex: 1, height: 38 }]}
                    placeholder="e.g. charlie"
                    placeholderTextColor={AppColors.textLight}
                    value={audienceBlocked}
                    onChangeText={setAudienceBlocked}
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}

            {/* Switches */}
            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.settingsLabel}>Allow Replies</Text>
                <Text style={styles.settingsSub}>Allow viewers to comment on story</Text>
              </View>
              <Switch
                value={allowComments}
                onValueChange={setAllowComments}
                trackColor={{ false: '#D1D5DB', true: AppColors.primaryLight }}
                thumbColor={allowComments ? AppColors.primary : '#F4F3F0'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.settingsLabel}>Allow Reactions</Text>
                <Text style={styles.settingsSub}>Allow quick emoji responses</Text>
              </View>
              <Switch
                value={allowReactions}
                onValueChange={setAllowReactions}
                trackColor={{ false: '#D1D5DB', true: AppColors.primaryLight }}
                thumbColor={allowReactions ? AppColors.primary : '#F4F3F0'}
              />
            </View>

            <View style={styles.settingsRow}>
              <View>
                <Text style={styles.settingsLabel}>Save as Draft</Text>
                <Text style={styles.settingsSub}>Save locally without publishing</Text>
              </View>
              <Switch
                value={isDraft}
                onValueChange={setIsDraft}
                trackColor={{ false: '#D1D5DB', true: AppColors.primaryLight }}
                thumbColor={isDraft ? AppColors.primary : '#F4F3F0'}
              />
            </View>
          </View>
        )}

        {/* Submit Card */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Share Story</Text>
              <Ionicons name="send" size={16} color="white" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/*  Video Trimmer Modal */}
      {trimModalVisible && trimmingMedia && (
        <Modal
          visible={trimModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setTrimModalVisible(false);
            setTrimmingMedia(null);
            trimPreviewPlayer.pause();
          }}
        >
          <View style={styles.trimModalOverlay}>
            <View style={styles.trimModalContent}>
              <View style={styles.trimModalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={20} color={AppColors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.trimModalTitle}> Smart Cut Trimmer</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTrimModalVisible(false);
                    setTrimmingMedia(null);
                    trimPreviewPlayer.pause();
                  }}
                >
                  <Ionicons name="close" size={24} color={AppColors.textDark} />
                </TouchableOpacity>
              </View>

              <Text style={styles.trimModalSubtitle}>
                Your video is {trimmingMedia.duration}s. Ekenox requires story videos to be max 20s. Select one of our AI-generated highlights:
              </Text>

              {/* Video Preview */}
              <View style={styles.trimVideoPreviewContainer}>
                <VideoView
                  player={trimPreviewPlayer}
                  style={styles.trimVideoPreview}
                  contentFit="cover"
                  nativeControls={false}
                />
                <View style={styles.trimPlayingBadge}>
                  <Text style={styles.trimPlayingText}>
                    Previewing: {Math.round(currentTime * 10) / 10}s
                  </Text>
                </View>
              </View>

              {/* Cuts List */}
              <ScrollView style={styles.cutsList} showsVerticalScrollIndicator={false}>
                {getAiCuts(trimmingMedia.duration).map((cut, idx) => {
                  const isSelected = selectedCutIndex === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.cutItem, isSelected && styles.cutItemActive]}
                      onPress={() => {
                        setSelectedCutIndex(idx);
                        (trimPreviewPlayer as any).seekTo(cut.start);
                        trimPreviewPlayer.play();
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cutNameLabel, isSelected && styles.cutNameActive]}>
                          {cut.name}
                        </Text>
                        <Text style={styles.cutTime}>
                          Segment: {cut.start}s - {cut.end}s (Duration: 20s)
                        </Text>
                      </View>
                      <View style={[styles.cutIndicator, isSelected && styles.cutIndicatorActive]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Actions */}
              <TouchableOpacity style={styles.applyTrimBtn} onPress={handleApplyTrim}>
                <Ionicons name="cut-outline" size={18} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.applyTrimBtnText}>Apply  Cut</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: {
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  headerSubmit: {
    backgroundColor: AppColors.primary + '15',
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  headerSubmitText: {
    color: AppColors.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 60,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: AppColors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  tabTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  pickerContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'stretch',
    marginBottom: 16,
  },
  pickButton: {
    borderWidth: 2,
    borderColor: AppColors.primary + '40',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary + '03',
  },
  pickButtonInner: {
    alignItems: 'center',
  },
  pickTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginTop: 10,
  },
  pickSubtitle: {
    fontSize: 12,
    color: AppColors.textMedium,
    marginTop: 4,
    textAlign: 'center',
  },
  previewContainer: {
    position: 'relative',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  mediaBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  trimWarning: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trimWarningText: {
    color: '#D97706',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  carouselLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 12,
  },
  slideList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slideThumbnailContainer: {
    position: 'relative',
    width: (width - 64 - 24) / 3,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  slideThumbnail: {
    width: '100%',
    height: '100%',
  },
  slideBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: AppColors.primary,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  slideTrimDot: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#D97706',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSlideBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  addSlideBtn: {
    width: (width - 64 - 24) / 3,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: AppColors.primary + '40',
    borderStyle: 'dashed',
    backgroundColor: AppColors.primary + '03',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlideText: {
    fontSize: 10,
    color: AppColors.primary,
    fontWeight: 'bold',
    marginTop: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: AppColors.primary + '08',
    padding: 10,
    borderRadius: 10,
    marginTop: 14,
    alignItems: 'center',
    gap: 6,
  },
  infoBannerText: {
    fontSize: 11,
    color: AppColors.primary,
    flex: 1,
    lineHeight: 15,
  },
  inputsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
    marginBottom: 4,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: AppColors.textDark,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  rowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 44,
  },
  inputIcon: {
    marginRight: 8,
  },
  iconedInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textDark,
  },
  advancedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  advancedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textDark,
  },
  advancedBody: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingsLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  settingsSub: {
    fontSize: 11,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  visibilityBtnActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  visibilityText: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMedium,
  },
  visibilityTextActive: {
    color: 'white',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: AppColors.primary,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 10,
  },
  submitBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  musicSection: {
    marginBottom: 16,
  },
  musicDropdown: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 8,
    marginTop: 6,
    gap: 6,
  },
  musicTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  musicTrackItemActive: {
    backgroundColor: AppColors.primary + '10',
    borderWidth: 1,
    borderColor: AppColors.primary + '50',
  },
  musicIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicTrackTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  musicTrackSinger: {
    fontSize: 10,
    color: AppColors.textMedium,
    marginTop: 1,
  },
  previewBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAudioSection: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 10,
  },
  customAudioLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  audioPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  audioPickBtnText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  customAudioMeta: {
    marginTop: 10,
    gap: 8,
  },
  customAudioInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: 'white',
  },
  audioUploadConfirmBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  audioUploadConfirmText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },

  aiAnalyzerCard: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  aiAnalyzerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  aiAnalyzerTitle: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  aiAnalyzerBody: {
    padding: 12,
  },
  aiAnalyzerStatus: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  aiAnalyzerRule: {
    color: '#E0F2FE',
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
  },
  aiCutAppliedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiCutAppliedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  trimModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  trimModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  trimModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trimModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  trimModalSubtitle: {
    fontSize: 12,
    color: AppColors.textMedium,
    lineHeight: 16,
    marginBottom: 14,
  },
  trimVideoPreviewContainer: {
    height: 180,
    backgroundColor: 'black',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  trimVideoPreview: {
    width: '100%',
    height: '100%',
  },
  trimPlayingBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  trimPlayingText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cutsList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  cutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  cutItemActive: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary + '08',
  },
  cutNameLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  cutNameActive: {
    color: AppColors.primary,
  },
  cutTime: {
    fontSize: 10,
    color: AppColors.textMedium,
    marginTop: 2,
  },
  cutIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutIndicatorActive: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary,
  },
  applyTrimBtn: {
    backgroundColor: AppColors.primary,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyTrimBtnText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  slideEditorCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  slideEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slideEditorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: AppColors.textDark,
  },
  editorField: {
    marginBottom: 12,
  },
  editorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  editorInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: 'white',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionPillActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  optionPillText: {
    fontSize: 11,
    color: '#4B5563',
  },
  optionPillTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  stickerOptionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerOptionBtnActive: {
    borderColor: AppColors.primary,
    borderWidth: 2,
    backgroundColor: '#ECFDF5',
  },
  doneBtn: {
    backgroundColor: '#374151',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
});
