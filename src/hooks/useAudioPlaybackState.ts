import { useEffect, useState } from 'react';
import {
  getActiveAudioPlayback,
  getAudioButtonVisualState,
  subscribeAudioPlayback,
  type ActiveAudioPlayback,
  type AudioButtonMatchQuery,
} from '../services/platform/speechService';

export function useAudioPlaybackState() {
  const [activeAudio, setActiveAudio] = useState<ActiveAudioPlayback | null>(() =>
    getActiveAudioPlayback()
  );

  useEffect(() => subscribeAudioPlayback(setActiveAudio), []);

  return {
    activeAudio,
    getButtonState: (query: AudioButtonMatchQuery) =>
      getAudioButtonVisualState(activeAudio, query),
  };
}
