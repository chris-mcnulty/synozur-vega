function parseIp(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  
  const nums = parts.map(p => parseInt(p, 10));
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  
  return nums;
}

function ipToNumber(ip: string): number | null {
  const parts = parseIp(ip);
  if (!parts) return null;
  
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}

function cidrToRange(cidr: string): { start: number; end: number } | null {
  const [ipPart, prefixPart] = cidr.split('/');
  
  const ip = ipToNumber(ipPart);
  if (ip === null) return null;
  
  const prefix = prefixPart ? parseInt(prefixPart, 10) : 32;
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;
  
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const start = (ip & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  
  return { start, end };
}

export function isIpInRange(clientIp: string, allowedEntry: string): boolean {
  const cleanIp = clientIp.trim();
  const cleanEntry = allowedEntry.trim();
  
  if (cleanIp === cleanEntry) {
    return true;
  }
  
  const clientIpNum = ipToNumber(cleanIp);
  if (clientIpNum === null) {
    return false;
  }
  
  if (cleanEntry.includes('/')) {
    const range = cidrToRange(cleanEntry);
    if (!range) return false;
    
    const clientNum = clientIpNum >>> 0;
    return clientNum >= range.start && clientNum <= range.end;
  }
  
  const entryIpNum = ipToNumber(cleanEntry);
  return entryIpNum !== null && clientIpNum === entryIpNum;
}

export function isIpAllowed(clientIp: string, allowedIps: string[] | null): boolean {
  if (!allowedIps || allowedIps.length === 0) {
    return true;
  }
  
  return allowedIps.some(allowed => isIpInRange(clientIp, allowed));
}

export function validateIpFormat(ip: string): boolean {
  const trimmed = ip.trim();
  
  if (trimmed.includes('/')) {
    const [ipPart, prefixPart] = trimmed.split('/');
    if (!parseIp(ipPart)) return false;
    const prefix = parseInt(prefixPart, 10);
    return !isNaN(prefix) && prefix >= 0 && prefix <= 32;
  }
  
  return parseIp(trimmed) !== null;
}

export function normalizeClientIp(rawIp: string): string {
  let ip = rawIp.trim();
  
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  return ip;
}
