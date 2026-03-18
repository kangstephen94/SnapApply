export interface JobApp {
  id: string;
  company: string;
  role: string;
  url: string;
  location: string;
  status: string;
  notes: string;
  date: string;
}

export interface StatusInfo {
  color: string;
  bg: string;
  icon: string;
}

export interface FeedbackMessage {
  ok: boolean;
  msg: string;
}
