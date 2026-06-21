// Semantic color palette following Material Design 3 principles
// Colors are organized by semantic meaning rather than hue

export const semanticColors = {
  primary: {
    // "Calm Modern" indigo accent
    50: '#EEEEFB',
    100: '#E0E0F8',
    200: '#C7C7F2',
    300: '#A5A5EC',
    400: '#8080E3',
    500: '#5B5BD6', // Main primary color (Calm Modern indigo)
    600: '#4A4AC8',
    700: '#3F3FB0', // Dark primary
    800: '#33338F',
    900: '#28286E'
  },

  secondary: {
    50: '#F3E5F5',
    100: '#E1BEE7',
    200: '#CE93D8',
    300: '#BA68C8',
    400: '#AB47BC',
    500: '#9C27B0', // Main secondary color
    600: '#8E24AA',
    700: '#7B1FA2',
    800: '#6A1B9A',
    900: '#4A148C'
  },

  success: {
    50: '#E8F5E8',
    100: '#C8E6C9',
    200: '#A5D6A7',
    300: '#81C784',
    400: '#66BB6A',
    500: '#4CAF50', // Main success color
    600: '#43A047',
    700: '#388E3C', // Dark success
    800: '#2E7D32',
    900: '#1B5E20'
  },

  warning: {
    50: '#FFF3E0',
    100: '#FFE0B2',
    200: '#FFCC80',
    300: '#FFB74D',
    400: '#FFA726',
    500: '#FF9800', // Main warning color
    600: '#FB8C00',
    700: '#F57C00', // Dark warning
    800: '#EF6C00',
    900: '#E65100'
  },

  error: {
    50: '#FFEBEE',
    100: '#FFCDD2',
    200: '#EF9A9A',
    300: '#E57373',
    400: '#EF5350',
    500: '#F44336', // Main error color
    600: '#E53935',
    700: '#D32F2F', // Dark error
    800: '#C62828',
    900: '#B71C1C'
  },

  neutral: {
    0: '#FFFFFF',   // Pure white
    50: '#FAFAFA',  // Background light
    100: '#F5F5F5', // Surface light
    200: '#EEEEEE', // Border light
    300: '#E0E0E0', // Divider light
    400: '#BDBDBD', // Disabled light
    500: '#9E9E9E', // Text secondary light
    600: '#757575', // Text primary light
    700: '#616161', // Text emphasis light
    800: '#424242', // Surface dark
    900: '#212121', // Text primary dark
    1000: '#000000' // Pure black
  }
} as const;

// Semantic color mappings for different themes
export const lightThemeColors = {
  background: {
    primary: semanticColors.neutral[0],    // White
    secondary: semanticColors.neutral[50], // Light gray
    tertiary: semanticColors.neutral[100]  // Lighter gray
  },

  surface: {
    primary: semanticColors.neutral[0],    // White
    secondary: semanticColors.neutral[50], // Light gray
    elevated: semanticColors.neutral[0]    // White with shadow
  },

  text: {
    primary: semanticColors.neutral[900],   // Dark gray
    secondary: semanticColors.neutral[600], // Medium gray
    tertiary: semanticColors.neutral[500],  // Light gray
    disabled: semanticColors.neutral[400]   // Very light gray
  },

  border: {
    primary: semanticColors.neutral[200],   // Light border
    secondary: semanticColors.neutral[300], // Medium border
    strong: semanticColors.neutral[400]     // Strong border
  },

  shadow: {
    sm: 'rgba(0, 0, 0, 0.05)',
    md: 'rgba(0, 0, 0, 0.1)',
    lg: 'rgba(0, 0, 0, 0.15)',
    xl: 'rgba(0, 0, 0, 0.2)'
  }
} as const;

export const darkThemeColors = {
  background: {
    primary: '#121212',   // Material dark surface
    secondary: '#1E1E1E', // Material dark surface +1
    tertiary: '#242424'   // Material dark surface +2
  },

  surface: {
    primary: '#1E1E1E',   // Material dark surface +1
    secondary: '#242424', // Material dark surface +2
    elevated: '#2D2D2D'   // Material dark surface +3
  },

  text: {
    primary: '#FFFFFF',   // White
    secondary: '#E0E0E0', // Light gray
    tertiary: '#BDBDBD',  // Medium gray
    disabled: '#757575'   // Dark gray
  },

  border: {
    primary: '#424242',   // Dark border
    secondary: '#616161', // Medium dark border
    strong: '#757575'     // Strong dark border
  },

  shadow: {
    sm: 'rgba(0, 0, 0, 0.2)',
    md: 'rgba(0, 0, 0, 0.3)',
    lg: 'rgba(0, 0, 0, 0.4)',
    xl: 'rgba(0, 0, 0, 0.5)'
  }
} as const;

// Helper function to get semantic color value
export function getSemanticColor(
  semantic: keyof typeof semanticColors,
  shade: keyof typeof semanticColors.primary
): string {
  return semanticColors[semantic][shade];
}

// Event type color mappings
export const eventTypeColors = {
  default: {
    background: semanticColors.neutral[50],
    border: semanticColors.neutral[200],
    text: semanticColors.neutral[700]
  },

  milestone: {
    background: semanticColors.primary[50],
    border: semanticColors.primary[200],
    text: semanticColors.primary[700]
  },

  deadline: {
    background: semanticColors.error[50],
    border: semanticColors.error[200],
    text: semanticColors.error[700]
  },

  meeting: {
    background: semanticColors.secondary[50],
    border: semanticColors.secondary[200],
    text: semanticColors.secondary[700]
  },

  celebration: {
    background: semanticColors.success[50],
    border: semanticColors.success[200],
    text: semanticColors.success[700]
  },

  warning: {
    background: semanticColors.warning[50],
    border: semanticColors.warning[200],
    text: semanticColors.warning[700]
  }
} as const;