/**
 * Avatar utilities for generating initials and colors
 * v0.5.0.2 - Initials Avatar System
 */

/**
 * Generate initials from a username or name
 * For usernames: "john-doe" → "JD", "alice" → "AL"
 * For names: "John Doe" → "JD", "Alice" → "A"
 * v0.5.14 - Updated to work with username (hyphen-separated) or name (space-separated)
 */
export function getInitials(input: string): string {
  if (!input) return '?';

  const trimmed = input.trim();

  // Check if it's a username (contains hyphens but no spaces)
  if (trimmed.includes('-') && !trimmed.includes(' ')) {
    // Username format: "john-doe" → "JD"
    const parts = trimmed.split('-');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    const firstInitial = parts[0][0];
    const lastInitial = parts[parts.length - 1][0];
    return (firstInitial + lastInitial).toUpperCase();
  }

  // Check if it's a single word (could be username like "cynacons")
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    // Single word - use first 2 letters for usernames, first letter for names
    return words[0].substring(0, 2).toUpperCase();
  }

  // Multiple words (name format) - use first letter of first word and first letter of last word
  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];
  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Generate a consistent color for a user based on their ID
 * Uses a predefined palette of pleasant colors
 */
export function getUserColor(userId: string): string {
  // "Calm Modern" — cohesive cool/calm palette, indigo-led (no loud amber/red/orange/lime)
  const colors = [
    '#5B5BD6', // indigo (brand)
    '#7C7CF0', // light indigo
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#0EA5E9', // sky-500
    '#06B6D4', // cyan-500
    '#14B8A6', // teal-500
    '#10B981', // emerald-500
    '#A855F7', // purple-500
    '#3B82F6', // blue-500
    '#4F46E5', // indigo-600
    '#0891B2', // cyan-600
  ];

  // Generate a consistent index from userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;

  return colors[index];
}

/**
 * Get contrasting text color (white or black) based on background color
 */
export function getContrastColor(hexColor: string): string {
  // Remove # if present
  const color = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
