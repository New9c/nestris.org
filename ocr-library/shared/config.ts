export interface BrowserConfig {
    requireOCRVerifier: boolean,
    allowOCRMidGameStart: boolean,
    allowBotMullen: boolean,
}

const ProductionConfig: BrowserConfig = {
    requireOCRVerifier: true, // should be true
    allowOCRMidGameStart: false, // should be false
    allowBotMullen: false, // should be false
}


export const CONFIG = ProductionConfig;