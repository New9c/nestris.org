export interface BrowserConfig {
    requireOCRVerifier: boolean,
    allowOCRMidGameStart: boolean,
}

const ProductionConfig: BrowserConfig = {
    requireOCRVerifier: false,
    allowOCRMidGameStart: false,
}

const OCRMidGameTestConfig: BrowserConfig = {
    requireOCRVerifier: false,
    allowOCRMidGameStart: true
}

export const CONFIG = ProductionConfig;