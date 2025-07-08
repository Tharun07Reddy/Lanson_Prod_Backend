/**
 * Utility function to mask sensitive data in logs
 */

/**
 * Masks sensitive information in a string
 * @param text Text that might contain sensitive information
 * @returns Text with sensitive information masked
 */
export function maskSensitiveData(text: string): string {
  if (!text) return text;

  // Mask patterns for different types of sensitive data
  const patterns = [
    // OTP patterns (4-8 digits)
    { 
      regex: /\b([Oo][Tt][Pp]|[Cc][Oo][Dd][Ee]|verification code|verify code|security code)(\s*:?\s*|\s+is\s+)(\d{4,8})\b/gi, 
      replacer: (match: string, p1: string, p2: string, p3: string) => `${p1}${p2}${'*'.repeat(p3.length)}` 
    },
    
    // OTP in message body (standalone 4-8 digits that look like OTPs)
    { 
      regex: /\b(\d{4,8})\b(?=\s*(?:is your|as your|for your|to verify|to authenticate|verification))/gi, 
      replacer: (match: string) => '*'.repeat(match.length) 
    },
    
    // Credit card numbers
    { 
      regex: /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g, 
      replacer: (match: string) => '*'.repeat(match.length) 
    },
    
    // Passwords in JSON or key-value pairs
    { 
      regex: /("password"\s*:\s*")([^"]+)(")/gi, 
      replacer: (match: string, p1: string, p2: string, p3: string) => `${p1}${'*'.repeat(p2.length)}${p3}` 
    },
    { 
      regex: /(password=)([^&\s]+)/gi, 
      replacer: (match: string, p1: string, p2: string) => `${p1}${'*'.repeat(p2.length)}` 
    },
    
    // API keys and tokens
    { 
      regex: /\b([a-zA-Z0-9_-]{20,})\b/g, 
      replacer: (match: string) => `${match.substring(0, 4)}${'*'.repeat(match.length - 8)}${match.substring(match.length - 4)}` 
    },
  ];

  let maskedText = text;
  
  // Apply each pattern
  patterns.forEach(({ regex, replacer }) => {
    maskedText = maskedText.replace(regex, replacer as (substring: string, ...args: any[]) => string);
  });

  return maskedText;
}

/**
 * Masks sensitive information in an object
 * @param obj Object that might contain sensitive information
 * @param sensitiveKeys Keys to mask
 * @returns Object with sensitive information masked
 */
export function maskSensitiveObject<T extends Record<string, any>>(
  obj: T,
  sensitiveKeys: string[] = ['password', 'token', 'secret', 'otp', 'code', 'pin', 'cvv', 'cardNumber']
): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = { ...obj } as T;
  
  for (const key in result) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      // Check if this key should be masked
      const shouldMask = sensitiveKeys.some(sensitiveKey => 
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      );
      
      if (shouldMask && typeof result[key] === 'string') {
        // Mask the value
        const value = result[key] as string;
        if (value.length <= 4) {
          result[key] = '*'.repeat(value.length) as any;
        } else {
          result[key] = `${value.substring(0, 1)}${'*'.repeat(value.length - 2)}${value.substring(value.length - 1)}` as any;
        }
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        // Recursively mask nested objects
        result[key] = maskSensitiveObject(result[key], sensitiveKeys) as any;
      } else if (typeof result[key] === 'string') {
        // Check if string values contain sensitive data
        result[key] = maskSensitiveData(result[key] as string) as any;
      }
    }
  }
  
  return result;
} 