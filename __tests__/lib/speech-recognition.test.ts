const mockSpeechModule = {
  isRecognitionAvailable: jest.fn().mockReturnValue(true),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
};

function loadModuleWithMock(moduleValue: unknown): typeof import('@/lib/speech-recognition') {
  let mod: typeof import('@/lib/speech-recognition') | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo', () => ({
      requireOptionalNativeModule: jest.fn(() => moduleValue),
    }));
    mod = require('@/lib/speech-recognition');
  });
  if (!mod) throw new Error('Module failed to load');
  return mod;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSpeechModule.isRecognitionAvailable.mockReturnValue(true);
  mockSpeechModule.requestPermissionsAsync.mockResolvedValue({ granted: true });
});

describe('speech-recognition (module available)', () => {
  let speechLib: ReturnType<typeof loadModuleWithMock>;

  beforeEach(() => {
    speechLib = loadModuleWithMock(mockSpeechModule);
  });

  describe('isRecognitionAvailable', () => {
    it('should return true when recognition is available', () => {
      expect(speechLib.isRecognitionAvailable()).toBe(true);
      expect(mockSpeechModule.isRecognitionAvailable).toHaveBeenCalled();
    });

    it('should return false when recognition is not available', () => {
      mockSpeechModule.isRecognitionAvailable.mockReturnValue(false);
      expect(speechLib.isRecognitionAvailable()).toBe(false);
    });

    it('should return false when module throws', () => {
      mockSpeechModule.isRecognitionAvailable.mockImplementation(() => {
        throw new Error('fail');
      });
      expect(speechLib.isRecognitionAvailable()).toBe(false);
    });
  });

  describe('requestPermissions', () => {
    it('should return true when granted', async () => {
      const result = await speechLib.requestPermissions();
      expect(result).toBe(true);
      expect(mockSpeechModule.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false when denied', async () => {
      mockSpeechModule.requestPermissionsAsync.mockResolvedValue({ granted: false });
      const result = await speechLib.requestPermissions();
      expect(result).toBe(false);
    });
  });

  describe('startRecognition', () => {
    it('should call SpeechModule.start with options', () => {
      const options = { lang: 'en-US', interimResults: true, addsPunctuation: true };
      speechLib.startRecognition(options);
      expect(mockSpeechModule.start).toHaveBeenCalledWith(options);
    });
  });

  describe('stopRecognition', () => {
    it('should call SpeechModule.stop', () => {
      speechLib.stopRecognition();
      expect(mockSpeechModule.stop).toHaveBeenCalled();
    });
  });

  describe('abortRecognition', () => {
    it('should call SpeechModule.abort', () => {
      speechLib.abortRecognition();
      expect(mockSpeechModule.abort).toHaveBeenCalled();
    });
  });

  describe('getNativeModule', () => {
    it('should return the native module', () => {
      expect(speechLib.getNativeModule()).toBe(mockSpeechModule);
    });
  });

  describe('hasNativeModule', () => {
    it('should return true', () => {
      expect(speechLib.hasNativeModule()).toBe(true);
    });
  });
});

describe('speech-recognition (module null)', () => {
  let speechLib: ReturnType<typeof loadModuleWithMock>;

  beforeEach(() => {
    speechLib = loadModuleWithMock(null);
  });

  it('isRecognitionAvailable returns false', () => {
    expect(speechLib.isRecognitionAvailable()).toBe(false);
  });

  it('requestPermissions returns false', async () => {
    expect(await speechLib.requestPermissions()).toBe(false);
  });

  it('startRecognition does not throw', () => {
    expect(() => speechLib.startRecognition({ lang: 'en-US' })).not.toThrow();
  });

  it('stopRecognition does not throw', () => {
    expect(() => speechLib.stopRecognition()).not.toThrow();
  });

  it('abortRecognition does not throw', () => {
    expect(() => speechLib.abortRecognition()).not.toThrow();
  });

  it('getNativeModule returns null', () => {
    expect(speechLib.getNativeModule()).toBeNull();
  });

  it('hasNativeModule returns false', () => {
    expect(speechLib.hasNativeModule()).toBe(false);
  });
});
