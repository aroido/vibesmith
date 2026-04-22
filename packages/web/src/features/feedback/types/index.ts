/**
 * Feedback feature types
 * Issue #710
 */

export type FeedbackCategory = 'bug' | 'feature' | 'question';

export type FeedbackSystemInfo = Record<string, string>;

export interface FeedbackRequest {
  title: string;
  description: string;
  category: FeedbackCategory;
  email?: string;
  system_info?: FeedbackSystemInfo;
  screenshot_url?: string;
}

export interface FeedbackResponse {
  issue_url: string;
  issue_number: number;
}
