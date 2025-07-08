import {
  AutoProcessor,
  AutoModelForVision2Seq,
  TextStreamer,
  InterruptableStoppingCriteria,
  RawImage,
} from "@huggingface/transformers";

const downloadTracker = {
    files: new Map<string, { loaded: number; total: number }>(),
    lastUpdateTime: 0,
    
    update(progress: { file: string; loaded: number; total: number }) {
        this.files.set(progress.file, { loaded: progress.loaded, total: progress.total });
    },

    calculateOverallProgress(): number {
        let totalLoaded = 0;
        const knownTotals = new Map<string, number>();

        for (const [file, progress] of this.files.entries()) {
            totalLoaded += progress.loaded;
            knownTotals.set(file, progress.total);
        }

        let totalSize = 0;
        for (const size of knownTotals.values()) {
            totalSize += size;
        }

        if (totalSize === 0) return 0;
        
        const overallProgress = (totalLoaded / totalSize) * 100;
        return Math.min(overallProgress, 100);
    },
    
    reset() {
        this.files.clear();
        this.lastUpdateTime = 0;
    }
};

async function checkCache() {
  const FILES = [
    'onnx/decoder_model_merged.onnx',
    'onnx/vision_encoder.onnx',
    'onnx/embed_tokens.onnx',
    'tokenizer.json'
  ];
  const BASE_URL = `https://huggingface.co/${SmolDocling.model_id}/resolve/main/`;

  try {
    const cacheKeys = await caches.keys();
    const transformersCacheName = cacheKeys.find(key => key.startsWith('transformers-cache'));

    if (!transformersCacheName) {
      self.postMessage({ status: 'cache-checked', isCached: false });
      return;
    }

    const cache = await caches.open(transformersCacheName);
    const promises = FILES.map(file => cache.match(BASE_URL + file));
    const responses = await Promise.all(promises);

    const isCached = responses.every(response => response && response.ok);
    self.postMessage({ status: 'cache-checked', isCached });

  } catch (e) {
    console.error("Error checking cache:", e);
    self.postMessage({ status: 'cache-checked', isCached: false });
  }
}

declare global {
  interface Navigator {
    gpu?: {
      requestAdapter: () => Promise<{
        features: {
          has: (feature: string) => boolean;
        }
      } | null>;
    };
  }
}

async function check() {
  try {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported on this browser");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU is not supported (no adapter found)");
    }
    adapter.features.has("shader-f16");
  } catch (e) {
    self.postMessage({
      status: "error",
      data: e instanceof Error ? e.toString() : "Unknown error",
    });
  }
}

class SmolDocling {
  static model_id = "ds4sd/SmolDocling-256M-preview";
  static processor: any;
  static model: any;

  static async getInstance(progress_callback?: (progress: any) => void) {
    const enhancedCallback = progress_callback ? 
      (progress: any) => {
        const enhancedProgress = { 
          ...progress, 
          component: progress.file?.includes('tokenizer') ? 'tokenizer' : 'model' 
        };
        progress_callback(enhancedProgress);
      } : undefined;

    this.processor ??= AutoProcessor.from_pretrained(this.model_id, {
      progress_callback: enhancedCallback,
    });

    this.model ??= AutoModelForVision2Seq.from_pretrained(this.model_id, {
      dtype: "fp32",
      device: "webgpu",
      progress_callback: enhancedCallback,
    });

    return Promise.all([this.processor, this.model]);
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();

async function generate(imageDataUrl: string, prompt = "Convert this page to docling.", stream = false) {
  try {
    const [processor, model] = await SmolDocling.getInstance();
    
    const image = await RawImage.fromURL(imageDataUrl);

    const messages = [
      {
        role: "user",
        content: [
          { type: "image" },
          { type: "text", text: prompt }
        ]
      }
    ];

    const text = processor.apply_chat_template(messages, {
      add_generation_prompt: true,
    });
    
    const inputs = await processor(text, [image], {
      do_image_splitting: true,
    });

    self.postMessage({ status: "start" });

    let startTime: number;
    let numTokens: number = 0;
    let tps: number | undefined;
    let accumulatedText = '';
    let lastUpdateTime = 0;
    
    const token_callback_function = (tokens: any[]) => {
      startTime ??= performance.now();
      
      if (stream && tokens.length > 0) {
        try {
          const now = performance.now();
          const tokenText = processor.tokenizer.decode(tokens, { skip_special_tokens: false });
        
          if (now - lastUpdateTime > 50) {
            lastUpdateTime = now;
            self.postMessage({
              status: "token",
              token: tokenText,
              tps: tps ? parseFloat(tps.toFixed(2)) : undefined,
              numTokens,
            });
          }
        } catch (error) {
          console.error("Token decoding error:", error);
        }
      }
  
      if (numTokens++ > 0) {
        tps = (numTokens / (performance.now() - startTime)) * 1000;
      }
    };
    
    const callback_function = (output: string) => {
      if (stream) {
        const newText = output.slice(accumulatedText.length);
        if (newText) {
          accumulatedText = output;
          self.postMessage({
            status: "token",
            token: newText,
            tps: tps ? parseFloat(tps.toFixed(2)) : undefined,
            numTokens,
          });
        }
      }
      
      self.postMessage({
        status: "update",
        output,
        tps: tps ? parseFloat(tps.toFixed(2)) : undefined,
        numTokens,
      });
    };
  
    const streamer = new TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      callback_function,
      token_callback_function,
    });

    const { sequences } = await model.generate({
      ...inputs,
      max_new_tokens: 8192,
      bos_token_id: processor.tokenizer.bos_token_id,
      streamer,
      stopping_criteria,
      return_dict_in_generate: true,
      do_sample: false,
    });
    
    const decoded = processor.batch_decode(sequences, {
      skip_special_tokens: false,
    });

    self.postMessage({
      status: "complete",
      output: decoded,
    });
  } catch (e) {
    self.postMessage({
      status: "error",
      data: e instanceof Error ? e.toString() : "Unknown error",
    });
  }
}

async function load() {
  self.postMessage({
    status: "loading",
    data: "Loading SmolDocling model...",
  });

  downloadTracker.reset();

  try {
    await SmolDocling.getInstance((progressData) => {
      if (progressData.status !== 'progress') {
        self.postMessage(progressData);
        return;
      }
        
      downloadTracker.update(progressData);

      const now = performance.now();
      if (now - downloadTracker.lastUpdateTime > 100) { // Throttle to 10fps
        const overallProgress = downloadTracker.calculateOverallProgress();
        self.postMessage({ status: 'progress', progress: overallProgress });
        downloadTracker.lastUpdateTime = now;
      }
    });

    const finalProgress = downloadTracker.calculateOverallProgress();
    self.postMessage({ status: 'progress', progress: finalProgress });
    self.postMessage({ status: "ready" });
  } catch (error) {
    console.error("Model loading error:", error);
    self.postMessage({
      status: "error",
      data: `Failed to load model: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case "check":
      check();
      break;
      
    case "check-cache":
      checkCache();
      break;

    case "load":
      load();
      break;

    case "generate":
      stopping_criteria.reset();
      generate(data.image, data.prompt, data.stream);
      break;

    case "interrupt":
      stopping_criteria.interrupt();
      break;

    case "reset":
      stopping_criteria.reset();
      break;
  }
}); 