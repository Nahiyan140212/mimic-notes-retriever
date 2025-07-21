
interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaLLMService {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl: string = 'http://localhost:11434', defaultModel: string = 'llama3.2:latest') {
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  // Allow dynamic URL updates
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    console.log('🔧 OllamaLLM: Base URL updated to:', this.baseUrl);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async generateStructuredResponse(
    query: string, 
    similarRecords: any[], 
    model: string = this.defaultModel
  ): Promise<string> {
    console.log('🤖 OllamaLLM: Starting structured response generation...');
    console.log('🤖 OllamaLLM: Using base URL:', this.baseUrl);
    console.log('🤖 OllamaLLM: Using model:', model);
    console.log('🤖 OllamaLLM: Processing', similarRecords.length, 'records');

    const contextSections = similarRecords.map((record, index) => {
      return `
**Clinical Record ${index + 1}** (Similarity: ${(record.similarity_score * 100).toFixed(1)}%)
- Patient ID: ${record.subject_id}
- Hospital Admission: ${record.hadm_id}
- Chart Date: ${record.charttime}
- Clinical Notes: ${record.cleaned_text}
      `.trim();
    }).join('\n\n');

    const systemPrompt = `You are an expert clinical data analyst specializing in medical record analysis from the MIMIC-IV database. Your task is to analyze clinical records and provide comprehensive, well-structured responses.

CRITICAL RESPONSE REQUIREMENTS:
1. **Always provide a complete, structured analysis**
2. **Use clear headings and sections for organization**
3. **Focus on medical insights and clinical relevance**
4. **Reference specific records with evidence**
5. **Provide comprehensive analysis (aim for 1000-1500 tokens)**
6. **Use professional medical terminology while remaining accessible**

REQUIRED RESPONSE STRUCTURE:
- **Clinical Query Analysis**: Brief overview of the question
- **Key Medical Findings**: Important clinical observations from the records
- **Evidence-Based Analysis**: Detailed examination of each relevant record
- **Clinical Patterns & Insights**: Trends and correlations across cases
- **Professional Summary**: Comprehensive clinical interpretation
- **Additional Considerations**: Relevant medical context or recommendations

Ensure your response is thorough, well-organized, and provides maximum clinical value.`;

    const userPrompt = `
**Clinical Query**: ${query}

**Available Clinical Evidence**: I have retrieved ${similarRecords.length} relevant clinical records with similarity scores ranging from ${(similarRecords[0]?.similarity_score * 100).toFixed(1)}% to ${(similarRecords[similarRecords.length - 1]?.similarity_score * 100).toFixed(1)}%.

**Clinical Records for Analysis**:
${contextSections}

Please provide a comprehensive, structured clinical analysis of these records in relation to the query. Focus on extracting relevant medical information, identifying patterns, and providing professional clinical insights. Ensure your response is complete and well-organized with clear sections.`;

    try {
      console.log('🤖 OllamaLLM: Sending request to Ollama API...');
      console.log('🤖 OllamaLLM: URL:', `${this.baseUrl}/api/chat`);
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user', 
              content: userPrompt
            }
          ],
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 1500,  // Increased for more comprehensive responses
            stop: ['<|end|>', '</response>', '<|endoftext|>']
          },
          stream: false
        })
      });

      console.log('🤖 OllamaLLM: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🤖 OllamaLLM: API error response:', errorText);
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: OllamaResponse = await response.json();
      console.log('🤖 OllamaLLM: Response data structure:', {
        hasMessage: !!data.message,
        hasContent: !!data.message?.content,
        contentLength: data.message?.content?.length || 0,
        model: data.model,
        done: data.done
      });
      
      if (data.message && data.message.content) {
        console.log('✅ OllamaLLM: Successfully generated response');
        console.log('📝 OllamaLLM: Response preview:', data.message.content.substring(0, 200) + '...');
        return data.message.content;
      } else {
        console.error('🤖 OllamaLLM: Invalid response structure:', data);
        throw new Error('Invalid response format from Ollama - missing message content');
      }

    } catch (error) {
      console.error('❌ OllamaLLM: Generation failed:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('❌ OllamaLLM: Network error - this is likely a CORS issue or Ollama is not accessible');
        const isNgrok = this.baseUrl.includes('ngrok');
        throw new Error(`Cannot connect to Ollama service at ${this.baseUrl} - ${isNgrok ? 'ensure ngrok tunnel is running and URL is correct' : 'ensure Ollama is running and accessible'}`);
      }
      
      throw new Error(`Failed to generate LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      console.log('🔌 OllamaLLM: Checking connection to', this.baseUrl);
      console.log('🔌 OllamaLLM: Attempting to fetch /api/tags endpoint...');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for ngrok
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const isConnected = response.ok;
      console.log('🔌 OllamaLLM: Connection result:', isConnected);
      console.log('🔌 OllamaLLM: Response status:', response.status);
      
      if (!isConnected) {
        console.error('🔌 OllamaLLM: Connection failed with status:', response.status);
        console.error('🔌 OllamaLLM: Response text:', await response.text().catch(() => 'Could not read response'));
      }
      
      return isConnected;
    } catch (error) {
      console.error('🔌 OllamaLLM: Connection check failed:', error);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('🔌 OllamaLLM: Connection timeout - Ollama may be slow or not responding');
        } else if (error.message.includes('Failed to fetch')) {
          const isNgrok = this.baseUrl.includes('ngrok');
          console.error('🔌 OllamaLLM: Network error -', isNgrok ? 'ngrok tunnel may be down or URL incorrect' : 'likely CORS issue or Ollama not running');
          
          if (isNgrok) {
            console.error('🔌 OllamaLLM: Make sure ngrok tunnel is running: ngrok http 11434');
            console.error('🔌 OllamaLLM: And Ollama is running: ollama serve');
          } else {
            console.error('🔌 OllamaLLM: Make sure Ollama is running with: ollama serve');
            console.error('🔌 OllamaLLM: And configure CORS if needed');
          }
        }
      }
      
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        return data.models?.map((model: any) => model.name) || [];
      }
      return [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }
}

export const ollamaLLMService = new OllamaLLMService();
