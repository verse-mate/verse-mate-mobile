/**
 * TypeScript interfaces for Visual Reference Tooling
 *
 * These types define the structure for capturing screenshots,
 * metadata, and user journeys from the VerseMate web application.
 */

/**
 * Viewport configuration for screenshot capture
 */
export interface ViewportConfig {
  name: 'desktop' | 'tablet' | 'mobile';
  width: number;
  height: number;
}

/**
 * Standard viewport configurations
 */
export const VIEWPORTS: Record<ViewportConfig['name'], ViewportConfig> = {
  desktop: { name: 'desktop', width: 1920, height: 1080 },
  tablet: { name: 'tablet', width: 768, height: 1024 },
  mobile: { name: 'mobile', width: 375, height: 667 },
};

/**
 * Screenshot capture options
 */
export interface ScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
  state?: 'default' | 'hover' | 'focus' | 'active' | 'loading' | 'error';
  quality?: number;
}

/**
 * HTML structure representation
 */
export interface HTMLStructure {
  tag: string;
  classes: string[];
  id?: string;
  attributes: Record<string, string>;
  children: HTMLStructure[];
  textContent?: string;
}

/**
 * Typography styles
 */
export interface TypographyStyles {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
}

/**
 * Color styles
 */
export interface ColorStyles {
  color: string;
  backgroundColor: string;
  borderColor?: string;
}

/**
 * Spacing styles
 */
export interface SpacingStyles {
  margin: string;
  padding: string;
}

/**
 * Layout styles
 */
export interface LayoutStyles {
  display: string;
  position: string;
  width: string;
  height: string;
}

/**
 * Computed styles for an element
 */
export interface ComputedStyles {
  selector: string;
  styles: {
    typography: TypographyStyles;
    colors: ColorStyles;
    spacing: SpacingStyles;
    layout: LayoutStyles;
  };
}

/**
 * Design token
 */
export interface DesignToken {
  name: string;
  value: string;
  category: 'color' | 'typography' | 'spacing' | 'border' | 'shadow';
  usage?: string;
}

/**
 * Metadata extracted from a page
 */
export interface PageMetadata {
  url: string;
  capturedAt: string;
  htmlStructure: HTMLStructure;
  computedStyles: ComputedStyles[];
  designTokens: DesignToken[];
}

/**
 * Journey step action types
 */
export type JourneyAction = 'click' | 'navigate' | 'type' | 'scroll';

/**
 * Individual step in a user journey
 */
export interface JourneyStep {
  name: string;
  description: string;
  action?: JourneyAction;
  url?: string;
  selector?: string;
  value?: string;
  waitFor?: string;
  screenshot: string;
}

/**
 * Complete user journey definition
 */
export interface Journey {
  name: string;
  description: string;
  createdAt: string;
  baseUrl: string;
  steps: JourneyStep[];
}

/**
 * Capture configuration for a single page
 */
export interface CaptureConfig {
  url: string;
  name: string;
  viewports?: ViewportConfig['name'][];
  fullPage?: boolean;
  waitForSelector?: string;
  extractMetadata?: boolean;
}

/**
 * Result of a capture operation
 */
export interface CaptureResult {
  success: boolean;
  screenshots: {
    viewport: string;
    path: string;
  }[];
  metadata?: PageMetadata;
  error?: string;
}
