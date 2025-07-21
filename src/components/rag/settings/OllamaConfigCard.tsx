
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Cpu, CheckCircle, XCircle, AlertCircle, Globe, Home, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ollamaLLMService } from '@/services/ollamaLLM';
import { useOllamaConfig } from '@/hooks/useOllamaConfig';

interface OllamaConfigCardProps {
  ollamaUrl: string;
  embeddingModel: string;
  llmModel: string;
  onOllamaUrlChange: (url: string) => void;
  onEmbeddingModelChange: (model: string) => void;
  onLlmModelChange: (model: string) => void;
}

export const OllamaConfigCard = ({
  ollamaUrl,
  embeddingModel,
  llmModel,
  onOllamaUrlChange,
  onEmbeddingModelChange,
  onLlmModelChange
}: OllamaConfigCardProps) => {
  const { toast } = useToast();
  const ollamaConfig = useOllamaConfig();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'failed' | 'testing'>('idle');

  // Available models from your Ollama instance
  const embeddingModels = ['nomic-embed-text:latest'];
  const llmModels = [
    'llama3.2:latest',
    'llama3.1:8b', 
    'mistral:latest',
    'summarizer:latest',
    'gemma'
  ];

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('testing');
    
    console.log('🔧 OllamaConfigCard: Testing connection to:', ollamaUrl);
    
    toast({
      title: "Testing connection...",
      description: "Checking Ollama availability at " + ollamaUrl,
    });

    try {
      const isConnected = await ollamaLLMService.checkConnection();
      
      if (isConnected) {
        setConnectionStatus('connected');
        toast({
          title: "Connection successful",
          description: "Ollama is running and accessible",
        });
      } else {
        setConnectionStatus('failed');
        toast({
          title: "Connection failed",
          description: ollamaConfig.config.isProduction 
            ? "Could not connect to Ollama. Check your ngrok tunnel is running."
            : "Could not connect to Ollama. Make sure it's running with 'ollama serve'",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('🔧 OllamaConfigCard: Connection test error:', error);
      setConnectionStatus('failed');
      toast({
        title: "Connection error",
        description: "Network error or CORS issue. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleNgrokUrlUpdate = (url: string) => {
    if (ollamaConfig.updateNgrokUrl(url)) {
      // If auto-detect is on and we're in production, update the current URL too
      if (ollamaConfig.config.autoDetectUrl && ollamaConfig.config.isProduction) {
        onOllamaUrlChange(url);
      }
    }
  };

  const handleUrlModeChange = (useRecommended: boolean) => {
    if (useRecommended) {
      const recommendedUrl = ollamaConfig.getRecommendedUrl();
      onOllamaUrlChange(recommendedUrl);
      ollamaConfig.updateCurrentUrl(recommendedUrl);
    }
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'testing':
        return <AlertCircle className="h-4 w-4 text-yellow-600 animate-pulse" />;
      default:
        return null;
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'failed':
        return 'Connection Failed';
      case 'testing':
        return 'Testing...';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" />
          Ollama Configuration
        </CardTitle>
        <CardDescription>
          Configure your local Ollama instance for embeddings and LLM inference
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environment Detection */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {ollamaConfig.config.isProduction ? (
              <Globe className="h-4 w-4 text-blue-600" />
            ) : (
              <Home className="h-4 w-4 text-blue-600" />
            )}
            <h4 className="text-sm font-medium text-blue-900">
              Environment: {ollamaConfig.config.isProduction ? 'Production (Deployed)' : 'Development (Local)'}
            </h4>
          </div>
          <p className="text-xs text-blue-800">
            {ollamaConfig.config.isProduction 
              ? 'You\'re running on a deployed site. Use ngrok to tunnel to your local Ollama instance.'
              : 'You\'re running locally. You can connect directly to localhost Ollama.'
            }
          </p>
        </div>

        {/* ngrok Configuration for Production */}
        {ollamaConfig.config.isProduction && (
          <div className="space-y-3">
            <Label htmlFor="ngrok-url" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              ngrok Public URL
            </Label>
            <Input
              id="ngrok-url"
              value={ollamaConfig.config.ngrokUrl}
              onChange={(e) => handleNgrokUrlUpdate(e.target.value)}
              placeholder="https://abc123.ngrok.io"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Start ngrok tunnel: <code>ngrok http 11434</code></p>
              <p>• Copy the HTTPS URL from ngrok output</p>
              <p>• Make sure Ollama is running: <code>ollama serve</code></p>
            </div>
          </div>
        )}

        {/* Auto URL Detection */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Auto-detect URL</Label>
            <p className="text-xs text-muted-foreground">
              Automatically use {ollamaConfig.config.isProduction ? 'ngrok URL' : 'localhost'} based on environment
            </p>
          </div>
          <Switch
            checked={ollamaConfig.config.autoDetectUrl}
            onCheckedChange={(checked) => {
              ollamaConfig.toggleAutoDetect(checked);
              handleUrlModeChange(checked);
            }}
          />
        </div>

        {/* Manual URL Configuration */}
        <div className="space-y-2">
          <Label htmlFor="ollama-url">Current Ollama URL</Label>
          <div className="flex gap-2">
            <Input
              id="ollama-url"
              value={ollamaUrl}
              onChange={(e) => {
                onOllamaUrlChange(e.target.value);
                ollamaConfig.updateCurrentUrl(e.target.value);
              }}
              placeholder={ollamaConfig.config.isProduction ? "https://abc123.ngrok.io" : "http://localhost:11434"}
              disabled={ollamaConfig.config.autoDetectUrl}
            />
            <Button 
              onClick={handleTestConnection} 
              variant="outline" 
              disabled={isTestingConnection}
              className="flex items-center gap-2"
            >
              {getConnectionIcon()}
              {isTestingConnection ? 'Testing...' : 'Test'}
            </Button>
          </div>
          
          {ollamaConfig.config.autoDetectUrl && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              URL is automatically managed based on environment
            </div>
          )}

          {connectionStatus !== 'idle' && (
            <div className={`text-sm flex items-center gap-2 ${
              connectionStatus === 'connected' ? 'text-green-600' : 
              connectionStatus === 'failed' ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {getConnectionIcon()}
              {getConnectionStatusText()}
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="embedding-model">Embedding Model</Label>
            <Select value={embeddingModel} onValueChange={onEmbeddingModelChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                {embeddingModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for converting text to vector embeddings
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llm-model">LLM Model</Label>
            <Select value={llmModel} onValueChange={onLlmModelChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                {llmModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for generating responses and analysis
            </p>
          </div>
        </div>

        {/* Troubleshooting Guide */}
        <div className="p-3 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            {ollamaConfig.config.isProduction ? 'Production Setup Guide:' : 'Development Setup Guide:'}
          </h4>
          
          {ollamaConfig.config.isProduction ? (
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Install ngrok: <code>brew install ngrok</code> or download from ngrok.com</li>
              <li>• Start Ollama: <code>ollama serve</code></li>
              <li>• Create tunnel: <code>ngrok http 11434</code></li>
              <li>• Copy the HTTPS URL (e.g., https://abc123.ngrok.io)</li>
              <li>• Paste the URL above and test the connection</li>
            </ul>
          ) : (
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Ensure Ollama is running: <code>ollama serve</code></li>
              <li>• Check if models are installed: <code>ollama list</code></li>
              <li>• Verify the URL is correct (usually http://localhost:11434)</li>
              <li>• For CORS issues, restart Ollama and try again</li>
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
