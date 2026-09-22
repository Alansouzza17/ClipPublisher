export type Platform = 'tiktok' | 'youtube';
export interface PublishMetadata { caption:string; mentions:string; hashtags:string; tiktokPrivacy?:string; disableComment?:boolean; disableDuet?:boolean; disableStitch?:boolean; }
export interface Token { accessToken:string; refreshToken?:string; expiryDate?:number; }
export interface PublicationResult { url?:string; pending?:boolean; publishId?:string; }
