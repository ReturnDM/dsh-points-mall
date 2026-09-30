/** 校验 shop.json（兼容旧数组格式与新 { items: [...] } 格式）；通过则返回商品数组 */
export function parseShop(data: any): any[];
/** 校验 tasks.json（tiers 严格递增 + tasks 列表）；通过则返回原对象 */
export function parsePricing(data: any): any;
