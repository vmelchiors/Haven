export type CommunityStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ChannelType = 'TEXT' | 'VOICE';
export type PresenceStatus = 'online' | 'idle' | 'busy' | 'offline';

export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  is_admin: boolean;
  accepted_tos_version?: string;
  security_question?: string;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface Channel {
  id: string;
  community_id: string;
  name: string;
  type: ChannelType;
  position: number;
}

export interface Community {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  receipt_file_path?: string;
  donation_amount: number; // in cents: 1500 = R$ 15,00
  owner_id: string;
  owner_username?: string;
  status: CommunityStatus;
  rejection_reason?: string;
  is_private?: boolean;
  invite_code?: string;
  created_at: string;
  updated_at?: string;
  channels?: Channel[];
}

export interface Message {
  id: string;
  channel_id: string;
  community_id?: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  content: string;
  created_at: string;
}

export interface PixDonation {
  payload: string;
  qr_code_base64: string;
  pix_key: string;
  merchant_name: string;
  merchant_city: string;
  currency: string;
  description: string;
  amount?: number;
}

export interface UserPresence {
  user_id: string;
  username: string;
  status: PresenceStatus;
  avatar_url?: string;
}

export interface RTCTokenResponse {
  token: string;
  url: string;
  room_name: string;
}

export interface VoiceParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  audioLevel: number;
  cameraTrack?: MediaStreamTrack;
  screenTrack?: MediaStreamTrack;
  mediaStream?: MediaStream;
}

export interface VoiceChannelUser {
  user_id: string;
  username: string;
  channel_id: string;
  is_speaking?: boolean;
  is_muted?: boolean;
  is_deafened?: boolean;
  is_camera_on?: boolean;
  is_screen_sharing?: boolean;
}

export interface AudioDevice {
  id: string;
  name: string;
  is_default?: boolean;
  deviceId?: string;
  label?: string;
}

export interface WSMessage<T = any> {
  type: string;
  channel_id?: string;
  payload?: T;
}

export type FeedbackType = 'BUG' | 'SUGGESTION';

export type FeedbackStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface Feedback {
  id: string;
  user_id: string;
  username?: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  admin_notes?: string;
  created_at: string;
  updated_at?: string;
}

