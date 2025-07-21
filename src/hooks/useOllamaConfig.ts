
import { useState, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";

interface OllamaConfig {
  currentUrl: string;
  localhostUrl: string;
  ngrokUrl: string;
  isProduction: boolean;
  autoDetectUrl: boolean;
}

export const useOllamaConfig = () => {
  const { toast } = useToast();
  
  // Check if we're in production (deployed) environment
  const isProduction = window.location.hostname !== 'localhost';
  
  const [config, setConfig] = useState<OllamaConfig>({
    currentUrl: isProduction ? '' : 'http://localhost:11434',
    localhostUrl: 'http://localhost:11434',
    ngrokUrl: '',
    isProduction,
    autoDetectUrl: true
  });

  // Load saved configuration from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('ollama-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(prev => ({
          ...prev,
          ...parsed,
          isProduction // Always use current environment detection
        }));
      } catch (error) {
        console.error('Failed to parse saved Ollama config:', error);
      }
    }
  }, [isProduction]);

  // Save configuration to localStorage
  const saveConfig = useCallback((newConfig: Partial<OllamaConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    localStorage.setItem('ollama-config', JSON.stringify(updatedConfig));
  }, [config]);

  // Auto-select URL based on environment
  const getRecommendedUrl = useCallback(() => {
    if (config.autoDetectUrl) {
      return config.isProduction 
        ? (config.ngrokUrl || 'https://your-ngrok-url.ngrok.io')
        : config.localhostUrl;
    }
    return config.currentUrl;
  }, [config]);

  // Update current URL
  const updateCurrentUrl = useCallback((url: string) => {
    saveConfig({ currentUrl: url });
  }, [saveConfig]);

  // Update ngrok URL
  const updateNgrokUrl = useCallback((url: string) => {
    // Validate ngrok URL format
    if (url && !url.includes('ngrok.io') && !url.includes('ngrok-free.app')) {
      toast({
        title: "Invalid ngrok URL",
        description: "Please enter a valid ngrok URL (e.g., https://abc123.ngrok.io)",
        variant: "destructive",
      });
      return false;
    }
    
    saveConfig({ 
      ngrokUrl: url,
      ...(config.autoDetectUrl && config.isProduction && { currentUrl: url })
    });
    return true;
  }, [saveConfig, config, toast]);

  // Toggle auto-detection
  const toggleAutoDetect = useCallback((enabled: boolean) => {
    const newConfig = { autoDetectUrl: enabled };
    if (enabled) {
      newConfig.currentUrl = getRecommendedUrl();
    }
    saveConfig(newConfig);
  }, [saveConfig, getRecommendedUrl]);

  return {
    config,
    updateCurrentUrl,
    updateNgrokUrl,
    toggleAutoDetect,
    getRecommendedUrl,
    saveConfig
  };
};
